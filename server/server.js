/******************************************************************************
 * IronOne Server Entry Point
 * Express REST API server configured w/ security, CORS, and health routing
 ******************************************************************************/

import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

import prisma, { initDatabase } from "./models/db.js";
import apiRouter from "./routes/index.js";
import { sendError } from "./utils/response.js";

// Resolve filesystem paths for ESM module
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );
const rootDir = path.resolve( __dirname, ".." );

// Initialize Express application
const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

/******************************************************************************
 * Middleware Configuration
 ******************************************************************************/

// Set security HTTP headers
app.use( helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}) );

// Enable cross-origin resource sharing for SPA clients
app.use( cors() );

// Parse incoming JSON and URL-encoded payloads
app.use( express.json({ limit: "10mb" }) );
app.use( express.urlencoded({ extended: true, limit: "10mb" }) );

// Serve uploaded user avatars statically
app.use( "/uploads", express.static( path.join( rootDir, "uploads" ) ) );

/******************************************************************************
 * API Routing
 ******************************************************************************/

// Mount master API router
app.use( "/api", apiRouter );

/******************************************************************************
 * Error Handling Middleware
 ******************************************************************************/

// Handle undefined routes w/ standard JSON error envelope
app.use( ( req, res ) => {
    return sendError( res, `Route not found: ${req.method} ${req.originalUrl}`, "ERR_NOT_FOUND", 404 );
});

// Centralized error handler
app.use( ( err, req, res, next ) => {
    if ( res.headersSent ) return next( err );

    const statusCode = err.status || 500;
    const message = err.message || "Internal server error";

    console.error( "[Server Error]", err );

    return sendError( res, message, err.code || "ERR_INTERNAL_SERVER", statusCode );
});

/******************************************************************************
 * Server Lifecycle
 ******************************************************************************/

// Start listening on configured host and port
const server = app.listen( port, host, async () => {
    console.log( `✅ IronOne server listening on http://${host}:${port}` );
    console.log( `✅ Health check reachable at http://${host}:${port}/api/health` );

    try {
        await initDatabase();
        console.log( "✅ SQLite database connected w/ WAL mode enabled" );
    } catch ( err ) {
        console.error( "❌ Database initialization failed:", err );
    }
});

// Handle graceful process termination
const handleShutdown = async ( signal ) => {
    console.log( `\n🛑 Received ${signal}. Shutting down gracefully...` );

    server.close( async () => {
        try {
            await prisma.$disconnect();
            console.log( "✅ Database disconnected. Server stopped" );
            process.exit( 0 );
        } catch ( err ) {
            console.error( "❌ Error during database disconnect:", err );
            process.exit( 1 );
        }
    });

    // Force exit if close exceeds timeout
    setTimeout( () => {
        console.error( "❌ Forcefully terminating server after timeout" );
        process.exit( 1 );
    }, 5000 ).unref();
};

process.on( "SIGINT", () => handleShutdown( "SIGINT" ) );
process.on( "SIGTERM", () => handleShutdown( "SIGTERM" ) );

export { app, server };

