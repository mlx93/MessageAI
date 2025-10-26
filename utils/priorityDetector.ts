/**
 * Client-side priority detection for instant feedback
 * Provides immediate visual feedback while AI refinement happens in background
 * 
 * Trade-offs:
 * - Speed: <1ms regex matching vs 1-3s AI call
 * - Accuracy: ~70-80% vs ~85-90% with AI
 * - User Experience: Instant badge appearance with background refinement
 */

export interface PriorityResult {
  priority: 'urgent' | 'important' | 'normal';
  confidence: number;
  reason: string;
  isClientDetected: boolean; // Flag to indicate this is preliminary
}

// Urgency patterns (HIGH confidence) - STRICT: Explicit keywords only
const URGENT_PATTERNS = [
  /\b(URGENT|ASAP|CRITICAL|EMERGENCY|IMMEDIATE)\b/i,
  /\b(high priority|top priority|highest priority)\b/i,
  /🚨|⚠️/, // Warning symbols only (removed fire emoji)
];

// Important patterns (MEDIUM confidence) - STRICT: Explicit keywords only
const IMPORTANT_PATTERNS = [
  /\b(important|priority)\b/i,
  /\b(time.?sensitive|deadline|due date)\b/i,
];

// Normal indicators (LOW urgency) - Thanks, FYI, casual
const NORMAL_INDICATORS = [
  /^(thanks|thank you|got it|sounds good|ok|okay|sure|np|no problem|cool|awesome|great)/i,
  /\b(FYI|for your information|heads up|btw|by the way|just so you know)\b/i,
  /\b(later|tomorrow|next week|whenever|no rush|when you have time|eventually)/i,
  /👍|✅|😊|😄|🎉|👌/, // Positive emojis
  /\b(noted|acknowledged|received|seen)\b/i,
];

/**
 * Detect message priority using client-side keyword patterns
 * Runs synchronously in <1ms for instant feedback
 * 
 * @param messageText - The message text to analyze
 * @param conversationContext - Optional context about the conversation
 * @returns PriorityResult with preliminary priority classification
 */
export function detectPriorityClientSide(
  messageText: string, 
  conversationContext?: {
    type: string;
    participantCount: number;
  }
): PriorityResult {
  const text = messageText.trim();
  
  // Empty messages are normal priority
  if (!text) {
    return {
      priority: 'normal',
      confidence: 1.0,
      reason: 'Empty message',
      isClientDetected: true,
    };
  }
  
  // Check for urgent patterns (highest priority)
  for (const pattern of URGENT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        priority: 'urgent',
        confidence: 0.75, // Client-side gets max 0.75 confidence
        reason: 'Urgent keywords detected',
        isClientDetected: true,
      };
    }
  }
  
  // Check for important patterns - at least one must match
  for (const pattern of IMPORTANT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        priority: 'important',
        confidence: 0.70,
        reason: 'Important keyword detected',
        isClientDetected: true,
      };
    }
  }
  
  // Check for normal indicators (explicit low priority)
  for (const pattern of NORMAL_INDICATORS) {
    if (pattern.test(text)) {
      return {
        priority: 'normal',
        confidence: 0.65,
        reason: 'Low urgency detected',
        isClientDetected: true,
      };
    }
  }
  
  // Default to normal with low confidence (will be refined by AI)
  return {
    priority: 'normal',
    confidence: 0.4,
    reason: 'No clear priority signals',
    isClientDetected: true,
  };
}

/**
 * Batch detect priorities for multiple messages
 * Useful for analyzing conversation history
 */
export function detectPrioritiesBatch(messages: Array<{ text: string }>): PriorityResult[] {
  return messages.map(msg => detectPriorityClientSide(msg.text));
}

/**
 * Get human-readable explanation of priority
 */
export function explainPriority(result: PriorityResult): string {
  const confidencePercent = Math.round(result.confidence * 100);
  
  if (result.priority === 'urgent') {
    return `🔴 Urgent (${confidencePercent}% confidence): ${result.reason}`;
  } else if (result.priority === 'important') {
    return `🟡 Important (${confidencePercent}% confidence): ${result.reason}`;
  } else {
    return `Normal priority (${confidencePercent}% confidence)`;
  }
}

