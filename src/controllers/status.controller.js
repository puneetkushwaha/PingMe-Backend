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
        const statuses = await Status.find({
            expiresAt: { $gt: new Date() },
        })
            .populate("userId", "fullName profilePic")
            .populate("views.userId", "fullName profilePic");

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

export const viewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const status = await Status.findById(id);
        if (!status) return res.status(404).json({ error: "Status not found" });

        // Don't add if user is the owner
        if (status.userId.toString() === userId.toString()) {
            return res.status(200).json({ message: "Owner cannot view their own status" });
        }

        // Add user to views if not already present
        const hasViewed = status.views.some(view => view.userId.toString() === userId.toString());
        if (!hasViewed) {
            status.views.push({ userId, viewedAt: new Date() });
            await status.save();
        }

        res.status(200).json({ message: "Status viewed" });
    } catch (error) {
        console.error("Error in viewStatus:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
