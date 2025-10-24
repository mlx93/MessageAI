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
    // Get unembedded messages
    const snapshot = await db.collection("messages")
      .where("embedded", "==", false)
      .limit(100)
      .get();

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
      return {
        id: doc.id,
        values: response.data[i].embedding,
        metadata: {
          userId: data.userId,
          conversationId: data.conversationId,
          timestamp: data.timestamp,
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
