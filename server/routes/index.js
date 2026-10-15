/******************************************************************************
 * Master API Router
 * Aggregates all domain routes under /api prefix
 ******************************************************************************/

import express from "express";

import healthRouter from "./health.js";

const apiRouter = express.Router();

// Mount system routes
apiRouter.use( "/health", healthRouter );

export default apiRouter;

