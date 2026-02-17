import express from "express";
import { checkAuth, login, logout, signup, updateProfile, toggleArchive, toggleStar, pairDevice, loginWithToken, getLinkedDevices, unlinkDevice } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/pair-device", protectRoute, pairDevice);
router.post("/login-with-token", loginWithToken);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/toggle-archive", protectRoute, toggleArchive);
router.put("/toggle-star", protectRoute, toggleStar);

router.get("/check", protectRoute, checkAuth);
router.get("/linked-devices", protectRoute, getLinkedDevices);
router.post("/unlink-device", protectRoute, unlinkDevice);

export default router;
