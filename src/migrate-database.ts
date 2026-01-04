import Database from 'better-sqlite3';
import { Logger } from './utils/Logger';
import fs from 'fs';
import path from 'path';

interface OldNationData {
  name: string;
  gdp: number;
  stability: number;
  population: number;
  tax_rate?: number;
}

interface OldUserLink {
  discord_id: string;
  nation_name: string;
}

interface OldWar {
  name: string;
  participants: string;
  start_date: string;
  end_date?: string;
  casualties: number;
  description?: string;
  status: string;
}

interface OldUserActivity {
  discord_id: string;
  channel_id: string;
  last_message_at: string;
  message_count: number;
}

interface OldAdminAction {
  admin_id: string;
  action: string;
  details: string;
  timestamp: string;
}

export class DatabaseMigrator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  public async migrate(): Promise<void> {
    const dbPath = './data/model-us-bot.db';
    const backupPath = `./data/model-us-bot-backup-${Date.now()}.db`;

    this.logger.info('Starting database migration...');

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      this.logger.info('No existing database found. Migration not needed.');
      return;
    }

    // Create backup
    this.logger.info(`Creating backup at: ${backupPath}`);
    fs.copyFileSync(dbPath, backupPath);

    // Open old database and extract data
    const oldDb = new Database(dbPath);
    
    let nations: OldNationData[] = [];
    let userLinks: OldUserLink[] = [];
    let wars: OldWar[] = [];
    let userActivity: OldUserActivity[] = [];
    let adminActions: OldAdminAction[] = [];

    try {
      // Extract nations data
      try {
        const nationsStmt = oldDb.prepare('SELECT * FROM nations');
        nations = nationsStmt.all() as OldNationData[];
        this.logger.info(`Extracted ${nations.length} nations`);
      } catch (error) {
        this.logger.warn('Could not extract nations data:', { error: error as Error });
      }

      // Extract user links
      try {
        const userLinksStmt = oldDb.prepare('SELECT * FROM user_links');
        userLinks = userLinksStmt.all() as OldUserLink[];
        this.logger.info(`Extracted ${userLinks.length} user links`);
      } catch (error) {
        this.logger.warn('Could not extract user links data:', { error: error as Error });
      }

      // Extract wars
      try {
        const warsStmt = oldDb.prepare('SELECT * FROM wars');
        wars = warsStmt.all() as OldWar[];
        this.logger.info(`Extracted ${wars.length} wars`);
      } catch (error) {
        this.logger.warn('Could not extract wars data:', { error: error as Error });
      }

      // Extract user activity
      try {
        const activityStmt = oldDb.prepare('SELECT * FROM user_activity');
        userActivity = activityStmt.all() as OldUserActivity[];
        this.logger.info(`Extracted ${userActivity.length} user activity records`);
      } catch (error) {
        this.logger.warn('Could not extract user activity data:', { error: error as Error });
      }

      // Extract admin actions
      try {
        const adminStmt = oldDb.prepare('SELECT * FROM admin_actions');
        adminActions = adminStmt.all() as OldAdminAction[];
        this.logger.info(`Extracted ${adminActions.length} admin actions`);
      } catch (error) {
        this.logger.warn('Could not extract admin actions data:', { error: error as Error });
      }

    } finally {
      oldDb.close();
    }

    // Remove old database files
    this.logger.info('Removing old database files...');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);

    // Create new database with new schema
    this.logger.info('Creating new database with updated schema...');
    const { DatabaseManager } = await import('./database/DatabaseManager');
    const dbManager = new DatabaseManager(
      { path: dbPath, enableWAL: true, enableForeignKeys: true },
      this.logger
    );

    // Migrate data
    this.logger.info('Migrating data to new schema...');

    // Migrate nations
    for (const nation of nations) {
      try {
        dbManager.createOrUpdateNation({
          name: nation.name,
          gdp: nation.gdp,
          stability: nation.stability,
          population: nation.population,
          taxRate: nation.tax_rate || 20.0
        });
      } catch (error) {
        this.logger.error(`Failed to migrate nation ${nation.name}:`, { error: error as Error });
      }
    }

    // Migrate user links
    for (const link of userLinks) {
      try {
        dbManager.createOrUpdateUserLink(link.discord_id, link.nation_name);
      } catch (error) {
        this.logger.error(`Failed to migrate user link ${link.discord_id}:`, { error: error as Error });
      }
    }

    // Migrate wars
    for (const war of wars) {
      try {
        dbManager.createWar({
          name: war.name,
          participants: JSON.parse(war.participants),
          startDate: new Date(war.start_date),
          endDate: war.end_date ? new Date(war.end_date) : undefined,
          casualties: war.casualties,
          description: war.description,
          status: war.status as 'active' | 'ended'
        });
      } catch (error) {
        this.logger.error(`Failed to migrate war ${war.name}:`, { error: error as Error });
      }
    }

    // Migrate user activity
    for (const activity of userActivity) {
      try {
        // We'll need to manually insert this since updateUserActivity increments
        const stmt = (dbManager as any).db.prepare(`
          INSERT INTO user_activity (discord_id, channel_id, last_message_at, message_count)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(activity.discord_id, activity.channel_id, activity.last_message_at, activity.message_count);
      } catch (error) {
        this.logger.error(`Failed to migrate user activity for ${activity.discord_id}:`, { error: error as Error });
      }
    }

    // Migrate admin actions
    for (const action of adminActions) {
      try {
        dbManager.logAdminAction(action.admin_id, action.action, action.details);
      } catch (error) {
        this.logger.error(`Failed to migrate admin action:`, { error: error as Error });
      }
    }

    dbManager.close();

    this.logger.info('Database migration completed successfully!');
    this.logger.info(`Backup saved at: ${backupPath}`);
    this.logger.info('You can now start the bot with the new schema.');
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  migrator.migrate().catch(console.error);
}