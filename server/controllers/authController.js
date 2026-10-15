/******************************************************************************
 * Auth Controller
 * Handles user registration, Argon2id password hashing, and JWT login
 ******************************************************************************/

import argon2 from "argon2";
import jwt from "jsonwebtoken";

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Precomputed dummy Argon2id hash for timing side-channel mitigation
const DUMMY_ARGON2_HASH = "$argon2id$v=19$m=65536,p=4,t=3$sI6QSj/PchUu7cLvfwhDwA$iwe8Fzvrem90hTgCfBIq1+2VSRe5IG9jkSLi9vauJB0";

// Used to sanitize user object by removing sensitive credentials
export const sanitizeUser = ( user ) => {
    if ( !user ) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
};

// Used to register new user account w/ Argon2id password hashing
export const register = async ( req, res ) => {
    const { username, password } = req.body || {};

    // Validate username input
    if ( !username || typeof username !== "string" ) {
        return sendError( res, "Username is required", "ERR_INVALID_USERNAME", 400 );
    }

    const trimmedUsername = username.trim();
    if ( trimmedUsername.length < 3 || trimmedUsername.length > 30 ) {
        return sendError( res, "Username must be between 3 and 30 characters", "ERR_INVALID_USERNAME", 400 );
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if ( !usernameRegex.test( trimmedUsername ) ) {
        return sendError( res, "Username can only contain alphanumeric characters and underscores", "ERR_INVALID_USERNAME", 400 );
    }

    // Validate password input
    if ( !password || typeof password !== "string" ) {
        return sendError( res, "Password is required", "ERR_INVALID_PASSWORD", 400 );
    }

    if ( password.length < 8 || password.length > 128 ) {
        return sendError( res, "Password must be between 8 and 128 characters long", "ERR_INVALID_PASSWORD", 400 );
    }

    try {
        // Verify case-insensitive username uniqueness
        const existingUsers = await prisma.$queryRawUnsafe(
            'SELECT id FROM "User" WHERE LOWER(username) = LOWER(?) LIMIT 1;',
            trimmedUsername
        );

        if ( existingUsers.length > 0 ) {
            return sendError( res, "Username is already taken", "ERR_USERNAME_TAKEN", 409 );
        }

        // Hash password using memory-hard Argon2id
        const passwordHash = await argon2.hash( password, {
            type: argon2.argon2id
        });

        // Create user record in SQLite
        const newUser = await prisma.user.create({
            data: {
                username: trimmedUsername,
                passwordHash,
                unitPreference: "imperial"
            }
        });

        // Sign authentication token
        const jwtSecret = process.env.JWT_SECRET;
        const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

        if ( !jwtSecret ) {
            console.error( "[Auth Error] JWT_SECRET is not configured in environment" );
            return sendError( res, "Authentication configuration error", "ERR_SERVER_MISCONFIG", 500 );
        }

        const token = jwt.sign(
            { id: newUser.id, username: newUser.username },
            jwtSecret,
            { expiresIn }
        );

        return sendSuccess( res, {
            user: sanitizeUser( newUser ),
            token
        }, 201 );
    } catch ( err ) {
        // Catch concurrent race condition on SQLite unique constraint
        if ( err.code === "P2002" ) {
            return sendError( res, "Username is already taken", "ERR_USERNAME_TAKEN", 409 );
        }

        console.error( "[Register Error]", err );
        return sendError( res, "Failed to register user", "ERR_REGISTER_FAILED", 500 );
    }
};

// Used to authenticate user credentials and issue signed JWT
export const login = async ( req, res ) => {
    const { username, password } = req.body || {};

    // Validate credentials presence
    if ( !username || !password || typeof username !== "string" || typeof password !== "string" ) {
        return sendError( res, "Username and password are required", "ERR_INVALID_CREDENTIALS", 400 );
    }

    if ( password.length > 128 ) {
        return sendError( res, "Invalid username or password", "ERR_INVALID_CREDENTIALS", 401 );
    }

    const trimmedUsername = username.trim();

    try {
        // Lookup user by case-insensitive username match
        const matchingUsers = await prisma.$queryRawUnsafe(
            'SELECT * FROM "User" WHERE LOWER(username) = LOWER(?) LIMIT 1;',
            trimmedUsername
        );

        const user = matchingUsers[0];

        // Execute dummy hash comparison to eliminate username enumeration timing attacks
        if ( !user ) {
            await argon2.verify( DUMMY_ARGON2_HASH, password ).catch( () => false );
            return sendError( res, "Invalid username or password", "ERR_INVALID_CREDENTIALS", 401 );
        }

        // Verify password against stored Argon2id hash
        const isPasswordValid = await argon2.verify( user.passwordHash, password );
        if ( !isPasswordValid ) {
            return sendError( res, "Invalid username or password", "ERR_INVALID_CREDENTIALS", 401 );
        }

        // Sign authentication token
        const jwtSecret = process.env.JWT_SECRET;
        const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

        if ( !jwtSecret ) {
            console.error( "[Auth Error] JWT_SECRET is not configured in environment" );
            return sendError( res, "Authentication configuration error", "ERR_SERVER_MISCONFIG", 500 );
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            jwtSecret,
            { expiresIn }
        );

        return sendSuccess( res, {
            user: sanitizeUser( user ),
            token
        });
    } catch ( err ) {
        console.error( "[Login Error]", err );
        return sendError( res, "Failed to log in", "ERR_LOGIN_FAILED", 500 );
    }
};

