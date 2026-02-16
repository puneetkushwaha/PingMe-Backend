import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getGroupsForUser, getGroupMessages, sendGroupMessage } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/create", protectRoute, createGroup);
router.get("/", protectRoute, getGroupsForUser);
router.get("/:id", protectRoute, getGroupMessages);
router.post("/send/:id", protectRoute, sendGroupMessage);

export default router;
