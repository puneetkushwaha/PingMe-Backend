import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows null/empty for existing users while maintaining uniqueness for others
    },
    fullName: {
      type: String,
      required: true,
    },
    about: {
      type: String,
      default: "Hey there! I am using PingMe.",
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    archivedChats: {
      type: [String], // Array of userIds
      default: [],
    },
    starredMessages: {
      type: [String], // Array of messageIds
      default: [],
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    blockedUsers: {
      type: [String], // Array of userIds
      default: [],
    },
    linkedDevices: [
      {
        deviceId: { type: String, required: true },
        deviceName: { type: String, required: true },
        userAgent: { type: String },
        loginAt: { type: Date, default: Date.now },
        lastActiveAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
