/******************************************************************************
 * User Controller
 * Handles user profile retrieval, profile updates, and avatar uploads
 ******************************************************************************/

import fs from "node:fs";
import path from "node:path";

import { avatarDir } from "../middleware/upload.js";
import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { sanitizeUser } from "./authController.js";

// Used to retrieve authenticated user profile
export const getProfile = async ( req, res ) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if ( !user ) {
            return sendError( res, "User not found", "ERR_USER_NOT_FOUND", 404 );
        }

        return sendSuccess( res, sanitizeUser( user ) );
    } catch ( err ) {
        console.error( "[Get Profile Error]", err );
        return sendError( res, "Failed to retrieve user profile", "ERR_PROFILE_FETCH_FAILED", 500 );
    }
};

// Used to update user profile information
export const updateProfile = async ( req, res ) => {
    const { username, height, weight, unitPreference } = req.body || {};
    const updateData = {};

    // Validate and sanitize username if provided
    if ( username !== undefined ) {
        if ( typeof username !== "string" ) {
            return sendError( res, "Username must be a string", "ERR_INVALID_USERNAME", 400 );
        }

        const trimmed = username.trim();
        if ( trimmed.length < 3 || trimmed.length > 30 ) {
            return sendError( res, "Username must be between 3 and 30 characters", "ERR_INVALID_USERNAME", 400 );
        }

        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if ( !usernameRegex.test( trimmed ) ) {
            return sendError( res, "Username can only contain alphanumeric characters and underscores", "ERR_INVALID_USERNAME", 400 );
        }

        // Verify case-insensitive username uniqueness
        if ( trimmed.toLowerCase() !== req.user.username.toLowerCase() ) {
            const existing = await prisma.$queryRaw`
                SELECT id FROM "User" WHERE LOWER(username) = LOWER(${trimmed}) AND id != ${req.user.id} LIMIT 1;
            `;

            if ( existing.length > 0 ) {
                return sendError( res, "Username is already taken", "ERR_USERNAME_TAKEN", 409 );
            }
        }

        updateData.username = trimmed;
    }

    // Validate unit preference if provided
    if ( unitPreference !== undefined ) {
        if ( unitPreference !== "imperial" && unitPreference !== "metric" ) {
            return sendError( res, "Unit preference must be 'imperial' or 'metric'", "ERR_INVALID_UNIT", 400 );
        }
        updateData.unitPreference = unitPreference;
    }

    // Determine effective unit preference for validation
    const effectiveUnit = unitPreference || req.user.unitPreference || "imperial";

    // Validate height if provided
    if ( height !== undefined ) {
        if ( height !== null ) {
            const isInvalidType = typeof height === "boolean" || ( typeof height === "string" && height.trim() === "" );
            const numHeight = Number( height );
            const minHeight = effectiveUnit === "metric" ? 50 : 20;   // 50 cm or 20 inches
            const maxHeight = effectiveUnit === "metric" ? 300 : 120; // 300 cm (~10 ft) or 120 inches (10 ft)

            if ( isInvalidType || Number.isNaN( numHeight ) || numHeight < minHeight || numHeight > maxHeight ) {
                const unitLabel = effectiveUnit === "metric" ? "cm (50 - 300)" : "inches (20 - 120)";
                return sendError( res, `Height must be between ${unitLabel} or null`, "ERR_INVALID_HEIGHT", 400 );
            }
            updateData.height = numHeight;
        } else {
            updateData.height = null;
        }
    }

    // Validate weight if provided
    if ( weight !== undefined ) {
        if ( weight !== null ) {
            const isInvalidType = typeof weight === "boolean" || ( typeof weight === "string" && weight.trim() === "" );
            const numWeight = Number( weight );
            const minWeight = effectiveUnit === "metric" ? 20 : 40;    // 20 kg or 40 lbs
            const maxWeight = effectiveUnit === "metric" ? 500 : 1000; // 500 kg or 1000 lbs

            if ( isInvalidType || Number.isNaN( numWeight ) || numWeight < minWeight || numWeight > maxWeight ) {
                const unitLabel = effectiveUnit === "metric" ? "kg (20 - 500)" : "lbs (40 - 1000)";
                return sendError( res, `Weight must be between ${unitLabel} or null`, "ERR_INVALID_WEIGHT", 400 );
            }
            updateData.weight = numWeight;
        } else {
            updateData.weight = null;
        }
    }

    if ( Object.keys( updateData ).length === 0 ) {
        return sendError( res, "No valid profile fields provided for update", "ERR_NO_UPDATES", 400 );
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        return sendSuccess( res, sanitizeUser( updatedUser ) );
    } catch ( err ) {
        if ( err.code === "P2002" ) {
            return sendError( res, "Username is already taken", "ERR_USERNAME_TAKEN", 409 );
        }

        console.error( "[Update Profile Error]", err );
        return sendError( res, "Failed to update profile", "ERR_UPDATE_PROFILE_FAILED", 500 );
    }
};

// Used to upload and link user avatar image
export const uploadAvatar = async ( req, res ) => {
    if ( !req.file ) {
        return sendError( res, "Avatar file is required", "ERR_NO_FILE", 400 );
    }

    try {
        // Validate actual image magic bytes (file signature) on disk
        const fileHandle = await fs.promises.open( req.file.path, "r" );
        const magicBytes = Buffer.alloc( 12 );
        try {
            await fileHandle.read( magicBytes, 0, 12, 0 );
        } finally {
            await fileHandle.close();
        }

        const isPng = magicBytes.subarray( 0, 8 ).equals( Buffer.from([ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ]) );
        const isJpg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF;
        const isWebp = magicBytes.toString( "ascii", 0, 4 ) === "RIFF" && magicBytes.toString( "ascii", 8, 12 ) === "WEBP";

        if ( !isPng && !isJpg && !isWebp ) {
            await fs.promises.unlink( req.file.path );
            return sendError( res, "Uploaded file content is not a valid image", "ERR_INVALID_IMAGE_CONTENT", 400 );
        }

        // Fetch current user to check for previous custom avatar
        const currentUser = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if ( !currentUser ) {
            return sendError( res, "User not found", "ERR_USER_NOT_FOUND", 404 );
        }

        // Clean up previous avatar from filesystem if present
        if ( currentUser.avatarUrl && currentUser.avatarUrl.startsWith( "/uploads/avatars/" ) ) {
            const oldFilename = path.basename( currentUser.avatarUrl );
            const oldFilePath = path.join( avatarDir, oldFilename );

            if ( oldFilename !== ".gitkeep" && fs.existsSync( oldFilePath ) ) {
                try {
                    await fs.promises.unlink( oldFilePath );
                } catch ( err ) {
                    console.warn( "[Avatar Cleanup Warning] Failed to delete previous avatar file:", err );
                }
            }
        }

        // Generate public URL path for static serving
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        // Update user record w/ new avatar URL
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { avatarUrl }
        });

        return sendSuccess( res, sanitizeUser( updatedUser ) );
    } catch ( err ) {
        // Clean up newly uploaded file on database failure
        if ( req.file?.path && fs.existsSync( req.file.path ) ) {
            try {
                await fs.promises.unlink( req.file.path );
            } catch ( unlinkErr ) {
                console.warn( "[Avatar Cleanup Warning] Failed to delete orphaned upload:", unlinkErr );
            }
        }

        console.error( "[Upload Avatar Error]", err );
        return sendError( res, "Failed to update avatar", "ERR_AVATAR_UPDATE_FAILED", 500 );
    }
};

