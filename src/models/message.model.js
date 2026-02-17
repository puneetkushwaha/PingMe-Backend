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
      enum: ["text", "image", "audio", "video", "file", "location", "contact"],
      default: "text",
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
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
