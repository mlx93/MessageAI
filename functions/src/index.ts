/**
 * Cloud Functions for MessageAI MVP
 *
 * Handles push notifications for new messages
 * with smart delivery logic, phone auth OTP, and more
 */

import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";

// Initialize Firebase Admin
admin.initializeApp();

// Set global options
setGlobalOptions({maxInstances: 10});

/**
 * Generate 6-digit OTP code
 * @return {string} 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send Phone Verification Code
 *
 * For test numbers (650-555-xxxx): Always use code 123456
 * For real numbers: Generate code and store in Firestore
 * For production: Integrate Twilio to send SMS
 */
export const sendPhoneVerificationCode = onCall(async (request) => {
  const {phoneNumber} = request.data;

  if (!phoneNumber || typeof phoneNumber !== "string") {
    throw new HttpsError("invalid-argument", "Phone number is required");
  }

  // Validate E.164 format
  if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
    throw new HttpsError(
      "invalid-argument",
      "Phone number must be in E.164 format (+1XXXXXXXXXX)"
    );
  }

  try {
    // Check if this is a test phone number
    const isTestNumber = phoneNumber.startsWith("+1650555");

    let code: string;

    if (isTestNumber) {
      // Test numbers always use 123456
      code = "123456";
      console.log(`Test phone number detected: ${phoneNumber}`);
    } else {
      // Generate random 6-digit code
      code = generateOTP();

      // TODO: Send SMS via Twilio for production
      // For now, log the code (dev/testing only)
      console.log(`Generated OTP for ${phoneNumber}: ${code}`);
      console.warn(
        "SMS sending not configured. Add Twilio integration for production."
      );
    }

    // Store verification code in Firestore with 5-minute expiration
    const verificationId = admin.firestore().collection("verifications")
      .doc().id;

    await admin.firestore().doc(`verifications/${verificationId}`).set({
      phoneNumber,
      code,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + 5 * 60 * 1000 // 5 minutes
      ),
      verified: false,
    });

    console.log(
      `Verification created: ${verificationId} for ${phoneNumber}`
    );

    return {
      verificationId,
      // Return code for test numbers only (for development)
      ...(isTestNumber && {testCode: code}),
    };
  } catch (error) {
    console.error("Error sending verification code:", error);
    throw new HttpsError(
      "internal",
      "Failed to send verification code"
    );
  }
});

/**
 * Verify Phone Code
 *
 * Checks if the provided code matches the stored verification
 */
