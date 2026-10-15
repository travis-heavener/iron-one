/******************************************************************************
 * Health Check Router
 * System diagnostic and Tailscale connectivity verification
 ******************************************************************************/

import express from "express";

import { sendSuccess } from "../utils/response.js";

const router = express.Router();

// Health check endpoint
router.get( "/", ( req, res ) => {
    return sendSuccess( res, {
        service: "ironone",
        status: "healthy",
        uptime: Math.floor( process.uptime() ),
        timestamp: new Date().toISOString()
    });
});

export default router;

