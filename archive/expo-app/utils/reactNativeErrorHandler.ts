import { Platform } from 'react-native';

export interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  platform: string;
  userId?: string;
}

export class ReactNativeErrorHandler {
  private static instance: ReactNativeErrorHandler;
  private errorLog: ErrorInfo[] = [];
  private maxLogSize = 50;

  private constructor() {}

  public static getInstance(): ReactNativeErrorHandler {
    if (!ReactNativeErrorHandler.instance) {
      ReactNativeErrorHandler.instance = new ReactNativeErrorHandler();
    }
    return ReactNativeErrorHandler.instance;
  }

  public logError(error: Error, errorInfo?: any, context?: string) {
    const errorEntry: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    };

    this.errorLog.unshift(errorEntry);
    
    // Keep only the last maxLogSize errors
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    console.error(`[${context || 'App'}] Error logged:`, errorEntry);
    
    // In production, you would send this to your error reporting service
    // this.sendToErrorReportingService(errorEntry);
  }

  public getErrorLog(): ErrorInfo[] {
    return this.errorLog;
  }

  public clearErrorLog() {
    this.errorLog = [];
  }

  public getRecentErrors(minutes: number = 5): ErrorInfo[] {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return this.errorLog.filter(error => 
      new Date(error.timestamp).getTime() > cutoffTime
    );
  }

  public hasRecentErrors(minutes: number = 5, threshold: number = 3): boolean {
    return this.getRecentErrors(minutes).length >= threshold;
  }

  // Method to send errors to external service (implement as needed)
  private async sendToErrorReportingService(errorInfo: ErrorInfo) {
    try {
      // Example: Send to Sentry, Bugsnag, or your own service
      // await fetch('https://your-error-service.com/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorInfo)
      // });
    } catch (error) {
      console.error('Failed to send error to reporting service:', error);
    }
  }
}

export const errorHandler = ReactNativeErrorHandler.getInstance();
