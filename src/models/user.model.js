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
    privacy: {
      lastSeen: { type: String, enum: ["everyone", "nobody"], default: "everyone" },
      profilePic: { type: String, enum: ["everyone", "nobody"], default: "everyone" },
      about: { type: String, enum: ["everyone", "nobody"], default: "everyone" },
      readReceipts: { type: Boolean, default: true },
      status: { type: String, enum: ["contacts", "except", "share"], default: "contacts" },
      statusExclude: { type: [String], default: [] }, // Array of userIds
      statusInclude: { type: [String], default: [] }, // Array of userIds
      allowSharing: { type: Boolean, default: true },
    },
    chatSettings: {
      enterIsSend: { type: Boolean, default: true },
      mediaVisibility: { type: Boolean, default: true },
      wallpaper: { type: String, default: "" },
    },
    notificationSettings: {
      showNotifications: { type: Boolean, default: true },
      showPreviews: { type: Boolean, default: true },
      notificationSound: { type: Boolean, default: true },
      selectedSound: { type: String, default: "notification.mp3" },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