export const verifyPhoneCode = onCall(async (request) => {
  const {verificationId, code} = request.data;

  if (!verificationId || typeof verificationId !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Verification ID is required"
    );
  }

  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "Code is required");
  }

  try {
    // Get verification document
    const verificationSnap = await admin
      .firestore()
      .doc(`verifications/${verificationId}`)
      .get();

    if (!verificationSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Verification not found or expired"
      );
    }

    const verification = verificationSnap.data();
    if (!verification) {
      throw new HttpsError("internal", "Verification data is empty");
    }

    // Check if already verified
    if (verification.verified) {
      throw new HttpsError(
        "failed-precondition",
        "Code already used"
      );
    }

    // Check expiration
    const now = Date.now();
    const expiresAt = verification.expiresAt.toMillis();
    if (now > expiresAt) {
      throw new HttpsError("deadline-exceeded", "Code expired");
    }

    // Verify code
    if (verification.code !== code) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid verification code"
      );
    }

    // Mark as verified
    await verificationSnap.ref.update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `Phone verified: ${verification.phoneNumber}`
    );

    // Create or get user with this phone number
    let userId: string;
    let isNewUser = false;

    // Check if phone number already exists in usersByPhone index
    const phoneIndexSnap = await admin
      .firestore()
      .doc(`usersByPhone/${verification.phoneNumber}`)
      .get();

    if (phoneIndexSnap.exists) {
      // User exists with this phone number
      const phoneData = phoneIndexSnap.data();
      userId = phoneData?.uid;
      console.log(`Existing user found via phone index: ${userId}`);
    } else {
      // Create new user in Firestore
      const userRef = admin.firestore().collection("users").doc();
      userId = userRef.id;

      // Use batch to create user + usersByPhone index atomically
      const batch = admin.firestore().batch();

      // Create user profile
      batch.set(userRef, {
        phoneNumber: verification.phoneNumber,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        displayName: "", // To be set during profile setup
        email: "",
        firstName: "",
        lastName: "",
        initials: "?",
      });

      // Create usersByPhone index for uniqueness
      const phoneIndexRef = admin.firestore()
        .collection("usersByPhone")
        .doc(verification.phoneNumber);
      batch.set(phoneIndexRef, {
        uid: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      isNewUser = true;
      console.log(`New user created: ${userId} with phone index`);
    }

    // Create Firebase Auth user with email and phone
    // Generate a secure password that user will never need to know
    const crypto = await import("crypto");
    const securePassword = crypto.randomBytes(32).toString("hex");

    // Use phone number as email (Firebase requires email format)
    const tempEmail =
      `${verification.phoneNumber.replace(/\+/g, "")}@temp.messageai.app`;

    try {
      // First, try to find existing auth user by email or phone
      let existingAuthUser = null;

      try {
        // Try to get by UID first
        existingAuthUser = await admin.auth().getUser(userId);
        console.log(`Found existing auth user by UID: ${userId}`);
      } catch (uidError) {
        // Try to get by email
        try {
          existingAuthUser = await admin.auth().getUserByEmail(tempEmail);
          console.log(`Found existing auth user by email: ${tempEmail}`);
        } catch (emailError) {
          // Try to get by phone
          try {
            existingAuthUser = await admin.auth()
              .getUserByPhoneNumber(verification.phoneNumber);
            console.log(
              `Found existing auth user by phone: ${verification.phoneNumber}`
            );
          } catch (phoneError) {
            // No existing user found
            console.log("No existing auth user found, will create new");
          }
        }
      }

      if (existingAuthUser) {
        // Auth user exists - update it
        console.log(`Updating existing auth user: ${existingAuthUser.uid}`);

        // Save the incorrectly created UID before reassigning
        const incorrectUserId = userId;

        // Update the user with new password and ensure phone is set
        await admin.auth().updateUser(existingAuthUser.uid, {
          password: securePassword,
          phoneNumber: verification.phoneNumber,
          email: tempEmail,
        });

        // Update userId to match the existing auth user
        userId = existingAuthUser.uid;

        // Update Firestore user document to use correct UID
        if (isNewUser && incorrectUserId !== existingAuthUser.uid) {
          // Delete the incorrectly created user docs (with wrong UID)
          console.log(`Cleaning up incorrect docs:
            ${incorrectUserId} → ${existingAuthUser.uid}`);
          await admin.firestore().doc(`users/${incorrectUserId}`).delete();
          await admin.firestore()
            .doc(`usersByPhone/${verification.phoneNumber}`)
            .delete();

          // Check if user doc exists for the correct UID
          const correctUserDoc = await admin.firestore()
            .doc(`users/${existingAuthUser.uid}`)
            .get();

          if (!correctUserDoc.exists) {
            // Create user doc with correct UID
            await admin.firestore().doc(`users/${existingAuthUser.uid}`).set({
              phoneNumber: verification.phoneNumber,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              displayName: "",
              email: "",
              firstName: "",
              lastName: "",
              initials: "?",
            });

            // Create phone index with correct UID
            await admin.firestore()
              .doc(`usersByPhone/${verification.phoneNumber}`)
              .set({
                uid: existingAuthUser.uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        }

        console.log(`✅ Auth user updated successfully: ${userId}`);
      } else {
        // No existing user - create new auth user
        await admin.auth().createUser({
          uid: userId,
          email: tempEmail,
          phoneNumber: verification.phoneNumber,
          password: securePassword,
          emailVerified: true, // Auto-verify since phone is verified
        });
        console.log(`✅ Auth user created: ${userId} with email ${tempEmail}`);
      }
    } catch (authError) {
      console.error("Error managing auth user:", authError);
      throw new HttpsError(
        "internal",
        `Failed to create/update auth user: ${authError}`
      );
    }

    // Return credentials for client-side sign in
    return {
      success: true,
      userId,
      phoneNumber: verification.phoneNumber,
      email: tempEmail,
      password: securePassword,
      isNewUser,
    };
  } catch (error) {
    console.error("Error verifying code:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Failed to verify code");
  }
});

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
          console.log(`Notification ${index + 1} sent successfully`);
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

/**
 * Clean up expired verification codes
 * Runs every hour
 */
export const cleanupExpiredVerifications = onSchedule(
  "every 1 hours",
  async () => {
    const now = admin.firestore.Timestamp.now();

    try {
      const expiredSnap = await admin
        .firestore()
        .collection("verifications")
        .where("expiresAt", "<", now)
        .get();

      const batch = admin.firestore().batch();

      expiredSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (expiredSnap.docs.length > 0) {
        await batch.commit();
      }

      console.log(
        `Cleaned up ${expiredSnap.docs.length} expired verifications`
      );
    } catch (error) {
      console.error("Error cleaning expired verifications:", error);
    }
  }
);
