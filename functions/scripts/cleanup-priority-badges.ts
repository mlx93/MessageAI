/**
 * Cleanup Priority Badges Script
 * 
 * Re-evaluates all messages with priority badges using strict client-side rules.
 * Resets badges to "normal" if they don't have explicit keywords.
 * 
 * Usage: npx ts-node scripts/cleanup-priority-badges.ts
 */

import * as admin from "firebase-admin";
import * as readline from "readline";
import * as path from "path";

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: "messageai-mlx93",
  });
}

const db = admin.firestore();

// Conservative patterns matching client-side detection
const URGENT_PATTERNS = [
  /\b(URGENT|ASAP|CRITICAL|EMERGENCY|IMMEDIATE)\b/i,
  /\b(high priority|top priority|highest priority)\b/i,
  /🚨|⚠️/,
];

const IMPORTANT_PATTERNS = [
  /\b(important|priority)\b/i,
  /\b(time.?sensitive|deadline|due date)\b/i,
];

/**
 * Check if message text matches strict priority criteria
 */
function detectStrictPriority(
  text: string
): "urgent" | "important" | "normal" {
  if (!text) return "normal";

  // Check for urgent patterns
  for (const pattern of URGENT_PATTERNS) {
    if (pattern.test(text)) {
      return "urgent";
    }
  }

  // Check for important patterns
  for (const pattern of IMPORTANT_PATTERNS) {
    if (pattern.test(text)) {
      return "important";
    }
  }

  return "normal";
}

/**
 * Prompt user for confirmation
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Main cleanup function
 */
async function cleanupPriorityBadges() {
  console.log("🔍 Priority Badge Cleanup Script");
  console.log("================================\n");
  console.log("This script will:");
  console.log("1. Find all messages with priority badges (urgent/important)");
  console.log("2. Re-evaluate them using strict keyword matching");
  console.log(
    "3. Reset to 'normal' if they don't have explicit keywords\n"
  );

  try {
    // Step 1: Get all conversations
    console.log("📦 Step 1: Fetching all conversations...");
    const conversationsSnapshot = await db.collection("conversations").get();
    console.log(`   Found ${conversationsSnapshot.size} conversations\n`);

    let totalMessages = 0;
    let flaggedMessages = 0;
    const messagesToReset: Array<{
      conversationId: string;
      messageId: string;
      text: string;
      currentPriority: string;
      newPriority: string;
    }> = [];

    // Step 2: Scan all messages in all conversations
    console.log("🔍 Step 2: Scanning messages for priority badges...");

    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;

      const messagesSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .where("priority", "in", ["urgent", "important"])
        .get();

      totalMessages += messagesSnapshot.size;

      for (const msgDoc of messagesSnapshot.docs) {
        const message = msgDoc.data();
        const messageId = msgDoc.id;

        flaggedMessages++;

        // Re-evaluate with strict rules
        const strictPriority = detectStrictPriority(message.text || "");

        // If current priority doesn't match strict evaluation, mark for reset
        if (message.priority !== strictPriority) {
          messagesToReset.push({
            conversationId,
            messageId,
            text: (message.text || "").substring(0, 100),
            currentPriority: message.priority,
            newPriority: strictPriority,
          });
        }
      }
    }

    console.log(`   ✅ Scanned ${totalMessages} messages with badges`);
    console.log(
      `   ✅ Found ${flaggedMessages} messages with urgent/important badges`
    );
    console.log(
      `   ⚠️  ${messagesToReset.length} messages need to be reset\n`
    );

    // Step 3: Show preview
    if (messagesToReset.length === 0) {
      console.log("✨ All priority badges are correct! No cleanup needed.\n");
      return;
    }

    console.log("📋 Preview of messages that will be reset:");
    console.log("==========================================\n");

    messagesToReset.slice(0, 10).forEach((msg, index) => {
      console.log(`${index + 1}. "${msg.text}..."`);
      console.log(
        `   ${msg.currentPriority.toUpperCase()} → \
${msg.newPriority.toUpperCase()}`
      );
      console.log(
        `   Conv: ${msg.conversationId.substring(0, 8)}... \
Msg: ${msg.messageId.substring(0, 8)}...`
      );
      console.log("");
    });

    if (messagesToReset.length > 10) {
      console.log(
        `... and ${messagesToReset.length - 10} more messages\n`
      );
    }

    // Step 4: Confirm
    const answer = await askQuestion(
      `\n⚠️  Reset ${messagesToReset.length} messages? (yes/no): `
    );

    if (answer.toLowerCase() !== "yes") {
      console.log("\n❌ Cleanup cancelled.\n");
      return;
    }

    // Step 5: Perform cleanup
    console.log("\n🧹 Step 3: Resetting priority badges...");

    let resetCount = 0;
    const batch = db.batch();
    let batchSize = 0;
    const MAX_BATCH_SIZE = 500;

    for (const msg of messagesToReset) {
      const messageRef = db
        .collection(`conversations/${msg.conversationId}/messages`)
        .doc(msg.messageId);

      batch.update(messageRef, {
        priority: msg.newPriority,
        priorityConfidence: msg.newPriority === "normal" ? 1.0 : 0.75,
        priorityReason:
          msg.newPriority === "normal"
            ? "Reset by cleanup script - no explicit keywords"
            : "Detected by cleanup script",
        priorityDetectedAt: Date.now(),
      });

      batchSize++;
      resetCount++;

      // Commit batch if it reaches max size
      if (batchSize >= MAX_BATCH_SIZE) {
        await batch.commit();
        console.log(`   ✅ Processed ${resetCount} messages...`);
        batchSize = 0;
      }
    }

    // Commit remaining
    if (batchSize > 0) {
      await batch.commit();
    }

    console.log(`\n✅ Successfully reset ${resetCount} messages!`);
    console.log("\n📊 Summary:");
    console.log(`   Total messages scanned: ${totalMessages}`);
    console.log(`   Messages with badges: ${flaggedMessages}`);
    console.log(`   Messages reset: ${resetCount}`);
    console.log(
      `   Messages kept: ${flaggedMessages - resetCount}\n`
    );
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Run the script
cleanupPriorityBadges()
  .then(() => {
    console.log("✨ Cleanup complete!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  });

