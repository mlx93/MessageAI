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
  private functions = getFunctions(app);
  private db = getFirestore(app);

  /**
   * Summarize a conversation thread
   */
  async summarizeThread(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<ThreadSummary> {
    const summarize = httpsCallable(this.functions, 'summarizeThread');
    const result = await summarize({conversationId, dateRange});
    return result.data as ThreadSummary;
  }

  /**
   * Extract action items from a conversation
   */
  async extractActions(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<{actionItems: ActionItem[]; count: number}> {
    const extract = httpsCallable(this.functions, 'extractActions');
    const result = await extract({conversationId, dateRange});
    return result.data as {actionItems: ActionItem[]; count: number};
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
    const search = httpsCallable(this.functions, 'smartSearch');
    const result = await search({query, filters});
    return result.data as {results: SearchResult[]; searchTime: number};
  }

  /**
   * Detect message priority
   */
  async detectPriority(
    messageText: string,
    conversationContext: {type: string; participantCount: number}
  ): Promise<PriorityDetection> {
    const detect = httpsCallable(this.functions, 'detectPriority');
    const result = await detect({messageText, conversationContext});
    return result.data as PriorityDetection;
  }

  /**
   * Extract decisions from a conversation
   */
  async extractDecisions(
    conversationId: string,
    dateRange?: {start: string; end: string}
  ): Promise<{decisions: Decision[]; count: number}> {
    const extract = httpsCallable(this.functions, 'extractDecisions');
    const result = await extract({conversationId, dateRange});
    return result.data as {decisions: Decision[]; count: number};
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
   * Mark action item as completed
   */
  async completeActionItem(itemId: string) {
    await updateDoc(doc(this.db, 'action_items', itemId), {
      status: 'completed',
      completedAt: serverTimestamp(),
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
   * Get all decisions
   */
  getAllDecisions() {
    const q = query(
      collection(this.db, 'decisions'),
      where('status', '==', 'active'),
      orderBy('madeAt', 'desc')
    );
    return {
      onSnapshot: (callback: (snapshot: any) => void) =>
        onSnapshot(q, callback),
    };
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

