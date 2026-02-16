import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCallHistory, logCall } from "../controllers/call.controller.js";

const router = express.Router();

router.get("/", protectRoute, getCallHistory);
router.post("/log", protectRoute, logCall);

export default router;
