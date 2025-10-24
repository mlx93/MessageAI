import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

export interface AIError {
  code: string;
  message: string;
  userFriendlyMessage: string;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * Enhanced error handler for AI features
 * Provides user-friendly error messages and handles offline scenarios
 */
export class AIErrorHandler {
  /**
   * Handle an error from AI services
   */
  static async handleError(error: any, context: string): Promise<AIError> {
    // Check network status first
    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;

    if (isOffline) {
      return {
        code: 'OFFLINE',
        message: 'No internet connection',
        userFriendlyMessage: 'AI features require an internet connection. Please check your network and try again.',
        recoverable: true,
        retryable: true,
      };
    }

    // Parse error based on type
    if (error?.code === 'functions/deadline-exceeded' || error?.message?.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out',
        userFriendlyMessage: 'The AI is taking longer than usual. This might be due to high server load. Please try again.',
        recoverable: true,
        retryable: true,
      };
    }

    if (error?.code === 'functions/resource-exhausted' || error?.message?.includes('rate limit')) {
      return {
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        userFriendlyMessage: 'You have made too many AI requests. Please wait a moment and try again.',
        recoverable: true,
        retryable: true,
      };
    }

    if (error?.code === 'functions/permission-denied' || error?.code === 'permission-denied') {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
        userFriendlyMessage: 'You do not have permission to access this AI feature. Please sign in again.',
        recoverable: false,
        retryable: false,
      };
    }

    if (error?.code === 'functions/unauthenticated' || error?.code === 'unauthenticated') {
      return {
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated',
        userFriendlyMessage: 'Your session has expired. Please sign in again.',
        recoverable: false,
        retryable: false,
      };
    }

    if (error?.message?.includes('quota') || error?.message?.includes('insufficient_quota')) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: 'AI service quota exceeded',
        userFriendlyMessage: 'AI features are temporarily unavailable. Please try again later.',
        recoverable: true,
        retryable: true,
      };
    }

    if (error?.message?.includes('model') || error?.message?.includes('not found')) {
      return {
        code: 'MODEL_ERROR',
        message: 'AI model error',
        userFriendlyMessage: 'There is an issue with the AI service. Our team has been notified.',
        recoverable: false,
        retryable: false,
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN',
      message: error?.message || 'Unknown error',
      userFriendlyMessage: 'Something went wrong with the AI feature. Please try again.',
      recoverable: true,
      retryable: true,
    };
  }

  /**
   * Show an error alert to the user
   */
  static showErrorAlert(
    error: AIError,
    onRetry?: () => void,
    context?: string
  ) {
    const title = this.getErrorTitle(error.code);
    const message = error.userFriendlyMessage;

    const buttons: any[] = [];

    if (error.retryable && onRetry) {
      buttons.push({
        text: 'Try Again',
        onPress: onRetry,
      });
    }

    buttons.push({
      text: 'OK',
      style: 'cancel',
    });

    Alert.alert(title, message, buttons);
  }

  /**
   * Get a user-friendly error title
   */
  private static getErrorTitle(code: string): string {
    switch (code) {
      case 'OFFLINE':
        return 'No Internet Connection';
      case 'TIMEOUT':
        return 'Request Timeout';
      case 'RATE_LIMIT':
        return 'Too Many Requests';
      case 'PERMISSION_DENIED':
        return 'Access Denied';
      case 'UNAUTHENTICATED':
        return 'Authentication Required';
      case 'QUOTA_EXCEEDED':
        return 'Service Unavailable';
      case 'MODEL_ERROR':
        return 'AI Service Error';
      default:
        return 'Error';
    }
  }

  /**
   * Check if AI features are available
   */
  static async checkAIAvailability(): Promise<{
    available: boolean;
    reason?: string;
  }> {
    try {
      // Check network
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return {
          available: false,
          reason: 'No internet connection. AI features require an active connection.',
        };
      }

      // Check if network is slow
      if (netInfo.details && 'cellularGeneration' in netInfo.details) {
        const generation = netInfo.details.cellularGeneration;
        if (generation === '2g') {
          return {
            available: false,
            reason: 'Your connection is too slow. AI features may not work properly on 2G.',
          };
        }
      }

      return { available: true };
    } catch (error) {
      return {
        available: false,
        reason: 'Unable to check network status.',
      };
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const parsedError = await this.handleError(error, 'retry');

        // Don't retry if not retryable
        if (!parsedError.retryable) {
          throw error;
        }

        // Check if still offline
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

/**
 * Wrapper for AI service calls with error handling
 */
export async function withAIErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  options?: {
    showAlert?: boolean;
    onRetry?: () => void;
    retries?: number;
  }
): Promise<T | null> {
  try {
    // Check availability first
    const { available, reason } = await AIErrorHandler.checkAIAvailability();
    if (!available) {
      if (options?.showAlert) {
        Alert.alert('AI Feature Unavailable', reason || 'Please try again later.');
      }
      return null;
    }

    // Execute with retry logic if retries specified
    if (options?.retries && options.retries > 0) {
      return await AIErrorHandler.retryWithBackoff(fn, options.retries);
    }

    return await fn();
  } catch (error) {
    const parsedError = await AIErrorHandler.handleError(error, context);

    console.error(`[AIError] ${context}:`, {
      code: parsedError.code,
      message: parsedError.message,
    });

    if (options?.showAlert) {
      AIErrorHandler.showErrorAlert(parsedError, options.onRetry, context);
    }

    return null;
  }
}

export default AIErrorHandler;

