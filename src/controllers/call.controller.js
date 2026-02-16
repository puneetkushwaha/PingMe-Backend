import Call from "../models/call.model.js";
import User from "../models/user.model.js";

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
        const { receiverId, type, status, duration } = req.body;
        const callerId = req.user._id;

        const newCall = new Call({
            callerId,
            receiverId,
            type,
            status, // 'completed', 'missed', 'rejected'
            duration,
        });

        await newCall.save();

        res.status(201).json(newCall);
    } catch (error) {
        console.error("Error in logCall:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
