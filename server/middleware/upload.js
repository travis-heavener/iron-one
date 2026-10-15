/******************************************************************************
 * Upload Middleware
 * Configures Multer storage, size limits, and MIME type validation for avatars
 ******************************************************************************/

import fs from "node:fs";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendError } from "../utils/response.js";

// Resolve filesystem paths
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );
const rootDir = path.resolve( __dirname, "../.." );
export const avatarDir = path.join( rootDir, "uploads", "avatars" );

// Ensure upload directory exists
if ( !fs.existsSync( avatarDir ) ) {
    fs.mkdirSync( avatarDir, { recursive: true } );
}

// Allowed avatar MIME types
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

// Map allowed MIME types strictly to safe extensions
const MIME_EXTENSION_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

// Configure disk storage
const storage = multer.diskStorage({
    destination: ( req, file, cb ) => {
        cb( null, avatarDir );
    },
    filename: ( req, file, cb ) => {
        const safeExt = MIME_EXTENSION_MAP[file.mimetype];
        if ( !safeExt ) {
            return cb( new Error( "Invalid or unsupported image MIME type" ) );
        }

        const uniqueName = `avatar-${req.user?.id || "user"}-${Date.now()}${safeExt}`;
        cb( null, uniqueName );
    }
});

// Configure Multer instance w/ 5MB limit and MIME filtering
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB max file size
    },
    fileFilter: ( req, file, cb ) => {
        if ( !ALLOWED_MIME_TYPES.has( file.mimetype ) ) {
            return cb( new Error( "Invalid file type. Only JPEG, PNG, and WebP images are allowed" ) );
        }
        cb( null, true );
    }
});

// Used to handle avatar upload and catch Multer validation errors
export const handleAvatarUpload = ( req, res, next ) => {
    const uploadSingle = upload.single( "avatar" );

    uploadSingle( req, res, ( err ) => {
        if ( !err ) return next();

        if ( err instanceof multer.MulterError ) {
            if ( err.code === "LIMIT_FILE_SIZE" ) {
                return sendError( res, "File size exceeds 5MB limit", "ERR_FILE_TOO_LARGE", 400 );
            }
            return sendError( res, `Upload error: ${err.message}`, "ERR_UPLOAD_FAILED", 400 );
        }

        return sendError( res, err.message || "Failed to upload avatar", "ERR_INVALID_FILE", 400 );
    });
};

