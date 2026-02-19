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
    socket.join(userId); // ✅ Join a room named after userId
    console.log(`🟢 User ${userId} joined room ${userId}`);
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
    // ✅ Emit to the receiver's room instead of specific socketId
    io.to(receiverId).emit("typing", { senderId: userId });
  });

  socket.on("stopTyping", ({ receiverId }) => {
    // ✅ Emit to the receiver's room instead of specific socketId
    io.to(receiverId).emit("stopTyping", { senderId: userId });
  });

  socket.on("markMessagesAsSeen", async ({ senderId }) => {
    try {
      if (!userId || !senderId) return;

      const [currentUser, senderUser] = await Promise.all([
        User.findById(userId),
        User.findById(senderId)
      ]);

      // ✅ Privacy Enforcement: Read Receipts
      if (currentUser?.privacy?.readReceipts === false || senderUser?.privacy?.readReceipts === false) {
        return;
      }

      // Update all messages from senderId to current user (userId)
      await Message.updateMany(
        { senderId, receiverId: userId, status: { $ne: "seen" } },
        { status: "seen" }
      );

      // ✅ Notify the sender room
      io.to(senderId).emit("messagesSeen", { receiverId: userId });
    } catch (error) {
      console.error("Error in markMessagesAsSeen:", error);
    }
  });

  // --- Calling Signaling ---
  socket.on("call:user", async ({ to, offer, type }) => {
    const group = await Group.findById(to);

    if (group) {
      group.members.forEach(memberId => {
        if (memberId.toString() !== userId) {
          io.to(memberId.toString()).emit("call:incoming", { from: userId, offer, type, isGroup: true, groupId: to });
        }
      });
    } else {
      io.to(to).emit("call:incoming", { from: userId, offer, type });

      // FCM logic
      try {
        console.log(`📡 [CALL] Processing FCM for user ${to} (from ${userId})`);
        const receiver = await User.findById(to);
        const sender = await User.findById(userId);

        if (!receiver) {
          console.error(`❌ [CALL] Receiver ${to} not found in DB`);
          return;
        }

        if (receiver.fcmTokens && receiver.fcmTokens.length > 0) {
          const { sendPushNotification } = await import("./firebase-admin.js");

          console.log(`🔔 [CALL] Sending FCM to ${receiver.fullName} (${receiver.fcmTokens.length} tokens)`);

          await sendPushNotification(receiver.fcmTokens, {
            senderName: sender.fullName,
            senderId: userId,
            type: 'call',
            callType: type,
            offer: offer
          });
          console.log(`✅ [CALL] FCM sent to ${receiver.fullName}`);
        } else {
          console.warn(`⚠️ [CALL] No FCM tokens for user ${receiver.fullName} (${to})`);
        }
      } catch (error) {
        console.error("❌ [CALL] Failed to send FCM notification:", error);
      }
    }
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:connected", { from: userId, ans });
  });

  socket.on("call:rejected", ({ to }) => {
    io.to(to).emit("call:rejected", { from: userId });
  });

  socket.on("ice:candidate", ({ to, candidate }) => {
    io.to(to).emit("ice:candidate", { from: userId, candidate });
  });

  socket.on("call:ended", async ({ to }) => {
    const group = await Group.findById(to);
    if (group) {
      group.members.forEach(memberId => {
        if (memberId.toString() !== userId) {
          io.to(memberId.toString()).emit("call:ended", { from: userId });
        }
      });
    } else {
      io.to(to).emit("call:ended", { from: userId });
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
        io.emit("userOffline", { userId, lastSeen });
      } catch (err) {
        console.error("Error updating lastSeen:", err);
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
