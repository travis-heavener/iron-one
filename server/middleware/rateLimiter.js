/******************************************************************************
 * In-Memory Sliding Window Rate Limiter
 * Guards sensitive auth endpoints against brute-force and Argon2id CPU DoS
 ******************************************************************************/

import { sendError } from "../utils/response.js";

// Used to create IP-keyed sliding window rate limiter middleware
export const createRateLimiter = ( options = {} ) => {
    const {
        windowMs = 60 * 1000, // 1 minute default window
        maxRequests = 10,      // Max requests per window
        message = "Too many requests. Please try again later"
    } = options;

    const requestHits = new Map();

    // Periodically prune stale IP buckets every 5 minutes
    const cleanupInterval = setInterval( () => {
        const now = Date.now();
        for ( const [ ip, timestamps ] of requestHits.entries() ) {
            const validTimestamps = timestamps.filter( ( time ) => now - time < windowMs );
            if ( validTimestamps.length === 0 ) {
                requestHits.delete( ip );
            } else {
                requestHits.set( ip, validTimestamps );
            }
        }
    }, 5 * 60 * 1000 );

    cleanupInterval.unref();

    return ( req, res, next ) => {
        const clientIp = req.ip || req.socket?.remoteAddress || "unknown_client";
        const now = Date.now();

        const timestamps = requestHits.get( clientIp ) || [];
        const windowStart = now - windowMs;
        const recentTimestamps = timestamps.filter( ( time ) => time > windowStart );

        if ( recentTimestamps.length >= maxRequests ) {
            const oldestHit = recentTimestamps[0];
            const retryAfterSec = Math.ceil( ( oldestHit + windowMs - now ) / 1000 );
            res.setHeader( "Retry-After", Math.max( 1, retryAfterSec ) );

            return sendError( res, message, "ERR_TOO_MANY_REQUESTS", 429 );
        }

        recentTimestamps.push( now );
        requestHits.set( clientIp, recentTimestamps );

        return next();
    };
};

// Standard rate limiters for auth endpoints
export const loginLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: "Too many login attempts. Please wait 60 seconds before trying again"
});

export const registerLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: "Too many registration attempts. Please wait 60 seconds before trying again"
});

