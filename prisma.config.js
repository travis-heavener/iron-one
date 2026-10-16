/******************************************************************************
 * Prisma Configuration
 * Datasource and migration definitions for Prisma CLI v7+
 ******************************************************************************/

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations"
    },
    datasource: {
        url: process.env.DATABASE_URL || "file:./ironone.db"
    }
});

