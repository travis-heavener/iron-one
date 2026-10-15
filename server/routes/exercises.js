/******************************************************************************
 * Exercise Router
 * Handles catalog lookup, search, and custom exercise CRUD endpoints
 ******************************************************************************/

import express from "express";

import {
    createExercise,
    deleteExercise,
    getExerciseById,
    getExercises,
    updateExercise
} from "../controllers/exerciseController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Protect all exercise routes w/ JWT authentication
router.use( authenticateToken );

// Exercise catalog endpoints
router.get( "/", getExercises );
router.post( "/", createExercise );
router.get( "/:id", getExerciseById );
router.put( "/:id", updateExercise );
router.delete( "/:id", deleteExercise );

export default router;

