/******************************************************************************
 * Routine Router
 * Handles workout routine template CRUD and duplication endpoints
 ******************************************************************************/

import express from "express";

import {
    copyRoutine,
    createRoutine,
    deleteRoutine,
    getRoutineById,
    getRoutines,
    updateRoutine
} from "../controllers/routineController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Protect all routine endpoints w/ JWT authentication
router.use( authenticateToken );

// Routine template endpoints
router.get( "/", getRoutines );
router.post( "/", createRoutine );
router.get( "/:id", getRoutineById );
router.put( "/:id", updateRoutine );
router.post( "/:id/copy", copyRoutine );
router.delete( "/:id", deleteRoutine );

export default router;

