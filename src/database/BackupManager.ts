import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { ConnectionManager } from './ConnectionManager';
import { Logger } from '../utils/Logger';

export class BackupManager {
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private backupInterval: NodeJS.Timeout | undefined;
  private backupDirectory: string;
  private maxBackups: number;
  private isBackupInProgress: boolean = false;

  constructor(
    connectionManager: ConnectionManager, 
    logger: Logger, 
    backupDirectory: string = './data/backups',
    maxBackups: number = 10
  ) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.backupDirectory = backupDirectory;
    this.maxBackups = maxBackups;
    
    this.ensureBackupDirectory();
  }

  /**
   * Start automatic backup scheduling
   */
  public startAutomaticBackups(intervalMs: number = 3600000): void { // Default 1 hour
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(async () => {
      try {
        await this.createBackup('automatic');
      } catch (error) {
        this.logger.error('Automatic backup failed', { error: error as Error });
      }
    }, intervalMs);

    this.logger.info(`Automatic backups started with ${intervalMs}ms interval`);
  }

  /**
   * Stop automatic backups
   */
  public stopAutomaticBackups(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = undefined;
      this.logger.info('Automatic backups stopped');
    }
  }

  /**
   * Create a database backup
   */
  public async createBackup(type: 'manual' | 'automatic' = 'manual'): Promise<string> {
    if (this.isBackupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.isBackupInProgress = true;
    const startTime = Date.now();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `model-us-bot-${type}-${timestamp}.db`;
      const backupPath = path.join(this.backupDirectory, backupFileName);

      this.logger.info(`Starting ${type} backup: ${backupFileName}`);

      const db = this.connectionManager.getDatabase();
      
      // Use SQLite's backup API for consistent backups
      await new Promise<void>((resolve, reject) => {
        try {
          db.backup(backupPath);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      // Verify backup integrity
      await this.verifyBackup(backupPath);

      const backupSize = fs.statSync(backupPath).size;
      const duration = Date.now() - startTime;

      this.logger.info(`Backup completed successfully`, {
        metadata: {
          fileName: backupFileName,
          size: backupSize,
          duration,
          type
        }
      });

      // Clean up old backups
      await this.cleanupOldBackups();

      return backupPath;

    } catch (error) {
      this.logger.error('Backup failed', { 
        error: error as Error,
        metadata: { type, duration: Date.now() - startTime }
      });
      throw error;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Restore database from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    this.logger.warn(`Starting database restoration from: ${backupPath}`);

    try {
      // Verify backup before restoration
      await this.verifyBackup(backupPath);

      // Close current connection
      this.connectionManager.close();

      // Get current database path
      const currentDbPath = this.getCurrentDatabasePath();
      
      // Create backup of current database before restoration
      const preRestoreBackup = `${currentDbPath}.pre-restore-${Date.now()}.bak`;
      if (fs.existsSync(currentDbPath)) {
        fs.copyFileSync(currentDbPath, preRestoreBackup);
        this.logger.info(`Created pre-restoration backup: ${preRestoreBackup}`);
      }

      // Copy backup to current database location
      fs.copyFileSync(backupPath, currentDbPath);

      // Reconnect to restored database
      await this.connectionManager.connect();

      this.logger.info('Database restoration completed successfully');

    } catch (error) {
      this.logger.error('Database restoration failed', { error: error as Error });
      throw error;
    }
  }

  /**
   * List available backups
   */
  public listBackups(): Array<{
    fileName: string;
    path: string;
    size: number;
    created: Date;
    type: 'manual' | 'automatic';
  }> {
    if (!fs.existsSync(this.backupDirectory)) {
      return [];
    }

    const files = fs.readdirSync(this.backupDirectory)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(this.backupDirectory, file);
        const stats = fs.statSync(filePath);
        const type = file.includes('-manual-') ? 'manual' : 'automatic';
        
        return {
          fileName: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          type: type as 'manual' | 'automatic'
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return files;
  }

  /**
   * Delete a specific backup
   */
  public deleteBackup(fileName: string): boolean {
    const backupPath = path.join(this.backupDirectory, fileName);
    
    if (!fs.existsSync(backupPath)) {
      return false;
    }

    try {
      fs.unlinkSync(backupPath);
      this.logger.info(`Backup deleted: ${fileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete backup: ${fileName}`, { error: error as Error });
      return false;
    }
  }

  private async verifyBackup(backupPath: string): Promise<void> {
    try {
      // Open backup database and run integrity check
      const backupDb = new Database(backupPath, { readonly: true });
      
      const integrityResult = backupDb.prepare('PRAGMA integrity_check').get() as any;
      backupDb.close();

      if (integrityResult.integrity_check !== 'ok') {
        throw new Error(`Backup integrity check failed: ${integrityResult.integrity_check}`);
      }

      this.logger.debug(`Backup integrity verified: ${path.basename(backupPath)}`);
    } catch (error) {
      throw new Error(`Backup verification failed: ${(error as Error).message}`);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = this.listBackups();
    
    if (backups.length <= this.maxBackups) {
      return;
    }

    const backupsToDelete = backups.slice(this.maxBackups);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      if (this.deleteBackup(backup.fileName)) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.info(`Cleaned up ${deletedCount} old backups`);
    }
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
      this.logger.info(`Created backup directory: ${this.backupDirectory}`);
    }
  }

  private getCurrentDatabasePath(): string {
    // This would need to be configured based on the actual database path
    return process.env.DATABASE_PATH || './data/model-us-bot.db';
  }
}