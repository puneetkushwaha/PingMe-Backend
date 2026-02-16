import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadStatus, getStatuses } from "../controllers/status.controller.js";

const router = express.Router();

router.post("/upload", protectRoute, uploadStatus);
router.get("/", protectRoute, getStatuses);

export default router;
