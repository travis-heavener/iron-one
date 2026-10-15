/******************************************************************************
 * Auth Router
 * Handles user registration and authentication endpoints
 ******************************************************************************/

import express from "express";

import { login, register } from "../controllers/authController.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Registration and login endpoints w/ brute-force rate limiting
router.post( "/register", registerLimiter, register );
router.post( "/login", loginLimiter, login );

export default router;

