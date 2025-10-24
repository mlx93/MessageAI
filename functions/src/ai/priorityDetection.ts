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

// Automatic priority detection on message creation
export const detectPriorityOnMessage = onDocumentCreated({
  document: "conversations/{conversationId}/messages/{messageId}",
  secrets: [openaiKey],
  memory: "1GiB",
}, async (event) => {
  const message = event.data?.data();
  if (!message || !message.text) return;

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Analyze message priority for team communication.

Message: "${message.text}"
Context: ${message.type || "dm"} conversation

Determine priority level:
- URGENT: Production issues, blocking problems, \
  explicit urgency (ASAP, CRITICAL)
- IMPORTANT: Direct questions, time-sensitive, \
  needs response today
- NORMAL: FYI, can wait, no immediate action needed

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

    // Update message with priority
    await event.data?.ref.update({
      priority,
      priorityConfidence: confidence,
      priorityReason: reason,
      priorityDetectedAt: Date.now(),
    });

    console.log(
      `Priority detected for message ${event.params.messageId}: \
${priority}`
    );
  } catch (error) {
    console.error("Auto priority detection error:", error);
    // Don't throw - we don't want to fail message creation
  }
});

