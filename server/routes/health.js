/******************************************************************************
 * Health Check Router
 * System diagnostic and Tailscale connectivity verification
 ******************************************************************************/

import express from "express";

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = express.Router();

// Health check endpoint
router.get( "/", async ( req, res ) => {
    try {
        await prisma.$queryRawUnsafe( "SELECT 1;" );

        return sendSuccess( res, {
            service: "ironone",
            status: "healthy",
            database: "connected",
            uptime: Math.floor( process.uptime() ),
            timestamp: new Date().toISOString()
        });
    } catch ( err ) {
        console.error( "[Health Check Failed]", err );
        return sendError( res, "Database connectivity check failed", "ERR_DATABASE_DISCONNECTED", 503 );
    }
});

export default router;

