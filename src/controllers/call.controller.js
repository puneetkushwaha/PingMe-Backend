import Call from "../models/call.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

// Get call history for the current user
export const getCallHistory = async (req, res) => {
    try {
        const userId = req.user._id;

        const calls = await Call.find({
            $or: [{ callerId: userId }, { receiverId: userId }],
        })
            .populate("callerId", "fullName profilePic")
            .populate("receiverId", "fullName profilePic")
            .sort({ startedAt: -1 });

        res.status(200).json(calls);
    } catch (error) {
        console.error("Error in getCallHistory:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Log a new call
export const logCall = async (req, res) => {
    try {
        const { receiverId, type, duration } = req.body;
        const status = req.body.status || "missed"; // Default to 'missed' if not provided
        const callerId = req.user._id;

        const newCall = new Call({
            callerId,
            receiverId,
            type,
            status, // 'completed', 'missed', 'rejected'
            duration,
        });

        await newCall.save();

        // Create a Message entry for the call log
        const newMessage = new Message({
            senderId: callerId,
            receiverId,
            type: "call",
            callDetails: {
                type,
                status,
                duration
            }
        });

        const savedMessage = await newMessage.save();

        // Notify both caller and receiver via socket
        const receiverSocketId = getReceiverSocketId(receiverId);
        const callerSocketId = getReceiverSocketId(callerId);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", savedMessage);
        }
        if (callerSocketId) {
            io.to(callerSocketId).emit("newMessage", savedMessage);
        }

        res.status(201).json(newCall);
    } catch (error) {
        console.error("Error in logCall:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
