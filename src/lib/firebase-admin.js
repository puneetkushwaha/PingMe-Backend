import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read service account credentials
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../../firebase-credentials.json'), 'utf8')
);

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'connectly-7ut07'
    });
}

/**
 * Send push notification to user via FCM
 * @param {string[]} fcmTokens - Array of FCM tokens for the user's devices
 * @param {object} messageData - Data to send in notification
 */
export const sendPushNotification = async (fcmTokens, messageData) => {
    if (!fcmTokens || fcmTokens.length === 0) {
        console.log('No FCM tokens available for user');
        return;
    }

    const { senderName, messageText, senderId, isGroup } = messageData;

    const message = {
        notification: {
            title: isGroup ? `New message in group` : `New message from ${senderName}`,
            body: messageText || 'Sent a file'
        },
        data: {
            chatId: String(senderId), // Convert to string - Firebase requires string values only
            click_action: '/'
        }
    };

    try {
        // Send to multiple tokens
        const results = await admin.messaging().sendEachForMulticast({
            tokens: fcmTokens,
            ...message
        });

        console.log(`Successfully sent ${results.successCount} notifications`);

        if (results.failureCount > 0) {
            console.log(`Failed to send ${results.failureCount} notifications`);
            results.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Error sending to token ${fcmTokens[idx]}:`, resp.error);
                }
            });
        }

        return results;
    } catch (error) {
        console.error('Error sending FCM notification:', error);
        throw error;
    }
};

export default admin;
