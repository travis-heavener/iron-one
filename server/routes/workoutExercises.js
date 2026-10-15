/******************************************************************************
 * Workout Exercises Router
 * Handles in-session exercise adjustments, hot-swapping, and set creation
 ******************************************************************************/

import express from "express";

import { addSetToWorkoutExercise } from "../controllers/setController.js";
import {
    deleteWorkoutExercise,
    swapWorkoutExercise,
    updateWorkoutExercise
} from "../controllers/workoutExerciseController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Protect all workout exercise routes w/ JWT authentication
router.use( authenticateToken );

// Workout exercise lifecycle routes
router.put( "/:id", updateWorkoutExercise );
router.delete( "/:id", deleteWorkoutExercise );
router.post( "/:id/swap", swapWorkoutExercise );
router.post( "/:id/sets", addSetToWorkoutExercise );

export default router;

