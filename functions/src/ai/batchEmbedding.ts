import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {getOpenAIClient, openaiKey} from "../utils/openai";
import {getIndex, pineconeKey} from "../utils/pinecone";

// Scheduled function to embed messages every 30 seconds
export const batchEmbedMessages = onSchedule({
  schedule: "*/1 * * * *", // Every minute
  secrets: [openaiKey, pineconeKey],
  memory: "2GiB",
  timeoutSeconds: 300,
}, async () => {
  const db = admin.firestore();

  try {
    // Get unembedded messages from all conversation subcollections
    const conversationsSnapshot = await db.collection("conversations").get();
    const allUnembeddedMessages: admin.firestore.QueryDocumentSnapshot[] = [];

    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      const messagesSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .where("embedded", "==", false)
        .limit(50) // Limit per conversation to avoid timeout
        .get();

      // Add conversationId to each message doc's data if not present
      const messagesWithConvId = messagesSnapshot.docs.map((doc) => {
        const data = doc.data();
        if (!data.conversationId) {
          // Add conversationId if missing
          doc.ref.update({conversationId});
        }
        return doc;
      });

      allUnembeddedMessages.push(...messagesWithConvId);

      if (allUnembeddedMessages.length >= 100) break; // Total limit
    }

    const snapshot = {
      docs: allUnembeddedMessages.slice(0, 100),
      size: allUnembeddedMessages.length,
      empty: allUnembeddedMessages.length === 0,
    };

    if (snapshot.empty) {
      console.log("No messages to embed");
      return;
    }

    console.log(`Embedding ${snapshot.size} messages`);

    // Generate embeddings
    const openai = getOpenAIClient();
    const texts = snapshot.docs.map((doc) => doc.data().text);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: texts,
    });

    // Get unique conversation IDs and fetch their participants
    const uniqueConversationIds = [...new Set(
      snapshot.docs.map((doc) => {
        // Get conversation ID from doc path or data
        const data = doc.data();
        return data.conversationId || doc.ref.parent.parent?.id || "";
      })
        .filter((id) => id && id.length > 0) // Filter out undefined/empty IDs
    )];

    const conversationParticipants: Record<string, string[]> = {};
    console.log(`Found ${uniqueConversationIds.length} unique conversations`);

    await Promise.all(
      uniqueConversationIds.map(async (convId) => {
        if (!convId) return; // Skip if no conversation ID
        try {
          const convDoc = await db.collection("conversations")
            .doc(convId).get();
          const participants = convDoc.exists ?
            convDoc.data()?.participants || [] : [];
          conversationParticipants[convId] = participants;

          if (participants.length === 0) {
            console.warn(`⚠️ Conversation ${convId} has no participants`);
          }
        } catch (error) {
          console.error(`Error fetching conversation ${convId}:`, error);
          conversationParticipants[convId] = [];
        }
      })
    );

    // Prepare vectors for Pinecone
    const vectors = snapshot.docs.map((doc, i) => {
      const data = doc.data();
      // Get conversation ID from doc path if not in data
      const conversationId = data.conversationId ||
        doc.ref.parent.parent?.id || "";
      const participants = conversationParticipants[conversationId] || [];

      // Convert Firestore Timestamp to number if needed
      let timestampValue = data.timestamp;
      if (timestampValue && typeof timestampValue === "object" &&
          "_seconds" in timestampValue) {
        // Firestore Timestamp object
        timestampValue = timestampValue._seconds * 1000 +
          Math.floor((timestampValue._nanoseconds || 0) / 1000000);
      }

      return {
        id: doc.id,
        values: response.data[i].embedding,
        metadata: {
          // Kept for backward compatibility
          userId: data.senderId || data.userId,
          senderId: data.senderId || data.userId, // Who sent the message
          participants, // All users who can access this message
          conversationId,
          timestamp: timestampValue,
          sender: data.senderName || data.sender || "Unknown",
          text: data.text.substring(0, 500), // Preview only
        },
      };
    });

    // Upsert to Pinecone
    const index = getIndex();
    await index.upsert(vectors);

    // Mark as embedded in Firestore
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        embedded: true,
        embeddedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    console.log(`✅ Embedded ${snapshot.size} messages`);
  } catch (error) {
    console.error("Batch embedding error:", error);
  }
});

// Trigger to mark new messages for embedding
export const markMessageForEmbedding = onDocumentCreated({
  document: "conversations/{conversationId}/messages/{messageId}",
  memory: "256MiB",
}, async (event) => {
  const message = event.data?.data();
  if (!message || !message.text) return;

  try {
    // Mark message as needing embedding
    await event.data?.ref.update({
      embedded: false,
    });

    console.log(
      `Marked message ${event.params.messageId} for embedding`
    );
  } catch (error) {
    console.error("Error marking message for embedding:", error);
  }
});
