/******************************************************************************
 * Workout Entries Router
 * Handles active gym session lifecycle, history logs, and calendar feeds
 ******************************************************************************/

import express from "express";

import {
    cloneWorkoutEntry,
    completeWorkoutEntry,
    createWorkoutEntry,
    deleteWorkoutEntry,
    getActiveWorkout,
    getCalendarWorkouts,
    getWorkoutEntries,
    getWorkoutEntryById,
    getWorkoutStreak,
    updateWorkoutEntry
} from "../controllers/workoutController.js";
import { addExerciseToWorkout } from "../controllers/workoutExerciseController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Protect all workout entry routes w/ JWT authentication
router.use( authenticateToken );

// Specific action routes (must precede /:id)
router.get( "/active", getActiveWorkout );
router.get( "/calendar", getCalendarWorkouts );
router.get( "/streak", getWorkoutStreak );

// General collection routes
router.get( "/", getWorkoutEntries );
router.post( "/", createWorkoutEntry );

// Individual entry lifecycle routes
router.get( "/:id", getWorkoutEntryById );
router.put( "/:id", updateWorkoutEntry );
router.post( "/:id/exercises", addExerciseToWorkout );
router.post( "/:id/complete", completeWorkoutEntry );
router.post( "/:id/clone", cloneWorkoutEntry );
router.delete( "/:id", deleteWorkoutEntry );

export default router;

