/**
 * Cloud Functions for MessageAI MVP
 *
 * Handles push notifications for new messages
 * with smart delivery logic
 */

import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";

// Initialize Firebase Admin
admin.initializeApp();

// Set global options
setGlobalOptions({maxInstances: 10});

/**
 * Send push notification when a new message is created
 *
 * Trigger: Firestore onCreate for messages
 * Smart logic: Only notifies users not currently
 * viewing the conversation
 */
export const sendMessageNotification = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    try {
      const message = event.data?.data();
      if (!message) {
        console.log("No message data");
        return;
      }

      const conversationId = event.params.conversationId;
      const messageId = event.params.messageId;

      console.log(
        `New message ${messageId} in conversation ${conversationId}`
      );

      // Get conversation details
      const conversationSnap = await admin
        .firestore()
        .doc(`conversations/${conversationId}`)
        .get();

      if (!conversationSnap.exists) {
        console.log("Conversation not found");
        return;
      }

      const conversation = conversationSnap.data();
      if (!conversation) {
        console.log("Conversation data is empty");
        return;
      }

      // Get recipients (all participants except sender)
      const recipients = conversation.participants.filter(
        (id: string) => id !== message.senderId
      );

      console.log(`Recipients: ${recipients.join(", ")}`);

      // Check who's actively viewing this conversation
      const activeUsers: string[] = [];
      for (const userId of recipients) {
        const activeSnap = await admin
          .firestore()
          .doc(`activeConversations/${userId}`)
          .get();

        if (activeSnap.exists) {
          const activeData = activeSnap.data();
          if (
            activeData &&
            activeData.conversationId === conversationId
          ) {
            activeUsers.push(userId);
            console.log(
              `User ${userId} is actively viewing conversation`
            );
          }
        }
      }

      // Users to notify (not actively viewing)
      const usersToNotify = recipients.filter(
        (id: string) => !activeUsers.includes(id)
      );

      console.log(`Users to notify: ${usersToNotify.join(", ")}`);

      // Send notifications
      const notifications: Promise<string>[] = [];

      for (const userId of usersToNotify) {
        const userSnap = await admin
          .firestore()
          .doc(`users/${userId}`)
          .get();

        if (!userSnap.exists) {
          console.log(`User ${userId} not found`);
          continue;
        }

        const userData = userSnap.data();
        if (!userData) {
          console.log(`User ${userId} data is empty`);
          continue;
        }

        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
          console.log(`User ${userId} has no FCM token`);
          continue;
        }

        // Get sender name
        const senderSnap = await admin
          .firestore()
          .doc(`users/${message.senderId}`)
          .get();
        const senderData = senderSnap.data();
        const senderName = senderData?.displayName || "Someone";

        // Prepare notification payload
        let notificationTitle = senderName;
        let notificationBody = message.text || "New message";

        // For group chats, include group context
        if (conversation.type === "group") {
          const details = conversation.participantDetails;
          const groupName = conversation.participants
            .filter((id: string) => id !== userId)
            .map((id: string) => details[id]?.displayName || "Unknown")
            .slice(0, 3)
            .join(", ");
          notificationTitle = `${senderName} to ${groupName}`;
        }

        // Handle image messages
        if (message.type === "image") {
          notificationBody = "📷 Image";
        }

        // Send notification
        console.log(
          `Sending notification to ${userId}: ${notificationTitle}`
        );

        const notificationPromise = admin.messaging().send({
          token: fcmToken,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: {
            conversationId: conversationId,
            messageId: messageId,
            senderId: message.senderId,
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              priority: "high",
            },
          },
        });

        notifications.push(notificationPromise);
      }

      // Wait for all notifications to be sent
      const results = await Promise.allSettled(notifications);

      // Log results
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`Notification ${index + 1} sent`);
        } else {
          console.error(
            `Notification ${index + 1} failed:`,
            result.reason
          );
        }
      });

      const successCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      console.log(`Sent ${successCount} notifications`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
);

/**
 * Clean up old typing indicators
 * Runs every 5 minutes to remove stale typing status
 */
export const cleanupTypingIndicators = onSchedule(
  "every 5 minutes",
  async () => {
    const now = admin.firestore.Timestamp.now();
    const fiveMinutesAgo = new Date(
      now.toMillis() - 5 * 60 * 1000
    );

    try {
      // Get all conversations
      const conversationsSnap = await admin
        .firestore()
        .collection("conversations")
        .get();

      let cleaned = 0;

      for (const convDoc of conversationsSnap.docs) {
        const typingSnap = await admin
          .firestore()
          .collection(`conversations/${convDoc.id}/typing`)
          .where("timestamp", "<", fiveMinutesAgo)
          .get();

        const batch = admin.firestore().batch();

        typingSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
          cleaned++;
        });

        if (typingSnap.docs.length > 0) {
          await batch.commit();
        }
      }

      console.log(`Cleaned up ${cleaned} old typing indicators`);
    } catch (error) {
      console.error("Error cleaning typing indicators:", error);
    }
  }
);
