/******************************************************************************
 * User Router
 * Handles authenticated user profile management and avatar uploads
 ******************************************************************************/

import express from "express";

import { getProfile, updateProfile, uploadAvatar } from "../controllers/userController.js";
import { authenticateToken } from "../middleware/auth.js";
import { handleAvatarUpload } from "../middleware/upload.js";

const router = express.Router();

// Protect all user profile endpoints w/ JWT authentication
router.use( authenticateToken );

// User profile endpoints
router.get( "/profile", getProfile );
router.put( "/profile", updateProfile );
router.post( "/avatar", handleAvatarUpload, uploadAvatar );

export default router;

