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
      const messagesSnapshot = await db
        .collection(`conversations/${convDoc.id}/messages`)
        .where("embedded", "==", false)
        .limit(50) // Limit per conversation to avoid timeout
        .get();

      allUnembeddedMessages.push(...messagesSnapshot.docs);

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

    // Prepare vectors for Pinecone
    const vectors = snapshot.docs.map((doc, i) => {
      const data = doc.data();
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
          userId: data.userId,
          conversationId: data.conversationId,
          timestamp: timestampValue,
          sender: data.sender,
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
