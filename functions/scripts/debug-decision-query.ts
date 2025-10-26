/**
 * Debug script to investigate why deduplication is comparing against deleted decisions
 * 
 * This script will:
 * 1. Query for all decisions in the conversation (including deleted)
 * 2. Query for only active decisions in the conversation
 * 3. Show what the deduplication logic would actually see
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require("../serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const CONVERSATION_ID = "Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm";

async function debugDecisionQuery() {
  console.log("=".repeat(80));
  console.log("DECISION QUERY DEBUG");
  console.log("=".repeat(80));
  console.log(`Conversation ID: ${CONVERSATION_ID}\n`);

  // Query 1: ALL decisions in this conversation
  console.log("--- Query 1: ALL decisions (no status filter) ---");
  const allDecisions = await db.collection("decisions")
    .where("conversationId", "==", CONVERSATION_ID)
    .get();
  
  console.log(`Found ${allDecisions.size} total decisions\n`);
  
  allDecisions.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`[${index + 1}] ID: ${doc.id}`);
    console.log(`    Decision: ${data.decision?.slice(0, 80) || "N/A"}...`);
    console.log(`    Status: ${data.status || "N/A"}`);
    console.log(`    Confidence: ${data.confidence || 0}`);
    console.log(`    Has Embedding: ${data.embedding ? "YES" : "NO"}`);
    console.log(`    Created: ${data.createdAt?.toDate?.() || "N/A"}`);
    console.log("");
  });

  // Query 2: ACTIVE decisions only (what deduplication uses)
  console.log("\n--- Query 2: ACTIVE decisions only (deduplication query) ---");
  const activeDecisions = await db.collection("decisions")
    .where("conversationId", "==", CONVERSATION_ID)
    .where("status", "==", "active")
    .get();
  
  console.log(`Found ${activeDecisions.size} active decisions\n`);
  
  if (activeDecisions.size === 0) {
    console.log("❌ NO ACTIVE DECISIONS FOUND");
    console.log("   This means deduplication should NOT find any existing decisions to compare against!");
    console.log("   If logs show 'Found semantic duplicate', there's a bug in the query logic.\n");
  } else {
    activeDecisions.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`[${index + 1}] ID: ${doc.id}`);
      console.log(`    Decision: ${data.decision?.slice(0, 80) || "N/A"}...`);
      console.log(`    Status: ${data.status || "N/A"}`);
      console.log(`    Confidence: ${data.confidence || 0}`);
      console.log(`    Has Embedding: ${data.embedding ? "YES" : "NO"}`);
      console.log("");
    });
  }

  // Query 3: Check for any "Meet" decisions with active status anywhere in database
  console.log("\n--- Query 3: ALL 'Meet' decisions with active status ---");
  const meetDecisions = await db.collection("decisions")
    .where("status", "==", "active")
    .get();
  
  const meetFiltered = meetDecisions.docs.filter(doc => 
    doc.data().decision?.toLowerCase().includes("meet")
  );
  
  console.log(`Found ${meetFiltered.length} active 'Meet' decisions across all conversations\n`);
  
  meetFiltered.forEach((doc, index) => {
    const data = doc.data();
    console.log(`[${index + 1}] ID: ${doc.id}`);
    console.log(`    Decision: ${data.decision?.slice(0, 80) || "N/A"}...`);
    console.log(`    Conversation: ${data.conversationId || "N/A"}`);
    console.log(`    Confidence: ${data.confidence || 0}`);
    console.log(`    Match: ${data.conversationId === CONVERSATION_ID ? "SAME CONV ✓" : "Different conv"}`);
    console.log("");
  });

  console.log("=".repeat(80));
  console.log("ANALYSIS:");
  console.log("=".repeat(80));
  
  if (activeDecisions.size === 0 && allDecisions.size > 0) {
    console.log("✅ Query is working correctly - no active decisions found");
    console.log("❌ BUT logs show duplicate was found - this is a BUG");
    console.log("\nPossible causes:");
    console.log("1. Firestore query caching issue");
    console.log("2. Race condition - status changed after query");
    console.log("3. Query executed on wrong collection/index");
    console.log("4. Logging is misleading (comparing against different decision)");
    console.log("\nNext steps:");
    console.log("1. Add logging to show decision ID being compared against");
    console.log("2. Add logging to show status of 'existing' decision in comparison");
    console.log("3. Consider adding explicit status check in comparison loop");
  }

  console.log("=".repeat(80));
}

// Run the debug function
debugDecisionQuery()
  .then(() => {
    console.log("\nDebug complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

