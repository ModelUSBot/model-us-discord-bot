import Database from 'better-sqlite3';
import { DatabaseConfig, NationStats, War, UserLink, UserActivity, AdminAction, AuditLogEntry, Law, LawWithTags, Tag } from '../types';
import { Logger } from '../utils/Logger';

export class DatabaseManager {
  private db: Database.Database;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.logger = logger;
    this.db = new Database(config.path);
    
    // Enable WAL mode for better performance
    if (config.enableWAL !== false) {
      this.db.pragma('journal_mode = WAL');
    }
    
    // Enable foreign keys
    if (config.enableForeignKeys !== false) {
      this.db.pragma('foreign_keys = ON');
    }
    
    this.logger.info(`Database initialized at: ${config.path}`);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.logger.info('Initializing database schema...');
    
    // Create nations table with computed columns
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL COLLATE NOCASE,
        gdp REAL NOT NULL DEFAULT 0 CHECK (gdp >= 0),
        stability REAL NOT NULL DEFAULT 0 CHECK (stability >= 0 AND stability <= 100),
        population INTEGER NOT NULL DEFAULT 0 CHECK (population >= 0),
        tax_rate REAL NOT NULL DEFAULT 20.0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
        budget REAL GENERATED ALWAYS AS (gdp * tax_rate / 100) STORED,
        gdp_per_capita REAL GENERATED ALWAYS AS (
          CASE 
            WHEN population > 0 
            THEN (gdp * 1000000000) / population
            ELSE 0 
          END
        ) STORED,
        previous_gdp REAL CHECK (previous_gdp >= 0),
        previous_population INTEGER CHECK (previous_population >= 0),
        gdp_change REAL GENERATED ALWAYS AS (
          CASE 
            WHEN previous_gdp IS NOT NULL AND previous_gdp > 0 
            THEN ((gdp - previous_gdp) / previous_gdp) * 100 
            ELSE NULL 
          END
        ) STORED,
        population_change REAL GENERATED ALWAYS AS (
          CASE 
            WHEN previous_population IS NOT NULL AND previous_population > 0 
            THEN ((population - previous_population) / CAST(previous_population AS REAL)) * 100 
            ELSE NULL 
          END
        ) STORED,
        flag TEXT,
        flag_set_at DATETIME,
        capitol TEXT,
        description TEXT,
        military_readiness REAL DEFAULT 5.0 CHECK (military_readiness >= 0 AND military_readiness <= 10),
        last_rename_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to existing nations table (for backward compatibility)
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN description TEXT`);
    } catch (error) {
      // Column already exists, ignore error
    }
    
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN military_readiness REAL DEFAULT 5.0 CHECK (military_readiness >= 0 AND military_readiness <= 10)`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Create user links table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE NOT NULL,
        nation_name TEXT NOT NULL COLLATE NOCASE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Create wars table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        participants TEXT NOT NULL, -- JSON array of nation names
        start_date DATE NOT NULL,
        end_date DATE,
        casualties INTEGER DEFAULT 0 CHECK (casualties >= 0),
        description TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create alliances table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alliances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nation1 TEXT NOT NULL COLLATE NOCASE,
        nation2 TEXT NOT NULL COLLATE NOCASE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'broken')),
        requested_by TEXT NOT NULL, -- Discord ID
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        created_by TEXT, -- Admin Discord ID if admin-created
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nation1) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (nation2) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE(nation1, nation2)
      )
    `);

    // Create nation renames table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nation_renames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        old_name TEXT NOT NULL COLLATE NOCASE,
        new_name TEXT NOT NULL COLLATE NOCASE,
        renamed_by TEXT NOT NULL, -- Discord ID
        renamed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_admin_rename BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (new_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Create backup records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backup_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT, -- Admin Discord ID if manual
        size INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'automatic' CHECK (type IN ('automatic', 'manual'))
      )
    `);

    // Create user activity table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_activity (
        discord_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        last_message_at DATETIME NOT NULL,
        message_count INTEGER DEFAULT 1 CHECK (message_count >= 0),
        PRIMARY KEY (discord_id, channel_id)
      )
    `);

    // Create admin actions table for audit logging
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create laws table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS laws (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        body_text TEXT NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT TRUE,
        nation_name TEXT NOT NULL COLLATE NOCASE,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE(name, nation_name)
      )
    `);

    // Create tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL COLLATE NOCASE,
        description TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create law_tags junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS law_tags (
        law_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (law_id, tag_id),
        FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nations_name ON nations(name);
      CREATE INDEX IF NOT EXISTS idx_nations_last_rename ON nations(last_rename_at);
      CREATE INDEX IF NOT EXISTS idx_nations_flag_set_at ON nations(flag_set_at);
      CREATE INDEX IF NOT EXISTS idx_nations_capitol ON nations(capitol);
      CREATE INDEX IF NOT EXISTS idx_user_links_discord_id ON user_links(discord_id);
      CREATE INDEX IF NOT EXISTS idx_user_links_nation_name ON user_links(nation_name);
      CREATE INDEX IF NOT EXISTS idx_wars_status ON wars(status);
      CREATE INDEX IF NOT EXISTS idx_alliances_status ON alliances(status);
      CREATE INDEX IF NOT EXISTS idx_alliances_nations ON alliances(nation1, nation2);
      CREATE INDEX IF NOT EXISTS idx_alliances_requested_by ON alliances(requested_by);
      CREATE INDEX IF NOT EXISTS idx_nation_renames_new_name ON nation_renames(new_name);
      CREATE INDEX IF NOT EXISTS idx_nation_renames_renamed_by ON nation_renames(renamed_by);
      CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_activity_channel ON user_activity(channel_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_laws_nation_name ON laws(nation_name);
      CREATE INDEX IF NOT EXISTS idx_laws_is_public ON laws(is_public);
      CREATE INDEX IF NOT EXISTS idx_laws_created_by ON laws(created_by);
      CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
      CREATE INDEX IF NOT EXISTS idx_law_tags_law_id ON law_tags(law_id);
      CREATE INDEX IF NOT EXISTS idx_law_tags_tag_id ON law_tags(tag_id);
    `);

    // Create triggers to update the updated_at timestamp
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_nations_timestamp 
      AFTER UPDATE ON nations
      BEGIN
        UPDATE nations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_wars_timestamp 
      AFTER UPDATE ON wars
      BEGIN
        UPDATE wars SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    this.logger.info('Database schema initialized successfully');
  }

  // Nation operations
  public createOrUpdateNation(stats: Omit<NationStats, 'budget' | 'gdpPerCapita' | 'gdpChange' | 'populationChange' | 'updatedAt' | 'leader'>): NationStats {
    const stmt = this.db.prepare(`
      INSERT INTO nations (name, gdp, stability, population, tax_rate, flag, flag_set_at, capitol, previous_gdp, previous_population)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 
        (SELECT gdp FROM nations WHERE name = ? LIMIT 1),
        (SELECT population FROM nations WHERE name = ? LIMIT 1)
      )
      ON CONFLICT(name) DO UPDATE SET
        previous_gdp = nations.gdp,
        previous_population = nations.population,
        gdp = excluded.gdp,
        stability = excluded.stability,
        population = excluded.population,
        tax_rate = excluded.tax_rate,
        flag = COALESCE(excluded.flag, nations.flag),
        flag_set_at = COALESCE(excluded.flag_set_at, nations.flag_set_at),
        capitol = COALESCE(excluded.capitol, nations.capitol)
    `);

    stmt.run(
      stats.name,
      stats.gdp,
      stats.stability,
      stats.population,
      stats.taxRate,
      stats.flag || null,
      stats.flagSetAt?.toISOString() || null,
      stats.capital || null,
      stats.name, // for previous_gdp subquery
      stats.name  // for previous_population subquery
    );

    return this.getNationByName(stats.name)!;
  }

  public getNationByName(name: string): NationStats | null {
    const stmt = this.db.prepare(`
      SELECT n.name, n.gdp, n.stability, n.population, n.tax_rate as taxRate, n.budget,
             n.gdp_per_capita as gdpPerCapita, n.gdp_change as gdpChange, 
             n.population_change as populationChange, n.updated_at as updatedAt,
             n.flag, n.flag_set_at as flagSetAt, n.capitol as capital, n.description, n.military_readiness as militaryReadiness,
             ul.discord_id as leaderDiscordId
      FROM nations n 
      LEFT JOIN user_links ul ON n.name = ul.nation_name COLLATE NOCASE
      WHERE n.name = ? COLLATE NOCASE
    `);

    const row = stmt.get(name) as any;
    if (!row) return null;

    return {
      ...row,
      updatedAt: new Date(row.updatedAt),
      flagSetAt: row.flagSetAt ? new Date(row.flagSetAt) : undefined,
      leader: row.leaderDiscordId || undefined,
    };
  }

  public getAllNations(): NationStats[] {
    const stmt = this.db.prepare(`
      SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
             gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
             population_change as populationChange, updated_at as updatedAt
      FROM nations 
      ORDER BY name
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      updatedAt: new Date(row.updatedAt),
    }));
  }

  public searchNations(searchTerm: string, limit: number = 10): NationStats[] {
    const stmt = this.db.prepare(`
      SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
             gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
             population_change as populationChange, updated_at as updatedAt
      FROM nations 
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1  -- Exact matches first
          WHEN name LIKE ? THEN 2  -- Starts with search term
          ELSE 3                   -- Contains search term
        END,
        name
      LIMIT ?
    `);

    const searchPattern = `%${searchTerm}%`;
    const exactPattern = searchTerm;
    const startsWithPattern = `${searchTerm}%`;

    const rows = stmt.all(searchPattern, exactPattern, startsWithPattern, limit) as any[];
    return rows.map(row => ({
      ...row,
      updatedAt: new Date(row.updatedAt),
    }));
  }

  public searchNationsForAutocomplete(searchTerm: string, limit: number = 25): { name: string; value: string }[] {
    const stmt = this.db.prepare(`
      SELECT name
      FROM nations 
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1  -- Exact matches first
          WHEN name LIKE ? THEN 2  -- Starts with search term
          ELSE 3                   -- Contains search term
        END,
        name
      LIMIT ?
    `);

    const searchPattern = `%${searchTerm}%`;
    const exactPattern = searchTerm;
    const startsWithPattern = `${searchTerm}%`;

    const rows = stmt.all(searchPattern, exactPattern, startsWithPattern, limit) as any[];
    return rows.map(row => ({
      name: row.name,
      value: row.name
    }));
  }

  public getNationsByRanking(category: 'gdp' | 'population' | 'stability' | 'tax_rate' | 'gdp_per_capita' | 'military_readiness', limit: number = 10): NationStats[] {
    const columnMap = {
      gdp: 'gdp',
      population: 'population',
      stability: 'stability',
      tax_rate: 'tax_rate',
      gdp_per_capita: 'gdp_per_capita',
      military_readiness: 'military_readiness'
    };

    const column = columnMap[category];
    const stmt = this.db.prepare(`
      SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
             gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
             population_change as populationChange, updated_at as updatedAt,
             military_readiness as militaryReadiness
      FROM nations 
      ORDER BY ${column} DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      updatedAt: new Date(row.updatedAt),
    }));
  }

  // User link operations
  public createOrUpdateUserLink(discordId: string, nationName: string): UserLink {
    const stmt = this.db.prepare(`
      INSERT INTO user_links (discord_id, nation_name)
      VALUES (?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        nation_name = excluded.nation_name
    `);

    stmt.run(discordId, nationName);

    return this.getUserLink(discordId)!;
  }

  public getUserLink(discordId: string): UserLink | null {
    const stmt = this.db.prepare(`
      SELECT id, discord_id as discordId, nation_name as nationName, created_at as createdAt
      FROM user_links 
      WHERE discord_id = ?
    `);

    const row = stmt.get(discordId) as any;
    if (!row) return null;

    return {
      ...row,
      createdAt: new Date(row.createdAt),
    };
  }

  public getUserByNation(nationName: string): UserLink | null {
    const stmt = this.db.prepare(`
      SELECT id, discord_id as discordId, nation_name as nationName, created_at as createdAt
      FROM user_links 
      WHERE nation_name = ? COLLATE NOCASE
    `);

    const row = stmt.get(nationName) as any;
    if (!row) return null;

    return {
      ...row,
      createdAt: new Date(row.createdAt),
    };
  }

  // War operations
  public createWar(war: Omit<War, 'id'>): War {
    const stmt = this.db.prepare(`
      INSERT INTO wars (name, participants, start_date, end_date, casualties, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      war.name,
      JSON.stringify(war.participants),
      war.startDate.toISOString().split('T')[0],
      war.endDate?.toISOString().split('T')[0] || null,
      war.casualties,
      war.description || null,
      war.status
    );

    return this.getWarById(result.lastInsertRowid as number)!;
  }

  public updateWarCasualties(warId: number, casualties: number): War | null {
    const stmt = this.db.prepare(`
      UPDATE wars SET casualties = ? WHERE id = ?
    `);

    const result = stmt.run(casualties, warId);
    if (result.changes === 0) return null;

    return this.getWarById(warId);
  }

  public getWarById(id: number): War | null {
    const stmt = this.db.prepare(`
      SELECT id, name, participants, start_date, end_date, casualties, description, status
      FROM wars 
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      participants: JSON.parse(row.participants),
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
    };
  }

  public getAllWars(): War[] {
    const stmt = this.db.prepare(`
      SELECT id, name, participants, start_date, end_date, casualties, description, status
      FROM wars 
      ORDER BY start_date DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      participants: JSON.parse(row.participants),
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
    }));
  }

  // Activity tracking operations
  public updateUserActivity(discordId: string, channelId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO user_activity (discord_id, channel_id, last_message_at, message_count)
      VALUES (?, ?, CURRENT_TIMESTAMP, 1)
      ON CONFLICT(discord_id, channel_id) DO UPDATE SET
        last_message_at = CURRENT_TIMESTAMP,
        message_count = message_count + 1
    `);

    stmt.run(discordId, channelId);
  }

  public getChannelActivity(channelId: string): UserActivity[] {
    const stmt = this.db.prepare(`
      SELECT discord_id as discordId, channel_id as channelId, 
             last_message_at as lastMessageAt, message_count as messageCount
      FROM user_activity 
      WHERE channel_id = ?
      ORDER BY last_message_at DESC
    `);

    const rows = stmt.all(channelId) as any[];
    return rows.map(row => ({
      ...row,
      lastMessageAt: new Date(row.lastMessageAt),
    }));
  }

  // Admin action logging
  public logAdminAction(adminId: string, action: string, details: string): AdminAction {
    const stmt = this.db.prepare(`
      INSERT INTO admin_actions (admin_id, action, details)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(adminId, action, details);

    const getStmt = this.db.prepare(`
      SELECT id, admin_id as adminId, action, details, timestamp
      FROM admin_actions 
      WHERE id = ?
    `);

    const row = getStmt.get(result.lastInsertRowid as number) as any;
    return {
      ...row,
      timestamp: new Date(row.timestamp),
    };
  }

  // Database maintenance
  public close(): void {
    this.db.close();
    this.logger.info('Database connection closed');
  }

  public backup(backupPath: string): void {
    this.db.backup(backupPath);
    this.logger.info(`Database backed up to: ${backupPath}`);
  }

  public vacuum(): void {
    this.db.exec('VACUUM');
    this.logger.info('Database vacuumed');
  }

  // Transaction support
  public transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  // Flag management operations
  public setNationFlag(nationName: string, flag: string, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET flag = ?, flag_set_at = CURRENT_TIMESTAMP 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(flag, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_FLAG', `Set flag for ${nationName}: ${flag}`);
      return true;
    }
    return false;
  }

  public canSetFlag(nationName: string): { canSet: boolean; timeRemaining?: number } {
    const stmt = this.db.prepare(`
      SELECT flag_set_at FROM nations WHERE name = ? COLLATE NOCASE
    `);
    
    const row = stmt.get(nationName) as any;
    if (!row || !row.flag_set_at) {
      return { canSet: true };
    }
    
    const lastSetTime = new Date(row.flag_set_at);
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    if (lastSetTime < threeHoursAgo) {
      return { canSet: true };
    }
    
    const timeRemaining = (lastSetTime.getTime() + 3 * 60 * 60 * 1000) - Date.now();
    return { canSet: false, timeRemaining };
  }

  // Capital management operations
  public setNationCapital(nationName: string, capital: string, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET capitol = ? 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(capital, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_CAPITAL', `Set capital for ${nationName}: ${capital}`);
      return true;
    }
    return false;
  }

  // Legacy method for backward compatibility
  public setNationCapitol(nationName: string, capitol: string, setBy: string): boolean {
    return this.setNationCapital(nationName, capitol, setBy);
  }

  // War management operations
  public endWar(warId: number, adminId: string, reason?: string): War | null {
    const stmt = this.db.prepare(`
      UPDATE wars 
      SET status = 'ended', end_date = DATE('now') 
      WHERE id = ? AND status = 'active'
    `);
    
    const result = stmt.run(warId);
    
    if (result.changes > 0) {
      const war = this.getWarById(warId);
      if (war) {
        this.logAdminAction(adminId, 'END_WAR', `Ended war: ${war.name}${reason ? ` - Reason: ${reason}` : ''}`);
      }
      return war;
    }
    return null;
  }

  public getActiveWars(): War[] {
    const stmt = this.db.prepare(`
      SELECT id, name, participants, start_date, end_date, casualties, description, status
      FROM wars 
      WHERE status = 'active'
      ORDER BY start_date DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      participants: JSON.parse(row.participants),
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
    }));
  }

  // Audit log operations
  public getNationAuditLog(nationName: string, limit: number = 50): AuditLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, admin_id as adminId, action, details, timestamp
      FROM admin_actions 
      WHERE details LIKE ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(`%${nationName}%`, limit) as any[];
    return rows.map(row => ({
      ...row,
      adminUsername: row.adminId, // We'll resolve this in the command
      timestamp: new Date(row.timestamp),
      nationAffected: nationName,
    }));
  }

  // Law management operations
  public createLaw(name: string, bodyText: string, isPublic: boolean, nationName: string, createdBy: string, tags: string[] = []): Law | null {
    return this.transaction(() => {
      // Check if law name already exists for this nation
      const existingStmt = this.db.prepare(`
        SELECT id FROM laws WHERE name = ? AND nation_name = ? COLLATE NOCASE
      `);
      
      if (existingStmt.get(name, nationName)) {
        return null; // Law name already exists for this nation
      }

      // Create the law
      const lawStmt = this.db.prepare(`
        INSERT INTO laws (name, body_text, is_public, nation_name, created_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = lawStmt.run(name, bodyText, isPublic ? 1 : 0, nationName, createdBy);
      const lawId = result.lastInsertRowid as number;

      // Add tags if provided
      if (tags.length > 0) {
        const tagStmt = this.db.prepare(`
          INSERT OR IGNORE INTO law_tags (law_id, tag_id)
          SELECT ?, id FROM tags WHERE name = ? COLLATE NOCASE
        `);
        
        for (const tagName of tags) {
          tagStmt.run(lawId, tagName.trim());
        }
      }

      return this.getLawById(lawId);
    });
  }

  public getLawById(id: number): Law | null {
    const stmt = this.db.prepare(`
      SELECT id, name, body_text as bodyText, is_public as isPublic, 
             nation_name as nationName, created_by as createdBy, 
             created_at as createdAt, updated_at as updatedAt
      FROM laws WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  public getLawByName(name: string, nationName: string): Law | null {
    const stmt = this.db.prepare(`
      SELECT id, name, body_text as bodyText, is_public as isPublic, 
             nation_name as nationName, created_by as createdBy, 
             created_at as createdAt, updated_at as updatedAt
      FROM laws WHERE name = ? AND nation_name = ? COLLATE NOCASE
    `);

    const row = stmt.get(name, nationName) as any;
    if (!row) return null;

    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  public getLawWithTags(id: number): LawWithTags | null {
    const law = this.getLawById(id);
    if (!law) return null;

    const tagsStmt = this.db.prepare(`
      SELECT t.id, t.name, t.description, t.created_by as createdBy, t.created_at as createdAt
      FROM tags t
      JOIN law_tags lt ON t.id = lt.tag_id
      WHERE lt.law_id = ?
      ORDER BY t.name
    `);

    const tagRows = tagsStmt.all(id) as any[];
    const tags = tagRows.map(row => ({
      ...row,
      createdAt: new Date(row.createdAt),
    }));

    return { ...law, tags };
  }

  public searchLaws(options: {
    nationName?: string;
    tagName?: string;
    isPublic?: boolean;
    requestingUser?: string;
  }): LawWithTags[] {
    let query = `
      SELECT DISTINCT l.id, l.name, l.body_text as bodyText, l.is_public as isPublic, 
             l.nation_name as nationName, l.created_by as createdBy, 
             l.created_at as createdAt, l.updated_at as updatedAt
      FROM laws l
    `;
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.tagName) {
      query += ` JOIN law_tags lt ON l.id = lt.law_id
                 JOIN tags t ON lt.tag_id = t.id`;
      conditions.push('t.name = ? COLLATE NOCASE');
      params.push(options.tagName);
    }

    if (options.nationName) {
      conditions.push('l.nation_name = ? COLLATE NOCASE');
      params.push(options.nationName);
    }

    // Privacy filter: show public laws or laws created by the requesting user
    if (options.requestingUser) {
      conditions.push('(l.is_public = TRUE OR l.created_by = ?)');
      params.push(options.requestingUser);
    } else if (options.isPublic !== undefined) {
      conditions.push('l.is_public = ?');
      params.push(options.isPublic ? 1 : 0); // Convert boolean to integer for SQLite
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY l.created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => {
      const law = {
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };

      // Get tags for each law
      const tagsStmt = this.db.prepare(`
        SELECT t.id, t.name, t.description, t.created_by as createdBy, t.created_at as createdAt
        FROM tags t
        JOIN law_tags lt ON t.id = lt.tag_id
        WHERE lt.law_id = ?
        ORDER BY t.name
      `);

      const tagRows = tagsStmt.all(row.id) as any[];
      const tags = tagRows.map(tagRow => ({
        ...tagRow,
        createdAt: new Date(tagRow.createdAt),
      }));

      return { ...law, tags };
    });
  }

  // Tag management operations
  public createTag(name: string, description: string, createdBy: string): Tag | null {
    const stmt = this.db.prepare(`
      INSERT INTO tags (name, description, created_by)
      VALUES (?, ?, ?)
    `);

    try {
      const result = stmt.run(name, description, createdBy);
      return this.getTagById(result.lastInsertRowid as number);
    } catch (error) {
      // Tag name already exists
      return null;
    }
  }

  public getTagById(id: number): Tag | null {
    const stmt = this.db.prepare(`
      SELECT id, name, description, created_by as createdBy, created_at as createdAt
      FROM tags WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      createdAt: new Date(row.createdAt),
    };
  }

  public getTagByName(name: string): Tag | null {
    const stmt = this.db.prepare(`
      SELECT id, name, description, created_by as createdBy, created_at as createdAt
      FROM tags WHERE name = ? COLLATE NOCASE
    `);

    const row = stmt.get(name) as any;
    if (!row) return null;

    return {
      ...row,
      createdAt: new Date(row.createdAt),
    };
  }

  public getAllTags(itemsPerPage: number = 10, page: number = 1): { tags: Tag[]; totalCount: number } {
    const offset = (page - 1) * itemsPerPage;
    
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM tags');
    const totalCount = (countStmt.get() as any).count;

    const stmt = this.db.prepare(`
      SELECT id, name, description, created_by as createdBy, created_at as createdAt
      FROM tags 
      ORDER BY name
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(itemsPerPage, offset) as any[];
    const tags = rows.map(row => ({
      ...row,
      createdAt: new Date(row.createdAt),
    }));

    return { tags, totalCount };
  }

  public removeTag(name: string, removedBy: string, reason: string = 'Why not?'): boolean {
    return this.transaction(() => {
      const tag = this.getTagByName(name);
      if (!tag) return false;

      // Remove tag associations first
      const removeAssociationsStmt = this.db.prepare(`
        DELETE FROM law_tags WHERE tag_id = ?
      `);
      removeAssociationsStmt.run(tag.id);

      // Remove the tag
      const removeTagStmt = this.db.prepare(`
        DELETE FROM tags WHERE id = ?
      `);
      const result = removeTagStmt.run(tag.id);

      if (result.changes > 0) {
        this.logAdminAction(removedBy, 'REMOVE_TAG', `Removed tag: ${name} - Reason: ${reason}`);
        return true;
      }
      return false;
    });
  }

  // Nation description operations
  public setNationDescription(nationName: string, description: string, setBy: string): boolean {
    // First, add description column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN description TEXT`);
    } catch (error) {
      // Column already exists, ignore error
    }

    const stmt = this.db.prepare(`
      UPDATE nations 
      SET description = ? 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(description, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_DESCRIPTION', `Set description for ${nationName}`);
      return true;
    }
    return false;
  }

  // Military readiness operations
  public setMilitaryReadiness(nationName: string, readiness: number, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET military_readiness = ? 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(readiness, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_MILITARY_READINESS', `Set military readiness for ${nationName}: ${readiness}/10`);
      return true;
    }
    return false;
  }

  public deleteLaw(lawId: number, deletedBy: string): boolean {
    return this.transaction(() => {
      // Get law details for logging
      const law = this.getLawById(lawId);
      if (!law) return false;

      // Remove tag associations first
      const removeTagsStmt = this.db.prepare(`
        DELETE FROM law_tags WHERE law_id = ?
      `);
      removeTagsStmt.run(lawId);

      // Delete the law
      const deleteLawStmt = this.db.prepare(`
        DELETE FROM laws WHERE id = ?
      `);
      const result = deleteLawStmt.run(lawId);

      if (result.changes > 0) {
        this.logAdminAction(deletedBy, 'DELETE_LAW', `Deleted law: ${law.name} from nation ${law.nationName}`);
        return true;
      }
      return false;
    });
  }

  // Tax rate operations
  public setTaxRate(nationName: string, taxRate: number, setBy: string): boolean {
    // First, add tax_rate_changed_at column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN tax_rate_changed_at DATETIME`);
    } catch (error) {
      // Column already exists, ignore error
    }

    const stmt = this.db.prepare(`
      UPDATE nations 
      SET tax_rate = ?, tax_rate_changed_at = CURRENT_TIMESTAMP 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(taxRate, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_TAX_RATE', `Set tax rate for ${nationName}: ${taxRate}%`);
      return true;
    }
    return false;
  }

  public canChangeTaxRate(nationName: string): { canChange: boolean; timeRemaining?: number } {
    // First, add tax_rate_changed_at column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN tax_rate_changed_at DATETIME`);
    } catch (error) {
      // Column already exists, ignore error
    }

    const stmt = this.db.prepare(`
      SELECT tax_rate_changed_at FROM nations WHERE name = ? COLLATE NOCASE
    `);
    
    const row = stmt.get(nationName) as any;
    if (!row || !row.tax_rate_changed_at) {
      return { canChange: true };
    }
    
    const lastChangeTime = new Date(row.tax_rate_changed_at);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    if (lastChangeTime < sevenDaysAgo) {
      return { canChange: true };
    }
    
    const timeRemaining = (lastChangeTime.getTime() + 7 * 24 * 60 * 60 * 1000) - Date.now();
    return { canChange: false, timeRemaining };
  }
}