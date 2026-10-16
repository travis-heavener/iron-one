/******************************************************************************
 * Vite Configuration
 * Configures React plugin, Tailwind CSS v4, and local development proxy
 ******************************************************************************/

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss()
    ],
    server: {
        port: 5173,
        host: "0.0.0.0",
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true
            },
            "/uploads": {
                target: "http://localhost:3000",
                changeOrigin: true
            }
        }
    }
});

