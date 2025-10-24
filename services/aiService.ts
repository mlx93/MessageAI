import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';

export interface SearchResult {
  messageId: string;
  score: number;
  text: string;
  sender: string;
  timestamp: number;
  conversationId: string;
}

export interface ActionItem {
  task: string;
  assignee: string | null;
  deadline: string | null;
  context: string;
  messageId: string;
  confidence: number;
  conversationId: string;
  status: 'pending' | 'completed';
  createdAt: any;
}

export interface Decision {
  decision: string;
  rationale: string;
  alternativesConsidered: string[];
  participants: string[];
  messageIds: string[];
  confidence: number;
  conversationId: string;
  madeAt: number;
  status: 'active' | 'superseded' | 'reversed';
}

export interface ProactiveSuggestion {
  id: string;
  conversationId: string;
  message: string;
  type: 'meeting' | 'reminder' | 'context';
  actions: Array<{label: string; action: string}>;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: any;
}

export interface ThreadSummary {
  summary: string;
  messageCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  generatedAt: number;
}

export interface PriorityDetection {
  priority: 'urgent' | 'important' | 'normal';
  confidence: number;
  reason: string;
  detectedAt: number;
}

class AIService {
  /**
   * Summarize a conversation thread
   */
  async summarizeThread(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<ThreadSummary> {
    const summarize = functions().httpsCallable('summarizeThread');
    const result = await summarize({conversationId, dateRange});
    return result.data;
  }

  /**
   * Extract action items from a conversation
   */
  async extractActions(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<{actionItems: ActionItem[]; count: number}> {
    const extract = functions().httpsCallable('extractActions');
    const result = await extract({conversationId, dateRange});
    return result.data;
  }

  /**
   * Smart search across conversations using RAG
   */
  async smartSearch(
    query: string,
    filters?: {
      conversationId?: string;
      dateRange?: {start: string; end: string};
    }
  ): Promise<{results: SearchResult[]; searchTime: number}> {
    const search = functions().httpsCallable('smartSearch');
    const result = await search({query, filters});
    return result.data;
  }

  /**
   * Detect message priority
   */
  async detectPriority(
    messageText: string,
    conversationContext: {type: string; participantCount: number}
  ): Promise<PriorityDetection> {
    const detect = functions().httpsCallable('detectPriority');
    const result = await detect({messageText, conversationContext});
    return result.data;
  }

  /**
   * Extract decisions from a conversation
   */
  async extractDecisions(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<{decisions: Decision[]; count: number}> {
    const extract = functions().httpsCallable('extractDecisions');
    const result = await extract({conversationId, dateRange});
    return result.data;
  }

  /**
   * Trigger proactive agent
   */
  async triggerProactiveAgent(
    conversationId: string,
    recentMessages: Array<{sender: string; text: string}>,
    trigger: string
  ): Promise<{
    agentResponse: string;
    toolsUsed: string[];
    triggered: boolean;
    processingTime: number;
  }> {
    const agent = functions().httpsCallable('proactiveAgent');
    const result = await agent({conversationId, recentMessages, trigger});
    return result.data;
  }

  /**
   * Get action items for a conversation
   */
  getActionItems(conversationId: string) {
    return firestore()
      .collection('action_items')
      .where('conversationId', '==', conversationId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc');
  }

  /**
   * Get all action items for the user
   */
  getAllActionItems() {
    return firestore()
      .collection('action_items')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc');
  }

  /**
   * Mark action item as completed
   */
  async completeActionItem(itemId: string) {
    await firestore().collection('action_items').doc(itemId).update({
      status: 'completed',
      completedAt: firestore.FieldValue.serverTimestamp(),
    });
  }

  /**
   * Get decisions for a conversation
   */
  getDecisions(conversationId: string) {
    return firestore()
      .collection('decisions')
      .where('conversationId', '==', conversationId)
      .where('status', '==', 'active')
      .orderBy('madeAt', 'desc');
  }

  /**
   * Get all decisions
   */
  getAllDecisions() {
    return firestore()
      .collection('decisions')
      .where('status', '==', 'active')
      .orderBy('madeAt', 'desc');
  }

  /**
   * Get proactive suggestions for a conversation
   */
  getProactiveSuggestions(conversationId: string) {
    return firestore()
      .collection('proactive_suggestions')
      .where('conversationId', '==', conversationId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc');
  }

  /**
   * Accept a proactive suggestion
   */
  async acceptSuggestion(suggestionId: string) {
    await firestore()
      .collection('proactive_suggestions')
      .doc(suggestionId)
      .update({
        status: 'accepted',
        acceptedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Dismiss a proactive suggestion
   */
  async dismissSuggestion(suggestionId: string) {
    await firestore()
      .collection('proactive_suggestions')
      .doc(suggestionId)
      .update({
        status: 'dismissed',
        dismissedAt: firestore.FieldValue.serverTimestamp(),
      });
  }
}

export default new AIService();

