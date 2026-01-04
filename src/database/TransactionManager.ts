import Database from 'better-sqlite3';
import { ConnectionManager } from './ConnectionManager';
import { RetryConfig, DatabaseErrorType, ErrorSeverity } from '../types';
import { Logger } from '../utils/Logger';

export class TransactionManager {
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private retryConfig: RetryConfig;

  constructor(connectionManager: ConnectionManager, logger: Logger, retryConfig?: RetryConfig) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.retryConfig = retryConfig || {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2.0
    };
  }

  /**
   * Execute a function within a database transaction
   * Automatically handles rollback on failure and retry logic
   */
  public async executeTransaction<T>(operation: () => T): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const db = this.connectionManager.getDatabase();
        const transaction = db.transaction(operation);
        
        this.logger.debug('Starting database transaction', { 
          metadata: { attempt, maxAttempts: this.retryConfig.maxAttempts } 
        });

        const result = transaction();
        
        const executionTime = Date.now() - startTime;
        this.connectionManager.updateQueryMetrics(executionTime, true);
        
        this.logger.debug('Transaction completed successfully', {
          metadata: { executionTime, attempt }
        });

        return result;

      } catch (error) {
        lastError = error as Error;
        const executionTime = Date.now() - startTime;
        this.connectionManager.updateQueryMetrics(executionTime, false);

        this.logger.warn(`Transaction attempt ${attempt}/${this.retryConfig.maxAttempts} failed`, {
          error: lastError,
          metadata: { attempt, executionTime }
        });

        // Check if this is a retryable error
        if (!this.isRetryableError(lastError) || attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay for next attempt
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );

        this.logger.debug(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All attempts failed
    this.logger.error('Transaction failed after all retry attempts', {
      error: lastError!,
      metadata: { 
        totalAttempts: this.retryConfig.maxAttempts,
        totalTime: Date.now() - startTime
      }
    });

    throw new Error(`Transaction failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Execute a function with retry logic but without explicit transaction
   * Useful for single operations that need retry capability
   */
  public async executeWithRetry<T>(operation: () => T, customRetryConfig?: RetryConfig): Promise<T> {
    const config = customRetryConfig || this.retryConfig;
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        this.logger.debug('Executing operation with retry', {
          metadata: { attempt, maxAttempts: config.maxAttempts }
        });

        const result = operation();
        
        const executionTime = Date.now() - startTime;
        this.connectionManager.updateQueryMetrics(executionTime, true);
        
        return result;

      } catch (error) {
        lastError = error as Error;
        const executionTime = Date.now() - startTime;
        this.connectionManager.updateQueryMetrics(executionTime, false);

        this.logger.warn(`Operation attempt ${attempt}/${config.maxAttempts} failed`, {
          error: lastError,
          metadata: { attempt, executionTime }
        });

        if (!this.isRetryableError(lastError) || attempt === config.maxAttempts) {
          break;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.logger.error('Operation failed after all retry attempts', {
      error: lastError!,
      metadata: { 
        totalAttempts: config.maxAttempts,
        totalTime: Date.now() - startTime
      }
    });

    throw new Error(`Operation failed after ${config.maxAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Execute multiple operations in a single transaction
   * All operations succeed or all are rolled back
   */
  public async executeBatch<T>(operations: (() => T)[]): Promise<T[]> {
    return this.executeTransaction(() => {
      const results: T[] = [];
      
      for (let i = 0; i < operations.length; i++) {
        try {
          this.logger.debug(`Executing batch operation ${i + 1}/${operations.length}`);
          const operation = operations[i];
          if (!operation) {
            throw new Error(`Operation at index ${i} is undefined`);
          }
          const result = operation();
          results.push(result);
        } catch (error) {
          this.logger.error(`Batch operation ${i + 1} failed, rolling back all operations`, {
            error: error as Error,
            metadata: { operationIndex: i, totalOperations: operations.length }
          });
          throw error; // This will trigger transaction rollback
        }
      }
      
      this.logger.debug(`All ${operations.length} batch operations completed successfully`);
      return results;
    });
  }

  /**
   * Execute a transaction with a timeout
   */
  public async executeTransactionWithTimeout<T>(
    operation: () => T, 
    timeoutMs: number = 30000
  ): Promise<T> {
    return Promise.race([
      this.executeTransaction(operation),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Transaction timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // SQLite errors that are typically retryable
    const retryablePatterns = [
      'database is locked',
      'database is busy',
      'disk i/o error',
      'temporary failure',
      'connection lost',
      'sqlite_busy',
      'sqlite_locked'
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Get error severity for classification
   */
  private getErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('corrupt') || message.includes('malformed')) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (message.includes('constraint') || message.includes('foreign key')) {
      return ErrorSeverity.HIGH;
    }
    
    if (this.isRetryableError(error)) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  /**
   * Update retry configuration
   */
  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    this.logger.info('Transaction retry configuration updated', {
      metadata: this.retryConfig
    });
  }
}