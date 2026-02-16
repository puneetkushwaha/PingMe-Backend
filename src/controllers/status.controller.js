import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";

export const uploadStatus = async (req, res) => {
    try {
        const { type, content, backgroundColor } = req.body;
        const userId = req.user._id;

        let finalContent = content;
        if (type === "image") {
            const uploadResponse = await cloudinary.uploader.upload(content);
            finalContent = uploadResponse.secure_url;
        }

        const newStatus = new Status({
            userId,
            type,
            content: finalContent,
            backgroundColor,
        });

        await newStatus.save();
        res.status(201).json(newStatus);
    } catch (error) {
        console.error("Error in uploadStatus:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getStatuses = async (req, res) => {
    try {
        // Get statuses from followed users or all users (for this clone, let's say all users for now)
        // and filter those that haven't expired (though TTL index handles deletion, double check)
        const statuses = await Status.find({
            expiresAt: { $gt: new Date() },
        }).populate("userId", "fullName profilePic");

        // Group statuses by user
        const groupedStatuses = statuses.reduce((acc, status) => {
            const userId = status.userId._id.toString();
            if (!acc[userId]) {
                acc[userId] = {
                    user: status.userId,
                    statuses: [],
                };
            }
            acc[userId].statuses.push(status);
            return acc;
        }, {});

        res.status(200).json(Object.values(groupedStatuses));
    } catch (error) {
        console.error("Error in getStatuses:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
