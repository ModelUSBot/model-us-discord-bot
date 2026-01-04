import { DatabaseConfig, DatabaseHealth, RetryConfig, DatabaseErrorType } from '../types';
import { Logger } from '../utils/Logger';
import { ConnectionManager } from './ConnectionManager';
import { TransactionManager } from './TransactionManager';
import { ErrorHandler } from './ErrorHandler';
import { BackupManager } from './BackupManager';

/**
 * Enhanced DatabaseManager with reliability features
 * This wraps the existing DatabaseManager with additional reliability components
 */
export class EnhancedDatabaseManager {
  private connectionManager: ConnectionManager;
  private transactionManager: TransactionManager;
  private errorHandler: ErrorHandler;
  private backupManager: BackupManager;
  private logger: Logger;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize reliability components
    this.connectionManager = new ConnectionManager(config, logger);
    this.transactionManager = new TransactionManager(this.connectionManager, logger);
    this.errorHandler = new ErrorHandler(logger);
    this.backupManager = new BackupManager(this.connectionManager, logger);

    // Start automatic features if enabled
    if (config.enableAutoBackup && config.backupInterval) {
      this.backupManager.startAutomaticBackups(config.backupInterval);
    }
  }

  /**
   * Initialize the enhanced database manager
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing enhanced database manager...');
      
      await this.connectionManager.connect();
      
      // Create initial backup if enabled
      if (this.config.enableAutoBackup) {
        try {
          await this.backupManager.createBackup('automatic');
        } catch (error) {
          this.logger.warn('Initial backup failed, continuing with initialization', { 
            error: error as Error 
          });
        }
      }

      this.logger.info('Enhanced database manager initialized successfully');
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.CONNECTION_LOST
      );
      
      this.logger.error(`Database initialization failed: ${userMessage} (${errorId})`);
      throw error;
    }
  }

  /**
   * Execute a database operation with full error handling and retry logic
   */
  public async executeOperation<T>(
    operation: () => T,
    operationName: string = 'database operation',
    context?: { command?: string; user?: string }
  ): Promise<T> {
    try {
      return await this.transactionManager.executeWithRetry(operation);
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.QUERY_FAILED,
        { ...context, query: operationName }
      );
      
      throw new Error(`${userMessage} (Error ID: ${errorId})`);
    }
  }

  /**
   * Execute a transaction with full error handling
   */
  public async executeTransaction<T>(
    operation: () => T,
    context?: { command?: string; user?: string }
  ): Promise<T> {
    try {
      return await this.transactionManager.executeTransaction(operation);
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.TRANSACTION_FAILED,
        context
      );
      
      throw new Error(`${userMessage} (Error ID: ${errorId})`);
    }
  }

  /**
   * Execute multiple operations as a batch transaction
   */
  public async executeBatch<T>(
    operations: (() => T)[],
    context?: { command?: string; user?: string }
  ): Promise<T[]> {
    try {
      return await this.transactionManager.executeBatch(operations);
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.TRANSACTION_FAILED,
        context
      );
      
      throw new Error(`${userMessage} (Error ID: ${errorId})`);
    }
  }

  /**
   * Get database health information
   */
  public getHealth(): DatabaseHealth {
    return this.connectionManager.getHealth();
  }

  /**
   * Check if database is healthy
   */
  public isHealthy(): boolean {
    return this.connectionManager.isHealthy();
  }

  /**
   * Create a manual backup
   */
  public async createBackup(): Promise<string> {
    try {
      return await this.backupManager.createBackup('manual');
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.BACKUP_FAILED
      );
      
      throw new Error(`${userMessage} (Error ID: ${errorId})`);
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      await this.backupManager.restoreFromBackup(backupPath);
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.BACKUP_FAILED
      );
      
      throw new Error(`${userMessage} (Error ID: ${errorId})`);
    }
  }

  /**
   * Get error statistics
   */
  public getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }

  /**
   * Get available backups
   */
  public listBackups() {
    return this.backupManager.listBackups();
  }

  /**
   * Get the underlying database connection (use with caution)
   */
  public getDatabase(): any {
    return this.connectionManager.getDatabase();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DatabaseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update retry configuration if changed
    if (newConfig.retryAttempts) {
      this.transactionManager.updateRetryConfig({
        maxAttempts: newConfig.retryAttempts
      });
    }

    this.logger.info('Database configuration updated', { 
      metadata: newConfig 
    });
  }

  /**
   * Enable or disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.logger.enableDebugMode(enabled);
  }

  /**
   * Close all connections and cleanup
   */
  public async close(): Promise<void> {
    this.logger.info('Closing enhanced database manager...');
    
    this.backupManager.stopAutomaticBackups();
    this.connectionManager.close();
    
    this.logger.info('Enhanced database manager closed');
  }

  /**
   * Force reconnection (useful for testing or recovery)
   */
  public async reconnect(): Promise<void> {
    try {
      await this.connectionManager.reconnect();
    } catch (error) {
      const { userMessage, errorId } = this.errorHandler.handleError(
        error as Error,
        DatabaseErrorType.CONNECTION_LOST
      );
      
      throw new Error(`${userMessage} (Error ID: ${errorId})`);
    }
  }
}