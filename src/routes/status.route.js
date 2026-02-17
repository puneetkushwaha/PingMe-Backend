import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadStatus, getStatuses, viewStatus } from "../controllers/status.controller.js";

const router = express.Router();

router.post("/upload", protectRoute, uploadStatus);
router.get("/", protectRoute, getStatuses);
router.post("/view/:id", protectRoute, viewStatus);

export default router;
