import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";

// In-memory store for temporary pairing tokens
const pairingTokens = new Map();

export const signup = async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  try {
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const userExists = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (userExists) {
      const message = userExists.email === email ? "Email already exists" : "Phone number already exists";
      return res.status(400).json({ message });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        profilePic: newUser.profilePic,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body; // 'email' here is used as the general identifier
  try {
    const user = await User.findOne({
      $or: [{ email: email }, { phone: email }]
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, fullName, about, phone } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (about) updateData.about = about;
    if (phone) updateData.phone = phone;

    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      updateData.profilePic = uploadResponse.secure_url;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    // If deviceId is provided, update its lastActiveAt
    const { deviceId } = req.query;
    if (deviceId) {
      const user = req.user;
      const deviceIndex = user.linkedDevices.findIndex(d => d.deviceId === deviceId);

      if (deviceIndex > -1) {
        user.linkedDevices[deviceIndex].lastActiveAt = new Date();
        await user.save();
      }
    }

    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const toggleArchive = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    const isArchived = user.archivedChats.includes(targetUserId);

    if (isArchived) {
      await User.findByIdAndUpdate(userId, { $pull: { archivedChats: targetUserId } });
      res.status(200).json({ message: "Chat unarchived", archivedChats: user.archivedChats.filter(id => id !== targetUserId) });
    } else {
      await User.findByIdAndUpdate(userId, { $addToSet: { archivedChats: targetUserId } });
      res.status(200).json({ message: "Chat archived", archivedChats: [...user.archivedChats, targetUserId] });
    }
  } catch (error) {
    console.log("Error in toggleArchive:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const toggleStar = async (req, res) => {
  try {
    const { messageId } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    const isStarred = user.starredMessages.includes(messageId);

    if (isStarred) {
      await User.findByIdAndUpdate(userId, { $pull: { starredMessages: messageId } });
      res.status(200).json({ message: "Message unstarred", starredMessages: user.starredMessages.filter(id => id !== messageId) });
    } else {
      await User.findByIdAndUpdate(userId, { $addToSet: { starredMessages: messageId } });
      res.status(200).json({ message: "Message starred", starredMessages: [...user.starredMessages, messageId] });
    }
  } catch (error) {
    console.log("Error in toggleStar:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const pairDevice = async (req, res) => {
  try {
    const { pairingCode } = req.body;
    const userId = req.user._id;

    if (!pairingCode) return res.status(400).json({ message: "Pairing code is required" });

    // Generate a temporary token to send via socket
    const pairingToken = Math.random().toString(36).substring(2, 15);
    pairingTokens.set(pairingToken, userId);

    // Notify the waiting web instance
    io.to(`pairing:${pairingCode}`).emit("pairing:authorized", { pairingToken });

    res.status(200).json({ message: "Device paired successfully" });
  } catch (error) {
    console.log("Error in pairDevice:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getLinkedDevices = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json(user.linkedDevices || []);
  } catch (error) {
    console.log("Error in getLinkedDevices:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const unlinkDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {
      $pull: { linkedDevices: { deviceId } }
    });

    res.status(200).json({ message: "Device unlinked successfully" });
  } catch (error) {
    console.log("Error in unlinkDevice:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const loginWithToken = async (req, res) => {
  try {
    const { pairingToken, deviceInfo } = req.body;
    const userId = pairingTokens.get(pairingToken);

    if (!userId) {
      return res.status(400).json({ message: "Invalid or expired pairing token" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update or add device info
    if (deviceInfo && deviceInfo.deviceId) {
      const existingDeviceIndex = user.linkedDevices.findIndex(d => d.deviceId === deviceInfo.deviceId);

      const sessionData = {
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName || "Unknown Device",
        userAgent: deviceInfo.userAgent,
        lastActiveAt: new Date(),
      };

      if (existingDeviceIndex > -1) {
        // Mongoose requires .set() or direct property modification for change tracking on array elements
        user.linkedDevices[existingDeviceIndex].lastActiveAt = new Date();
        user.linkedDevices[existingDeviceIndex].loginAt = new Date(); // Update login time too
        user.linkedDevices[existingDeviceIndex].deviceName = sessionData.deviceName;
        user.linkedDevices[existingDeviceIndex].userAgent = sessionData.userAgent;
      } else {
        user.linkedDevices.push({ ...sessionData, loginAt: new Date() });
      }
      await user.save();
    }

    // Remove token after use
    pairingTokens.delete(pairingToken);

    // Set the JWT cookie
    generateToken(userId, res);

    const { password, ...userWithoutPassword } = user.toObject();
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.log("Error in loginWithToken:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
