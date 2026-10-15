/******************************************************************************
 * Database Client Instance
 * Prisma client configuration w/ SQLite Write-Ahead Logging (WAL) support
 ******************************************************************************/

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve filesystem paths
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );
const rootDir = path.resolve( __dirname, "../.." );

// Resolve database file URL
const rawDbUrl = process.env.DATABASE_URL || "file:./ironone.db";
const urlWithoutPrefix = rawDbUrl.startsWith( "file:" ) ? rawDbUrl.slice( 5 ) : rawDbUrl;
const [ filePath, queryString ] = urlWithoutPrefix.split( "?" );
const resolvedPath = path.resolve( rootDir, filePath );
const dbUrl = queryString ? `file:${resolvedPath}?${queryString}` : `file:${resolvedPath}`;

// Initialize better-sqlite3 adapter for Prisma
const adapter = new PrismaBetterSqlite3({ url: dbUrl });

// Initialize global Prisma client
const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

// Used to configure SQLite performance settings (WAL mode)
export const initDatabase = async () => {
    // Enable Write-Ahead Logging for high-concurrency read/write operations
    await prisma.$queryRawUnsafe( "PRAGMA journal_mode = WAL;" );
    await prisma.$queryRawUnsafe( "PRAGMA synchronous = NORMAL;" );
    await prisma.$queryRawUnsafe( "PRAGMA foreign_keys = ON;" );
    await prisma.$queryRawUnsafe( "PRAGMA busy_timeout = 5000;" );
};

export default prisma;

