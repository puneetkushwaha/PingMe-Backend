import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "cloudinary";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const createGroup = async (req, res) => {
    try {
        const { name, members, groupPic } = req.body;
        const adminId = req.user._id;

        let imageUrl = "";
        if (groupPic) {
            const uploadResponse = await cloudinary.uploader.upload(groupPic);
            imageUrl = uploadResponse.secure_url;
        }

        // Add admin to members if not already there
        const allMembers = [...new Set([...members, adminId.toString()])];

        const newGroup = new Group({
            name,
            members: allMembers,
            admin: adminId,
            groupPic: imageUrl,
        });

        await newGroup.save();

        res.status(201).json(newGroup);
    } catch (error) {
        console.error("Error in createGroup:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getGroupsForUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const groups = await Group.find({ members: userId }).populate("admin", "fullName profilePic");
        res.status(200).json(groups);
    } catch (error) {
        console.error("Error in getGroupsForUser:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getGroupMessages = async (req, res) => {
    try {
        const groupId = req.params.id;
        const messages = await Message.find({ groupId }).populate("senderId", "fullName profilePic");
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error in getGroupMessages:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendGroupMessage = async (req, res) => {
    try {
        const groupId = req.params.id;
        const senderId = req.user._id;
        const { text, image, audio, file, fileName } = req.body;
        let imageUrl = null;
        let audioUrl = null;
        let fileUrl = null;
        let messageType = "text";

        if (image) {
            const uploadResult = await cloudinary.uploader.upload(image);
            imageUrl = uploadResult.secure_url;
            messageType = "image";
        }

        if (audio) {
            const uploadResult = await cloudinary.uploader.upload(audio, { resource_type: "video" });
            audioUrl = uploadResult.secure_url;
            messageType = "audio";
        }

        if (file) {
            const uploadResult = await cloudinary.uploader.upload(file, { resource_type: "raw" });
            fileUrl = uploadResult.secure_url;
            messageType = "file";
        }

        const newMessage = new Message({
            senderId,
            groupId,
            text,
            image: imageUrl,
            audio: audioUrl,
            file: fileUrl,
            fileName: fileName,
            type: messageType,
        });

        const savedMessage = await newMessage.save();
        const populatedMessage = await savedMessage.populate("senderId", "fullName profilePic");

        // Socket.io for group members
        const group = await Group.findById(groupId);
        if (group) {
            group.members.forEach(memberId => {
                if (memberId.toString() !== senderId.toString()) {
                    const receiverSocketId = getReceiverSocketId(memberId);
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit("newMessage", populatedMessage);
                    }
                }
            });
        }

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error("Error in sendGroupMessage:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
