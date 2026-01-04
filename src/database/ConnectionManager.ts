import Database from 'better-sqlite3';
import { DatabaseConfig, DatabaseHealth, RetryConfig, DatabaseErrorType, ErrorSeverity } from '../types';
import { Logger } from '../utils/Logger';

export class ConnectionManager {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private logger: Logger;
  private health: DatabaseHealth;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private retryConfig: RetryConfig;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.retryConfig = {
      maxAttempts: config.retryAttempts || 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2.0
    };

    this.health = {
      isConnected: false,
      queryCount: 0,
      errorCount: 0,
      averageQueryTime: 0,
      lastHealthCheck: new Date(),
      databaseSize: 0,
      backupStatus: 'SUCCESS',
      lastBackup: new Date(),
      lastError: undefined
    };

    this.startHealthMonitoring();
  }

  public async connect(): Promise<void> {
    try {
      if (this.db) {
        this.logger.debug('Database connection already exists');
        return;
      }

      this.logger.info(`Connecting to database: ${this.config.path}`);
      this.db = new Database(this.config.path);

      // Configure database settings
      if (this.config.enableWAL !== false) {
        this.db.pragma('journal_mode = WAL');
      }

      if (this.config.enableForeignKeys !== false) {
        this.db.pragma('foreign_keys = ON');
      }

      // Set connection timeout if specified
      if (this.config.connectionTimeout) {
        this.db.pragma(`busy_timeout = ${this.config.connectionTimeout}`);
      }

      this.health.isConnected = true;
      this.health.lastError = undefined;
      this.logger.info('Database connection established successfully');

    } catch (error) {
      this.health.isConnected = false;
      this.health.lastError = error as Error;
      this.health.errorCount++;
      
      this.logger.error('Failed to connect to database:', { error: error as Error });
      throw error;
    }
  }

  public async reconnect(): Promise<void> {
    this.logger.info('Attempting database reconnection...');
    
    // Close existing connection if any
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        this.logger.warn('Error closing existing connection:', { error: error as Error });
      }
      this.db = null;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        await this.connect();
        this.logger.info(`Database reconnection successful on attempt ${attempt}`);
        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Reconnection attempt ${attempt}/${this.retryConfig.maxAttempts} failed:`, { error: error as Error });
        
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelay
          );
          
          this.logger.info(`Waiting ${delay}ms before next reconnection attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All reconnection attempts failed
    this.health.isConnected = false;
    this.health.lastError = lastError || undefined;
    this.logger.error(`All ${this.retryConfig.maxAttempts} reconnection attempts failed. Entering graceful degradation mode.`);
    
    throw new Error(`Database reconnection failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`);
  }

  public isHealthy(): boolean {
    return this.health.isConnected && this.validateConnection();
  }

  public validateConnection(): boolean {
    if (!this.db) {
      return false;
    }

    try {
      // Simple validation query
      const result = this.db.prepare('SELECT 1 as test').get() as { test: number } | undefined;
      return result ? result.test === 1 : false;
    } catch (error) {
      this.logger.warn('Connection validation failed:', { error: error as Error });
      this.health.isConnected = false;
      this.health.lastError = error as Error;
      return false;
    }
  }

  public getDatabase(): Database.Database {
    if (!this.db || !this.isHealthy()) {
      throw new Error('Database connection is not available or unhealthy');
    }
    return this.db;
  }

  public getHealth(): DatabaseHealth {
    return { ...this.health };
  }

  public updateQueryMetrics(executionTime: number, success: boolean): void {
    this.health.queryCount++;
    
    if (!success) {
      this.health.errorCount++;
    }

    // Update rolling average query time
    const totalTime = this.health.averageQueryTime * (this.health.queryCount - 1) + executionTime;
    this.health.averageQueryTime = totalTime / this.health.queryCount;
  }

  public close(): void {
    this.logger.info('Closing database connection...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.db) {
      try {
        this.db.close();
        this.logger.info('Database connection closed successfully');
      } catch (error) {
        this.logger.error('Error closing database connection:', { error: error as Error });
      }
      this.db = null;
    }

    this.health.isConnected = false;
  }

  private startHealthMonitoring(): void {
    if (!this.config.enableHealthMonitoring) {
      return;
    }

    const interval = this.config.healthCheckInterval || 30000; // Default 30 seconds
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, interval);

    this.logger.debug(`Health monitoring started with ${interval}ms interval`);
  }

  private performHealthCheck(): void {
    this.health.lastHealthCheck = new Date();
    
    if (!this.validateConnection()) {
      this.logger.warn('Health check failed - connection is unhealthy');
      
      // Attempt automatic reconnection if enabled
      if (this.config.retryAttempts && this.config.retryAttempts > 0) {
        this.reconnect().catch(error => {
          this.logger.error('Automatic reconnection during health check failed:', { error: error as Error });
        });
      }
      return;
    }

    // Update database size if possible
    try {
      if (this.db) {
        const sizeResult = this.db.prepare('PRAGMA page_count').get() as any;
        const pageSizeResult = this.db.prepare('PRAGMA page_size').get() as any;
        
        if (sizeResult && pageSizeResult) {
          this.health.databaseSize = sizeResult.page_count * pageSizeResult.page_size;
        }
      }
    } catch (error) {
      this.logger.debug('Could not update database size during health check:', { error: error as Error });
    }

    // Calculate error rate
    const errorRate = this.health.queryCount > 0 ? 
      (this.health.errorCount / this.health.queryCount) * 100 : 0;

    // Log health status if error rate is concerning
    if (errorRate > 5) { // More than 5% error rate
      this.logger.warn(`Database error rate is ${errorRate.toFixed(2)}% (${this.health.errorCount}/${this.health.queryCount} queries)`);
    }

    this.logger.debug(`Health check completed - Queries: ${this.health.queryCount}, Errors: ${this.health.errorCount}, Avg Time: ${this.health.averageQueryTime.toFixed(2)}ms`);
  }
}