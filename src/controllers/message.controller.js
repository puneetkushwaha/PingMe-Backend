import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

// ✅ Sidebar ke liye — saare users laao aur unka last message attach karo
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    const usersWithLastMessage = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(1);

        const userData = user.toObject();

        // ✅ Privacy Enforcement: Profile Pic
        if (userData.privacy?.profilePic === "nobody") {
          userData.profilePic = "";
        }

        // ✅ Privacy Enforcement: About
        if (userData.privacy?.about === "nobody") {
          userData.about = "";
        }

        return {
          ...userData,
          lastMessage: lastMessage
            ? (lastMessage.text ||
              (lastMessage.type === "image" ? "📷 Image" :
                lastMessage.type === "audio" ? "🎤 Audio" :
                  lastMessage.type === "location" ? "📍 Location" :
                    lastMessage.type === "contact" ? "👤 Contact" :
                      lastMessage.type === "call" ? (lastMessage.callDetails?.status === "missed" ? "📞 Missed Call" : "📞 Call") :
                        "📁 File"))
            : null,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
        };
      })
    );

    // Sort users: Most recent message first, then alphabetical or others
    usersWithLastMessage.sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      }
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      return 0;
    });

    res.status(200).json(usersWithLastMessage);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Messages laao ek user ke saath
export const getMessages = async (req, res) => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Message send karo (text ya image ya dono)
export const sendMessage = async (req, res) => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user._id;
    const { text, image, audio, file, fileName, location, contact } = req.body;
    let imageUrl = null;
    let audioUrl = null;
    let fileUrl = null;
    let messageType = "text";

    if (image) {
      const uploadResult = await cloudinary.uploader.upload(image);
      imageUrl = uploadResult.secure_url;
      messageType = "image";
    } else if (audio) {
      const uploadResult = await cloudinary.uploader.upload(audio, { resource_type: "video" });
      audioUrl = uploadResult.secure_url;
      messageType = "audio";
    } else if (file) {
      const uploadResult = await cloudinary.uploader.upload(file, { resource_type: "raw" });
      fileUrl = uploadResult.secure_url;
      messageType = "file";
    } else if (location) {
      messageType = "location";
    } else if (contact) {
      messageType = "contact";
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      file: fileUrl,
      fileName: fileName,
      location,
      contact,
      type: messageType,
    });
    const savedMessage = await newMessage.save();

    // ✅ Real-time message emit using room-based emission
    // Notify the receiver's room (all their tabs/devices)
    io.to(receiverId).emit("newMessage", savedMessage);

    // ✅ ALSO notify the sender's room (so their other tabs/devices stay in sync)
    io.to(senderId.toString()).emit("newMessage", savedMessage);

    // FCM fallback only if no one is in the room? 
    // Socket.io doesn't easily tell you if a room is empty without checking set size
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (!receiverSocketId) {
      // User is offline - send FCM push notification
      const receiver = await User.findById(receiverId);
      if (receiver && receiver.fcmTokens && receiver.fcmTokens.length > 0) {
        const { sendPushNotification } = await import("../lib/firebase-admin.js");
        const sender = await User.findById(senderId);

        await sendPushNotification(receiver.fcmTokens, {
          senderName: sender.fullName,
          messageText: text || (image ? "📷 Photo" : audio ? "🎤 Voice message" : file ? `📎 ${fileName}` : "New message"),
          senderId: senderId,
          isGroup: false
        }).catch(err => console.error("FCM push failed:", err));
      }
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ Ek user ke saath saare messages delete karo
export const clearMessages = async (req, res) => {
  try {
    const receiverId = req.params.id;
    const senderId = req.user._id;

    await Message.deleteMany({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });

    res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Error in clearMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.blockedUsers) user.blockedUsers = [];

    if (user.blockedUsers.includes(id)) {
      user.blockedUsers = user.blockedUsers.filter((uid) => uid !== id);
      await user.save();
      return res.status(200).json({
        message: "User unblocked successfully",
        blockedUsers: user.blockedUsers
      });
    } else {
      user.blockedUsers.push(id);
      await user.save();
      return res.status(200).json({
        message: "User blocked successfully",
        blockedUsers: user.blockedUsers
      });
    }
  } catch (error) {
    console.error("Error in blockUser:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const reportUser = async (req, res) => {
  try {
    // For now, we'll just return a success message
    res.status(200).json({ message: "User reported successfully" });
  } catch (error) {
    console.error("Error in reportUser:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Remove existing reaction from this user if any
    message.reactions = message.reactions.filter(
      (r) => r.userId.toString() !== userId.toString()
    );

    // Add new reaction
    message.reactions.push({ userId, emoji });
    await message.save();

    // Real-time update
    const receiverId = message.senderId.toString() === userId.toString()
      ? message.receiverId
      : message.senderId;

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReaction", {
        messageId,
        reactions: message.reactions,
      });
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in addReaction:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
