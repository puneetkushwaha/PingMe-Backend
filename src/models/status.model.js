import mongoose from "mongoose";

const statusSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String, // Can be text or image URL
        },
        type: {
            type: String,
            enum: ["text", "image"],
            required: true,
        },
        backgroundColor: {
            type: String, // For text statuses
            default: "#111b21",
        },
        views: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: [],
            },
        ],
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            index: { expires: 0 }, // TTL index
        },
    },
    { timestamps: true }
);

const Status = mongoose.model("Status", statusSchema);

export default Status;
