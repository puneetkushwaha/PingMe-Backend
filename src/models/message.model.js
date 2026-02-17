import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: false,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    audio: {
      type: String,
    },
    video: {
      type: String,
    },
    file: {
      type: String,
    },
    fileName: {
      type: String,
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
    contact: {
      fullName: String,
      phone: String,
      profilePic: String,
      userId: mongoose.Schema.Types.ObjectId,
    },
    type: {
      type: String,
      enum: ["text", "image", "audio", "video", "file", "location", "contact", "call"],
      default: "text",
    },
    callDetails: {
      type: { type: String, enum: ["audio", "video"] },
      status: { type: String, enum: ["completed", "missed", "rejected"] },
      duration: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
      },
    ],
    isEncrypted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
