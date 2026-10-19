/******************************************************************************
 * Authentication Middleware
 * Validates incoming JSON Web Tokens (JWT) on protected API routes
 ******************************************************************************/

import jwt from "jsonwebtoken";

import prisma from "../models/db.js";
import { sendError } from "../utils/response.js";

// Used to authenticate requests w/ Bearer JWT token
export const authenticateToken = async ( req, res, next ) => {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if ( !authHeader || !authHeader.startsWith( "Bearer " ) ) {
        return sendError( res, "Authentication token required", "ERR_UNAUTHORIZED", 401 );
    }

    const token = authHeader.slice( 7 ).trim();
    if ( !token ) {
        return sendError( res, "Authentication token required", "ERR_UNAUTHORIZED", 401 );
    }

    const jwtSecret = process.env.JWT_SECRET;

    if ( !jwtSecret ) {
        console.error( "[Auth Error] JWT_SECRET is not configured in environment" );
        return sendError( res, "Authentication configuration error", "ERR_SERVER_MISCONFIG", 500 );
    }

    try {
        const decoded = jwt.verify( token, jwtSecret );
        if ( !decoded || typeof decoded !== "object" || typeof decoded.id !== "string" ) {
            return sendError( res, "Invalid authentication token payload", "ERR_INVALID_TOKEN", 403 );
        }

        // Verify user still exists in database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if ( !user ) {
            return sendError( res, "User account no longer exists", "ERR_USER_NOT_FOUND", 401 );
        }

        // Attach user info to request context
        req.user = {
            id: user.id,
            username: user.username,
            unitPreference: user.unitPreference
        };

        return next();
    } catch ( err ) {
        if ( err.name === "TokenExpiredError" ) {
            return sendError( res, "Authentication token expired", "ERR_TOKEN_EXPIRED", 401 );
        }

        return sendError( res, "Invalid authentication token", "ERR_INVALID_TOKEN", 403 );
    }
};

