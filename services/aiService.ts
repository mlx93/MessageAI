import {getFunctions, httpsCallable} from 'firebase/functions';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {app} from './firebase';
import {withAIErrorHandling} from './aiErrorHandler';

export interface SearchResult {
  messageId: string;
  score: number;
  text: string;
  sender: string;
  timestamp: number;
  conversationId: string;
  conversationName?: string;
  conversationType?: "direct" | "group";
  isContext?: boolean;
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
  participantIds?: string[];
  decisionMaker?: string;
  decisionMakerId?: string;
  messageIds: string[];
  confidence: number;
  conversationId: string;
  madeAt: number;
  status: 'active' | 'superseded' | 'reversed';
}

export type ProactiveSuggestionType =
  | 'meeting'
  | 'reminder'
  | 'context'
  | 'deadline_conflict'
  | 'decision_conflict'
  | 'overdue_action'
  | 'context_gap'
  | 'escalation';

export type ProactiveSuggestionPriority = 'high' | 'medium' | 'low';

export interface ProactiveSuggestionAction {
  label: string;
  action: string;
}

export interface ProactiveSuggestion {
  id: string;
  conversationId: string;
  message: string;
  type: ProactiveSuggestionType;
  priority?: ProactiveSuggestionPriority;
  confidence?: number;
  actions?: ProactiveSuggestionAction[];
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
  private functions = getFunctions(app);
  private db = getFirestore(app);

