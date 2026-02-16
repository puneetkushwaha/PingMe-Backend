import User from "../models/user.model.js";

/**
 * Save FCM token for a user
 */
export const saveFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user._id;

        if (!token) {
            return res.status(400).json({ error: "FCM token is required" });
        }

        // Add token to user's fcmTokens array if not already present
        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { fcmTokens: token } }, // $addToSet prevents duplicates
            { new: true }
        );

        res.status(200).json({ message: "FCM token saved successfully" });
    } catch (error) {
        console.error("Error saving FCM token:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Remove FCM token (on logout or token expiry)
 */
export const removeFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user._id;

        if (!token) {
            return res.status(400).json({ error: "FCM token is required" });
        }

        // Remove token from user's fcmTokens array
        await User.findByIdAndUpdate(
            userId,
            { $pull: { fcmTokens: token } },
            { new: true }
        );

        res.status(200).json({ message: "FCM token removed successfully" });
    } catch (error) {
        console.error("Error removing FCM token:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
