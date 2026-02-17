import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin with either file or environment variables
let serviceAccount;
try {
    const credPath = join(__dirname, '../../firebase-credentials.json');
    serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
} catch (error) {
    console.warn('⚠️ firebase-credentials.json not found or invalid. Checking environment variables...');
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e) {
            console.error('❌ FIREBASE_SERVICE_ACCOUNT env var is invalid JSON');
        }
    }
}

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || 'connectly-7ut07'
        });
        console.log('✅ Firebase Admin initialized successfully');
    } else {
        console.error('❌ Firebase Admin FAILED to initialize: No credentials found.');
    }
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

    const { senderName, messageText, senderId, isGroup, type = 'message' } = messageData;

    const isCall = type === 'call';
    const notificationTitle = isCall
        ? `Incoming ${messageData.callType || 'video'} call from ${senderName}`
        : (isGroup ? `New message in group` : `New message from ${senderName}`);

    const message = {
        notification: {
            title: notificationTitle,
            body: isCall ? 'Tap to answer' : (messageText || 'Sent a file')
        },
        data: {
            chatId: String(senderId),
            type: type,
            callType: messageData.callType || 'audio',
            callerName: senderName,
            offer: messageData.offer ? JSON.stringify(messageData.offer) : '',
            click_action: '/'
        },
        android: {
            priority: isCall ? 'high' : 'normal',
            notification: {
                sound: 'default',
                channelId: 'default',
                priority: isCall ? 'high' : 'default'
            }
        },
        webpush: {
            headers: {
                Urgency: isCall ? 'high' : 'normal'
            },
            notification: {
                requireInteraction: isCall,
                vibrate: [200, 100, 200, 100, 200],
                silent: false,
                tag: isCall ? 'incoming-call' : 'new-message'
            },
            fcmOptions: {
                link: '/'
            }
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
