import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorContext {
  screen?: string;
  action?: string;
  timestamp: string;
  userId?: string;
  userAgent?: string;
}

export class ErrorRecovery {
  private static instance: ErrorRecovery;
  private errorHistory: Array<ErrorContext & { error: string }> = [];
  private maxErrorHistory = 10;

  private constructor() {}

  public static getInstance(): ErrorRecovery {
    if (!ErrorRecovery.instance) {
      ErrorRecovery.instance = new ErrorRecovery();
    }
    return ErrorRecovery.instance;
  }

  public logError(error: Error, context: ErrorContext) {
    const errorEntry = {
      ...context,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    this.errorHistory.unshift(errorEntry);
    
    // Keep only the last maxErrorHistory errors
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(0, this.maxErrorHistory);
    }

    console.error('Error logged:', errorEntry);
  }

  public getErrorHistory() {
    return this.errorHistory;
  }

  public clearErrorHistory() {
    this.errorHistory = [];
  }

  public async clearAppData() {
    try {
      // Clear AsyncStorage except for essential data
      const keys = await AsyncStorage.getAllKeys();
      const essentialKeys = ['hasSeenOnboarding']; // Keep onboarding status
      
      const keysToRemove = keys.filter(key => !essentialKeys.includes(key));
      await AsyncStorage.multiRemove(keysToRemove);
      
      console.log('App data cleared successfully');
      return true;
    } catch (error) {
      console.error('Failed to clear app data:', error);
      return false;
    }
  }

  public async resetToDefaults() {
    try {
      // Clear all AsyncStorage data
      await AsyncStorage.clear();
      
      // Clear error history
      this.clearErrorHistory();
      
      console.log('App reset to defaults successfully');
      return true;
    } catch (error) {
      console.error('Failed to reset app to defaults:', error);
      return false;
    }
  }

  public shouldShowRecoveryOptions(): boolean {
    // Show recovery options if there have been multiple errors recently
    const recentErrors = this.errorHistory.filter(
      error => new Date(error.timestamp).getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );
    
    return recentErrors.length >= 3;
  }

  public getRecoverySuggestions(): string[] {
    const suggestions: string[] = [];
    
    if (this.shouldShowRecoveryOptions()) {
      suggestions.push('Clear app data and restart');
      suggestions.push('Check your internet connection');
      suggestions.push('Restart the app');
    }
    
    return suggestions;
  }
}

export const errorRecovery = ErrorRecovery.getInstance();

// Utility function to wrap async operations with error recovery
export const withErrorRecovery = async <T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    errorRecovery.logError(error as Error, context);
    throw error;
  }
};
