import { DatabaseError, DatabaseErrorType, ErrorSeverity } from '../types';
import { Logger } from '../utils/Logger';

export class ErrorHandler {
  private logger: Logger;
  private errorHistory: DatabaseError[] = [];
  private maxErrorHistory: number = 100;

  // User-friendly error messages
  private readonly ERROR_MESSAGES: Record<DatabaseErrorType, string> = {
    [DatabaseErrorType.CONNECTION_LOST]: "Database temporarily unavailable. Please try again in a moment.",
    [DatabaseErrorType.QUERY_FAILED]: "Unable to process your request. Please try again.",
    [DatabaseErrorType.SCHEMA_MISMATCH]: "System is updating. Please wait a moment and try again.",
    [DatabaseErrorType.TRANSACTION_FAILED]: "Operation could not be completed. No changes were made.",
    [DatabaseErrorType.CORRUPTION_DETECTED]: "Data integrity issue detected. System is recovering automatically.",
    [DatabaseErrorType.BACKUP_FAILED]: "Backup operation failed. Data is still safe but please contact an administrator.",
    [DatabaseErrorType.MIGRATION_FAILED]: "System update failed. Please contact an administrator."
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handle a database error with comprehensive logging and user-friendly messaging
   */
  public handleError(
    error: Error, 
    errorType: DatabaseErrorType, 
    context?: {
      query?: string;
      parameters?: any[];
      command?: string;
      user?: string;
    }
  ): { userMessage: string; errorId: string } {
    const errorId = this.generateErrorId();
    const severity = this.classifyErrorSeverity(errorType, error);
    
    // Create detailed error record
    const dbError: DatabaseError = {
      id: errorId,
      timestamp: new Date(),
      errorType,
      severity,
      sqliteCode: this.extractSQLiteCode(error),
      message: error.message,
      query: context?.query,
      parameters: context?.parameters,
      stackTrace: error.stack || '',
      resolved: false,
      retryCount: 0
    };

    // Add to error history
    this.addToErrorHistory(dbError);

    // Log detailed technical information
    this.logTechnicalDetails(dbError, context);

    // Return user-friendly message
    const userMessage = this.getUserFriendlyMessage(errorType, severity);
    
    return { userMessage, errorId };
  }

  /**
   * Get user-friendly error message
   */
  public getUserFriendlyMessage(errorType: DatabaseErrorType, severity?: ErrorSeverity): string {
    const baseMessage = this.ERROR_MESSAGES[errorType] || "An unexpected error occurred. Please try again.";
    
    if (severity === ErrorSeverity.CRITICAL) {
      return `${baseMessage} If this problem persists, please contact support immediately.`;
    } else if (severity === ErrorSeverity.HIGH) {
      return `${baseMessage} Please contact an administrator if this continues.`;
    }
    
    return baseMessage;
  }

  /**
   * Classify error severity based on type and error details
   */
  public classifyErrorSeverity(errorType: DatabaseErrorType, error?: Error): ErrorSeverity {
    // Check error message for specific patterns
    if (error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('corrupt') || message.includes('malformed')) {
        return ErrorSeverity.CRITICAL;
      }
      
      if (message.includes('disk full') || message.includes('no space')) {
        return ErrorSeverity.CRITICAL;
      }
    }

    // Default severity based on error type
    switch (errorType) {
      case DatabaseErrorType.CORRUPTION_DETECTED:
        return ErrorSeverity.CRITICAL;
      
      case DatabaseErrorType.MIGRATION_FAILED:
      case DatabaseErrorType.BACKUP_FAILED:
        return ErrorSeverity.HIGH;
      
      case DatabaseErrorType.CONNECTION_LOST:
      case DatabaseErrorType.TRANSACTION_FAILED:
        return ErrorSeverity.MEDIUM;
      
      case DatabaseErrorType.QUERY_FAILED:
      case DatabaseErrorType.SCHEMA_MISMATCH:
        return ErrorSeverity.LOW;
      
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Check if an error is retryable
   */
  public isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    const retryablePatterns = [
      'database is locked',
      'database is busy',
      'disk i/o error',
      'temporary failure',
      'connection lost',
      'sqlite_busy',
      'sqlite_locked',
      'sqlite_ioerr'
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<DatabaseErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: DatabaseError[];
  } {
    const errorsByType = {} as Record<DatabaseErrorType, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(DatabaseErrorType).forEach(type => {
      errorsByType[type] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    this.errorHistory.forEach(error => {
      errorsByType[error.errorType]++;
      errorsBySeverity[error.severity]++;
    });

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: this.errorHistory.slice(-10) // Last 10 errors
    };
  }

  /**
   * Mark an error as resolved
   */
  public markErrorResolved(errorId: string): boolean {
    const error = this.errorHistory.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      this.logger.info(`Error ${errorId} marked as resolved`);
      return true;
    }
    return false;
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    const clearedCount = this.errorHistory.length;
    this.errorHistory = [];
    this.logger.info(`Cleared ${clearedCount} errors from history`);
  }

  /**
   * Get errors by severity
   */
  public getErrorsBySeverity(severity: ErrorSeverity): DatabaseError[] {
    return this.errorHistory.filter(error => error.severity === severity);
  }

  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractSQLiteCode(error: Error): string | undefined {
    const match = error.message.match(/SQLITE_(\w+)/);
    return match ? match[0] : undefined;
  }

  private addToErrorHistory(error: DatabaseError): void {
    this.errorHistory.push(error);
    
    // Maintain maximum history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
  }

  private logTechnicalDetails(error: DatabaseError, context?: any): void {
    const logContext = {
      command: context?.command,
      user: context?.user,
      error: new Error(error.message),
      metadata: {
        errorId: error.id,
        errorType: error.errorType,
        severity: error.severity,
        sqliteCode: error.sqliteCode,
        query: error.query,
        parameters: error.parameters
      }
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`CRITICAL DATABASE ERROR: ${error.message}`, logContext);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`High severity database error: ${error.message}`, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`Database error: ${error.message}`, logContext);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(`Minor database error: ${error.message}`, logContext);
        break;
    }

    // Log stack trace for debugging if in debug mode
    if (this.logger.isDebugMode() && error.stackTrace) {
      this.logger.debug('Error stack trace:', { metadata: { stackTrace: error.stackTrace } });
    }
  }
}