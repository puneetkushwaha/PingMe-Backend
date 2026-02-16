import express from "express";
import { checkAuth, login, logout, signup, updateProfile, toggleArchive, toggleStar } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/toggle-archive", protectRoute, toggleArchive);
router.put("/toggle-star", protectRoute, toggleStar);

router.get("/check", protectRoute, checkAuth);

export default router;