  /**
   * Summarize a conversation thread
   */
  async summarizeThread(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<ThreadSummary | null> {
    return withAIErrorHandling(
      async () => {
        const summarize = httpsCallable(this.functions, 'summarizeThread');
        const result = await summarize({conversationId, dateRange});
        return result.data as ThreadSummary;
      },
      'summarizeThread',
      {showAlert: true, retries: 2}
    );
  }

  /**
   * Extract action items from a conversation
   */
  async extractActions(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<{actionItems: ActionItem[]; count: number} | null> {
    return withAIErrorHandling(
      async () => {
        const extract = httpsCallable(this.functions, 'extractActions');
        const result = await extract({conversationId, dateRange});
        return result.data as {actionItems: ActionItem[]; count: number};
      },
      'extractActions',
      {showAlert: true, retries: 2}
    );
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
  ): Promise<{results: SearchResult[]; searchTime: number} | null> {
    return withAIErrorHandling(
      async () => {
        const search = httpsCallable(this.functions, 'smartSearch');
        const result = await search({query, filters});
        return result.data as {results: SearchResult[]; searchTime: number};
      },
      'smartSearch',
      {showAlert: true, retries: 2}
    );
  }

  /**
   * Chat with Ava using semantic search to answer questions
   */
  async avaSearchChat(
    userQuery: string,
    conversationHistory?: Array<{role: 'user' | 'assistant'; content: string}>
  ): Promise<{
    answer: string;
    intent: 'search' | 'summarize' | 'general';
    sources?: SearchResult[];
  } | null> {
    return withAIErrorHandling(
      async () => {
        const chat = httpsCallable(this.functions, 'avaSearchChat');
        const result = await chat({userQuery, conversationHistory});
        return result.data as {
          answer: string;
          intent: 'search' | 'summarize' | 'general';
          sources?: SearchResult[];
        };
      },
      'avaSearchChat',
      {showAlert: false, retries: 1}
    );
  }

  /**
   * Detect message priority
   */
  async detectPriority(
    messageText: string,
    conversationContext: {type: string; participantCount: number}
  ): Promise<PriorityDetection | null> {
    return withAIErrorHandling(
      async () => {
        const detect = httpsCallable(this.functions, 'detectPriority');
        const result = await detect({messageText, conversationContext});
        return result.data as PriorityDetection;
      },
      'detectPriority',
      {showAlert: false, retries: 1} // Don't show alert for priority, retry once
    );
  }

  /**
   * Extract decisions from a conversation
   */
  async extractDecisions(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<{decisions: Decision[]; count: number} | null> {
    return withAIErrorHandling(
      async () => {
        const extract = httpsCallable(this.functions, 'extractDecisions');
        const result = await extract({conversationId, dateRange});
        return result.data as {decisions: Decision[]; count: number};
      },
      'extractDecisions',
      {showAlert: true, retries: 2}
    );
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
    const agent = httpsCallable(this.functions, 'proactiveAgent');
    const result = await agent({conversationId, recentMessages, trigger});
    return result.data as any;
  }

  /**
   * Get action items for a conversation
   */
  getActionItems(conversationId: string) {
    const q = query(
      collection(this.db, 'action_items'),
      where('conversationId', '==', conversationId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    return {
      limit: (limitNum: number) => ({
        onSnapshot: (callback: (snapshot: any) => void) =>
          onSnapshot(query(q, firestoreLimit(limitNum)), callback),
      }),
      onSnapshot: (callback: (snapshot: any) => void) =>
        onSnapshot(q, callback),
    };
  }

  /**
   * Get all action items for the user
   */
  getAllActionItems() {
    const q = query(
      collection(this.db, 'action_items'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    return {
      onSnapshot: (callback: (snapshot: any) => void) =>
        onSnapshot(q, callback),
    };
  }

  /**
   * Get action items assigned to a specific user
   */
  getUserActionItems(userId: string) {
    const q = query(
      collection(this.db, 'action_items'),
      where('status', '==', 'pending'),
      where('assigneeId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return {
      onSnapshot: (callback: (snapshot: any) => void) =>
        onSnapshot(q, callback),
    };
  }

  /**
   * Mark action item as completed
   */
  async completeActionItem(itemId: string) {
    await updateDoc(doc(this.db, 'action_items', itemId), {
      status: 'completed',
      completedAt: serverTimestamp(),
    });
  }

  /**
   * Delete an action item
   */
  async deleteActionItem(itemId: string) {
    await updateDoc(doc(this.db, 'action_items', itemId), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
    });
  }

  /**
   * Get decisions for a conversation
   */
  getDecisions(conversationId: string) {
    const q = query(
      collection(this.db, 'decisions'),
      where('conversationId', '==', conversationId),
      where('status', '==', 'active'),
      orderBy('madeAt', 'desc')
    );
    return {
      onSnapshot: (callback: (snapshot: any) => void) =>
        onSnapshot(q, callback),
    };
  }

  /**
   * Get all decisions for user's conversations
   */
  getAllDecisions() {
    const q = query(
      collection(this.db, 'decisions'),
      where('status', '==', 'active'),
      orderBy('madeAt', 'desc')
    );
    return {
      onSnapshot: (callback: (snapshot: any) => void) => {
        return onSnapshot(q, (snapshot) => {
          console.log(`📊 Decisions snapshot: ${snapshot.size} active decisions`);
          callback(snapshot);
        });
      },
    };
  }

  /**
   * Delete a single decision
   */
  async deleteDecision(decisionId: string): Promise<{success: boolean; message: string} | null> {
    return withAIErrorHandling(
      async () => {
        const deleteFunc = httpsCallable(this.functions, 'deleteDecision');
        const result = await deleteFunc({decisionId});
        return result.data as {success: boolean; message: string};
      },
      'deleteDecision',
      {showAlert: false, retries: 1}
    );
  }

  /**
   * Bulk delete decisions
   */
  async bulkDeleteDecisions(decisionIds: string[]): Promise<{success: boolean; deletedCount: number; message: string} | null> {
    return withAIErrorHandling(
      async () => {
        const deleteFunc = httpsCallable(this.functions, 'bulkDeleteDecisions');
        const result = await deleteFunc({decisionIds});
        return result.data as {success: boolean; deletedCount: number; message: string};
      },
      'bulkDeleteDecisions',
      {showAlert: true, retries: 1}
    );
  }

  /**
   * Mark a decision as deleted
   */
  async deleteDecision(decisionId: string) {
    await updateDoc(doc(this.db, 'decisions', decisionId), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
    });
  }

  /**
   * Get proactive suggestions for a conversation
   */
  getProactiveSuggestions(conversationId: string) {
    const q = query(
      collection(this.db, 'proactive_suggestions'),
      where('conversationId', '==', conversationId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    return {
      onSnapshot: (callback: (snapshot: any) => void) =>
        onSnapshot(q, callback),
    };
  }

  /**
   * Accept a proactive suggestion
   */
  async acceptSuggestion(suggestionId: string) {
    await updateDoc(doc(this.db, 'proactive_suggestions', suggestionId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    });
  }

  /**
   * Dismiss a proactive suggestion
   */
  async dismissSuggestion(suggestionId: string) {
    await updateDoc(doc(this.db, 'proactive_suggestions', suggestionId), {
      status: 'dismissed',
      dismissedAt: serverTimestamp(),
    });
  }
}

export default new AIService();

