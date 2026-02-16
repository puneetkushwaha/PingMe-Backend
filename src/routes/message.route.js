import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getUsersForSidebar,
  sendMessage,
  clearMessages,
  blockUser,
  reportUser,
  addReaction,
} from "../controllers/message.controller.js";

const router = express.Router();

// ✅ Get all users for sidebar (except current user)
router.get("/users", protectRoute, getUsersForSidebar);

// ✅ Get all messages with a specific user
router.get("/:id", protectRoute, getMessages);

// ✅ Send a message to a user
router.post("/send/:id", protectRoute, sendMessage);

// ✅ Clear messages with a user
router.delete("/clear/:id", protectRoute, clearMessages);

// ✅ Block/Unblock a user
router.post("/block/:id", protectRoute, blockUser);

// ✅ Report a user
router.post("/report/:id", protectRoute, reportUser);

// ✅ Add reaction to a message
router.post("/:messageId/reaction", protectRoute, addReaction);

export default router;
