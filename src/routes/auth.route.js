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
router.get("/search-users", protectRoute, (req, res, next) => {
    // We'll define these in auth.controller
    import("../controllers/auth.controller.js").then(module => {
        module.searchUsers(req, res);
    }).catch(next);
});
router.post("/add-contact", protectRoute, (req, res, next) => {
    import("../controllers/auth.controller.js").then(module => {
        module.addContact(req, res);
    }).catch(next);
});
router.post("/unlink-device", protectRoute, unlinkDevice);

export default router;
