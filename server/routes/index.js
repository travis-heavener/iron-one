/******************************************************************************
 * Master API Router
 * Aggregates all domain routes under /api prefix
 ******************************************************************************/

import express from "express";

import authRouter from "./auth.js";
import exercisesRouter from "./exercises.js";
import healthRouter from "./health.js";
import routinesRouter from "./routines.js";
import setsRouter from "./sets.js";
import userRouter from "./user.js";
import workoutEntriesRouter from "./workoutEntries.js";
import workoutExercisesRouter from "./workoutExercises.js";

const apiRouter = express.Router();

// Mount domain routes
apiRouter.use( "/auth", authRouter );
apiRouter.use( "/exercises", exercisesRouter );
apiRouter.use( "/health", healthRouter );
apiRouter.use( "/routines", routinesRouter );
apiRouter.use( "/sets", setsRouter );
apiRouter.use( "/user", userRouter );
apiRouter.use( "/workout-entries", workoutEntriesRouter );
apiRouter.use( "/workout-exercises", workoutExercisesRouter );

export default apiRouter;

