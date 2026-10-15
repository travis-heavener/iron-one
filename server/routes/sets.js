/******************************************************************************
 * Exercise Sets Router
 * Handles granular multi-modal set updates, 1-tap completions, and deletion
 ******************************************************************************/

import express from "express";

import {
    deleteExerciseSet,
    updateExerciseSet
} from "../controllers/setController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Protect all set routes w/ JWT authentication
router.use( authenticateToken );

// Set lifecycle routes
router.put( "/:id", updateExerciseSet );
router.delete( "/:id", deleteExerciseSet );

export default router;

