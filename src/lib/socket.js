import { Server } from "socket.io";
import http from "http";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

const app = express();
const server = http.createServer(app);

// In-memory store of userId -> socketId mapping

// In-memory store of userId -> socketId mapping
const userSocketMap = {};

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", process.env.CLIENT_URL, process.env.WEB_URL, "https://ping-me-web-chi.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Helper function to get receiver's socket id
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    console.log("🟢 User ID set:", userId);
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // --- Pairing Logic (Instant Code Generation) ---
  const isPairing = socket.handshake.query.isPairing === "true";
  if (isPairing) {
    const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(`pairing:${pairingCode}`);
    socket.emit("pairing:code", { pairingCode });
    console.log(`📡 Auto-generated Pairing code: ${pairingCode} for socket: ${socket.id}`);
  }

  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId: userId });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { senderId: userId });
    }
  });

  socket.on("markMessagesAsSeen", async ({ senderId }) => {
    try {
      if (!userId || !senderId) return;

      const [currentUser, senderUser] = await Promise.all([
        User.findById(userId),
        User.findById(senderId)
      ]);

      // ✅ Privacy Enforcement: Read Receipts
      // If either user has disabled read receipts, we don't update status to "seen" or emit event
      if (currentUser?.privacy?.readReceipts === false || senderUser?.privacy?.readReceipts === false) {
        return;
      }

      // Update all messages from senderId to current user (userId)
      await Message.updateMany(
        { senderId, receiverId: userId, status: { $ne: "seen" } },
        { status: "seen" }
      );

      const senderSocketId = getReceiverSocketId(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesSeen", { receiverId: userId });
      }
    } catch (error) {
      console.error("Error in markMessagesAsSeen:", error);
    }
  });

  // --- Calling Signaling ---
  socket.on("call:user", async ({ to, offer, type }) => {
    // Check if 'to' is a group
    const group = await Group.findById(to);

    if (group) {
      // Group calling: Notify all online members except the caller
      group.members.forEach(memberId => {
        if (memberId.toString() !== userId) {
          const receiverSocketId = getReceiverSocketId(memberId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:incoming", { from: userId, offer, type, isGroup: true, groupId: to });
          }
        }
      });
    } else {
      // Direct calling
      const receiverSocketId = getReceiverSocketId(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:incoming", { from: userId, offer, type });
      }

      // ALWAYS send FCM notification for calls to ensure the phone rings
      try {
        const receiver = await User.findById(to);
        if (receiver && receiver.fcmTokens && receiver.fcmTokens.length > 0) {
          const { sendPushNotification } = await import("./firebase-admin.js");
          const sender = await User.findById(userId);

          await sendPushNotification(receiver.fcmTokens, {
            senderName: sender.fullName,
            senderId: userId,
            type: 'call',
            callType: type,
            offer: offer
          });
          console.log(`Sent call FCM notification to ${receiver.fullName}`);
        }
      } catch (error) {
        console.error("Failed to send call FCM notification:", error);
      }
    }
  });

  socket.on("call:accepted", ({ to, ans }) => {
    const senderSocketId = getReceiverSocketId(to);
    if (senderSocketId) {
      io.to(senderSocketId).emit("call:connected", { from: userId, ans });
    }
  });

  socket.on("call:rejected", ({ to }) => {
    const senderSocketId = getReceiverSocketId(to);
    if (senderSocketId) {
      io.to(senderSocketId).emit("call:rejected", { from: userId });
    }
  });

  socket.on("ice:candidate", ({ to, candidate }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("ice:candidate", { from: userId, candidate });
    }
  });

  socket.on("call:ended", async ({ to }) => {
    // If it's a group, we might want to notify others, but for now 1-to-1 P2P logic is used once connected
    const group = await Group.findById(to);
    if (group) {
      group.members.forEach(memberId => {
        if (memberId.toString() !== userId) {
          const receiverSocketId = getReceiverSocketId(memberId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:ended", { from: userId });
          }
        }
      });
    } else {
      const receiverSocketId = getReceiverSocketId(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:ended", { from: userId });
      }
    }
  });

  socket.on("disconnect", async () => {
    console.log("❌ A user disconnected:", socket.id);

    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];

      // Update last seen
      try {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { lastSeen });
        // Inform others about the disconnect time
        io.emit("userOffline", { userId, lastSeen });
      } catch (err) {
        console.error("Error updating lastSeen:", err);
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
