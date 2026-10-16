/******************************************************************************
 * Database Backup Script
 * Creates online non-blocking WAL snapshot of SQLite database and rotates backups
 ******************************************************************************/

import Database from "better-sqlite3";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve filesystem paths
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );
const rootDir = path.resolve( __dirname, ".." );
const backupDir = path.resolve( rootDir, "backups" );
const retentionDays = 14;

// Resolve database file path from environment or default
const rawDbUrl = process.env.DATABASE_URL || "file:./ironone.db";
const urlWithoutPrefix = rawDbUrl.startsWith( "file:" ) ? rawDbUrl.slice( 5 ) : rawDbUrl;
const [ filePath ] = urlWithoutPrefix.split( "?" );
const resolvedDbPath = path.resolve( rootDir, filePath );

// Returns formatted timestamp string YYYYMMDD_HHMMSS
const getTimestamp = () => {
    const now = new Date();
    const pad = ( n ) => String( n ).padStart( 2, "0" );
    const y = now.getFullYear();
    const m = pad( now.getMonth() + 1 );
    const d = pad( now.getDate() );
    const hh = pad( now.getHours() );
    const mm = pad( now.getMinutes() );
    const ss = pad( now.getSeconds() );
    return `${y}${m}${d}_${hh}${mm}${ss}`;
};

// Returns human-readable byte size string
const formatBytes = ( bytes ) => {
    if ( bytes < 1024 ) return `${bytes} B`;
    if ( bytes < 1024 * 1024 ) return `${Math.round( bytes / 1024 * 10 ) / 10} KB`;
    return `${Math.round( bytes / ( 1024 * 1024 ) * 10 ) / 10} MB`;
};

// Execute online database backup
const runBackup = async () => {
    console.log( "📦 IronOne Automated Database Backup" );

    if ( !fs.existsSync( resolvedDbPath ) ) {
        console.error( `❌ Database file not found at ${resolvedDbPath}` );
        process.exit( 1 );
    }

    // Ensure backups directory exists
    if ( !fs.existsSync( backupDir ) ) {
        fs.mkdirSync( backupDir, { recursive: true } );
    }

    const timestamp = getTimestamp();
    const backupFileName = `ironone_${timestamp}.db`;
    const backupFilePath = path.join( backupDir, backupFileName );

    console.log( `⏳ Snapshotting ${path.basename( resolvedDbPath )}...` );

    let db = null;
    try {
        db = new Database( resolvedDbPath, { readonly: true } );
        await db.backup( backupFilePath );
        db.close();
        db = null;

        const stat = fs.statSync( backupFilePath );
        console.log( `✅ Backup created successfully: ${backupFileName} (${formatBytes( stat.size )})` );
    } catch ( err ) {
        if ( db ) db.close();
        console.error( "❌ Backup snapshot failed:", err );
        process.exit( 1 );
    }

    // Rotate backups older than retention window
    try {
        const cutoffTime = Date.now() - ( retentionDays * 24 * 60 * 60 * 1000 );
        const files = fs.readdirSync( backupDir );
        let prunedCount = 0;

        for ( let i = 0; i < files.length; ++i ) {
            const file = files[i];
            if ( !file.startsWith( "ironone_" ) || !file.endsWith( ".db" ) ) continue;

            const fullPath = path.join( backupDir, file );
            const stat = fs.statSync( fullPath );

            if ( stat.mtimeMs < cutoffTime ) {
                fs.unlinkSync( fullPath );
                ++prunedCount;
            }
        }

        if ( prunedCount > 0 ) {
            console.log( `🧹 Pruned ${prunedCount} backup(s) older than ${retentionDays} days` );
        }
    } catch ( pruneErr ) {
        console.warn( "⚠️ Warning: Failed to prune old backups:", pruneErr.message );
    }

    console.log( "✅ Backup complete" );
};

runBackup().catch( ( err ) => {
    console.error( "❌ Unexpected error during backup:", err );
    process.exit( 1 );
});

