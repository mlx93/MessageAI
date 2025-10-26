import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {openai} from "@ai-sdk/openai";
import {generateText} from "ai";
import {openaiKey} from "../utils/openai";

interface PriorityDetectionRequest {
  messageText: string;
  conversationContext: {
    type: string;
    participantCount: number;
  };
}

interface PriorityDetectionResponse {
  priority: "urgent" | "important" | "normal";
  confidence: number;
  reason: string;
  detectedAt: number;
}

export const detectPriority = onCall({
  secrets: [openaiKey],
  memory: "1GiB",
  timeoutSeconds: 30,
}, async (request) => {
  const {messageText, conversationContext} =
    request.data as PriorityDetectionRequest;

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!messageText || !conversationContext) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Analyze message priority for team communication.

Message: "${messageText}"
Context: ${conversationContext.type} conversation with \
${conversationContext.participantCount} people

Determine priority level:
- URGENT: Production issues, blocking problems, \
  explicit urgency (ASAP, CRITICAL)
- IMPORTANT: Direct questions, time-sensitive, \
  needs response today
- NORMAL: FYI, can wait, no immediate action needed

Consider:
- Urgency keywords
- Direct @mentions
- Questions to specific people
- Time pressure indicators
- Conversation context

Reply in this exact format:
Priority: [urgent|important|normal]
Confidence: [0-1]
Reason: [brief explanation]`,
    });

    // Parse result
    const lines = result.text.split("\n");
    const priority = lines[0].split(":")[1].trim() as
      "urgent" | "important" | "normal";
    const confidence = parseFloat(lines[1].split(":")[1].trim());
    const reason = lines[2].split(":")[1].trim();

    const response: PriorityDetectionResponse = {
      priority,
      confidence,
      reason,
      detectedAt: Date.now(),
    };

    return response;
  } catch (error) {
    console.error("Priority detection error:", error);
    throw new HttpsError("internal", "Failed to detect priority");
  }
});

// In-memory cache for priority detection (5-minute TTL)
interface CacheEntry {
  result: {
    priority: string;
    confidence: number;
    reason: string;
  };
  timestamp: number;
}

const priorityCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Automatic priority detection on message creation
export const detectPriorityOnMessage = onDocumentCreated({
  document: "conversations/{conversationId}/messages/{messageId}",
  region: "us-central1", // Match Firestore location for minimal latency
  secrets: [openaiKey],
  memory: "512MiB", // Optimized for speed
  timeoutSeconds: 10, // Quick timeout
  minInstances: 1, // Eliminate cold starts
}, async (event) => {
  const message = event.data?.data();
  if (!message || !message.text) return;

  try {
    // Check cache first
    const cacheKey = message.text.substring(0, 200); // Cache by first 200 chars
    const cached = priorityCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(
        `✨ Cache hit for message priority: ${cached.result.priority}`
      );
      await event.data?.ref.update({
        priority: cached.result.priority,
        priorityConfidence: cached.result.confidence,
        priorityReason: cached.result.reason,
        priorityDetectedAt: Date.now(),
      });
      return;
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Analyze message priority. BE CONSERVATIVE - only tag as \
urgent/important if explicit keywords present.

Message: "${message.text}"
Context: ${message.type || "dm"} conversation

Priority levels:
- URGENT: Must have explicit keywords like "URGENT", "ASAP", \
"CRITICAL", "EMERGENCY", "IMMEDIATE"
- IMPORTANT: Must have explicit keywords like "important", "priority", \
"high priority"
- NORMAL: Everything else (default)

Reply in this exact format:
Priority: [urgent|important|normal]
Confidence: [0-1]
Reason: [brief explanation]`,
    });

    // Parse result
    const lines = result.text.split("\n");
    const priority = lines[0].split(":")[1].trim();
    const confidence = parseFloat(lines[1].split(":")[1].trim());
    const reason = lines[2].split(":")[1].trim();

    // Cache the result
    priorityCache.set(cacheKey, {
      result: {priority, confidence, reason},
      timestamp: Date.now(),
    });

    // Clean up old cache entries (prevent memory leak)
    if (priorityCache.size > 1000) {
      const now = Date.now();
      for (const [key, entry] of priorityCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
          priorityCache.delete(key);
        }
      }
    }

    // Update message with priority
    await event.data?.ref.update({
      priority,
      priorityConfidence: confidence,
      priorityReason: reason,
      priorityDetectedAt: Date.now(),
    });

    console.log(
      `Priority detected for message ${event.params.messageId}: \
${priority} (confidence: ${confidence})`
    );
  } catch (error) {
    console.error("Auto priority detection error:", error);
    // Don't throw - we don't want to fail message creation
  }
});

