import Database from 'better-sqlite3';
import { DatabaseConfig, NationStats, War, UserLink, UserActivity, AdminAction, AuditLogEntry, Law, LawWithTags, Tag } from '../types';
import { Logger } from '../utils/Logger';
import { safeJsonParse } from '../utils/CommandUtils';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export class DatabaseManager {
  private db: Database.Database;
  private logger: Logger;

  constructor(config: DatabaseConfig, logger: Logger) {
    this.logger = logger;
    
    // Ensure the database directory exists
    const dbDir = dirname(config.path);
    try {
      mkdirSync(dbDir, { recursive: true });
      this.logger.info(`Database directory ensured: ${dbDir}`);
    } catch (error) {
      this.logger.error(`Failed to create database directory: ${dbDir}`, { error: error as Error });
      throw error;
    }
    
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

    // Add new military stats columns
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN ground_strength REAL DEFAULT 5.0 CHECK (ground_strength >= 0 AND ground_strength <= 10)`);
    } catch (error) {
      // Column already exists, ignore error
    }
    
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN naval_strength REAL DEFAULT 5.0 CHECK (naval_strength >= 0 AND naval_strength <= 10)`);
    } catch (error) {
      // Column already exists, ignore error
    }
    
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN air_strength REAL DEFAULT 5.0 CHECK (air_strength >= 0 AND air_strength <= 10)`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add VP support column
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN vice_president TEXT`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add tax rate change tracking
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN tax_rate_changed_at DATETIME`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add new enhanced nation features
    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN government_type TEXT DEFAULT 'Democracy'`);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN provincial_capitals TEXT`); // JSON array of up to 3 capitals
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN national_debt REAL DEFAULT 0 CHECK (national_debt >= 0)`);
    } catch (error) {
      // Column already exists, ignore error
    }



    try {
      this.db.exec(`ALTER TABLE nations ADD COLUMN trading_partners TEXT`); // JSON array of trading partners
    } catch (error) {
      // Column already exists, ignore error
    }

    // Create user links table with role support
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE NOT NULL,
        nation_name TEXT NOT NULL COLLATE NOCASE,
        role TEXT DEFAULT 'president' CHECK (role IN ('president', 'vice_president')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Add role column to existing user_links table (for backward compatibility)
    try {
      this.db.exec(`ALTER TABLE user_links ADD COLUMN role TEXT DEFAULT 'president' CHECK (role IN ('president', 'vice_president'))`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Remove any citizen roles and convert them to president
    try {
      this.db.exec(`UPDATE user_links SET role = 'president' WHERE role = 'citizen'`);
    } catch (error) {
      // Ignore errors
    }

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
        edited_at DATETIME,
        edited_by TEXT,
        original_text TEXT,
        FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE(name, nation_name)
      )
    `);

    // Add missing columns to existing laws table (for backward compatibility)
    try {
      this.db.exec(`ALTER TABLE laws ADD COLUMN edited_at DATETIME`);
    } catch (error) {
      // Column already exists, ignore error
    }
    
    try {
      this.db.exec(`ALTER TABLE laws ADD COLUMN edited_by TEXT`);
    } catch (error) {
      // Column already exists, ignore error
    }
    
    try {
      this.db.exec(`ALTER TABLE laws ADD COLUMN original_text TEXT`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add map_type column to existing map_settings table (for backward compatibility)
    try {
      this.db.exec(`ALTER TABLE map_settings ADD COLUMN map_type TEXT DEFAULT 'world' CHECK (map_type IN ('world', 'alliance'))`);
    } catch (error) {
      // Column already exists, ignore error
    }

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

    // Create multi-alliance system tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS multi_alliances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description TEXT,
        leader_nation TEXT NOT NULL COLLATE NOCASE,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (leader_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS multi_alliance_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alliance_id INTEGER NOT NULL,
        nation_name TEXT NOT NULL COLLATE NOCASE,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        joined_by TEXT NOT NULL,
        FOREIGN KEY (alliance_id) REFERENCES multi_alliances(id) ON DELETE CASCADE,
        FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE(alliance_id, nation_name)
      )
    `);

    // Create map settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS map_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map_url TEXT NOT NULL,
        map_description TEXT,
        map_type TEXT NOT NULL DEFAULT 'world' CHECK (map_type IN ('world', 'alliance')),
        set_by TEXT NOT NULL,
        set_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(map_type)
      )
    `);

    // Fix any existing NULL map_type values
    this.db.exec(`
      UPDATE map_settings 
      SET map_type = 'world' 
      WHERE map_type IS NULL
    `);

    // Create loans table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        lender_nation TEXT NOT NULL COLLATE NOCASE,
        borrower_nation TEXT NOT NULL COLLATE NOCASE,
        amount REAL NOT NULL CHECK (amount > 0),
        interest_rate REAL NOT NULL CHECK (interest_rate >= 0),
        term_months INTEGER NOT NULL CHECK (term_months > 0),
        loan_type TEXT DEFAULT 'compound' CHECK (loan_type IN ('compound', 'amortizing')),
        monthly_payment REAL CHECK (monthly_payment > 0),
        remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paid_off', 'defaulted', 'declined')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
        declined_at DATETIME,
        due_date DATETIME NOT NULL,
        last_payment DATETIME,
        FOREIGN KEY (lender_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (borrower_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Add new columns to existing loans table (for backward compatibility)
    try {
      // Check if loan_code column exists first
      const columns = this.db.prepare(`PRAGMA table_info(loans)`).all();
      const hasLoanCode = columns.some((col: any) => col.name === 'loan_code');
      
      if (!hasLoanCode) {
        this.db.exec(`ALTER TABLE loans ADD COLUMN loan_code TEXT`);
        this.logger.info('Added loan_code column to loans table');
        
        // Create index for the new column
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_loans_loan_code ON loans(loan_code)');
      }
    } catch (error) {
      this.logger.error('Failed to add loan_code column', { error: error as Error });
    }

    try {
      // Check if description column exists first
      const columns = this.db.prepare(`PRAGMA table_info(loans)`).all();
      const hasDescription = columns.some((col: any) => col.name === 'description');
      
      if (!hasDescription) {
        this.db.exec(`ALTER TABLE loans ADD COLUMN description TEXT`);
        this.logger.info('Added description column to loans table');
      }
    } catch (error) {
      this.logger.error('Failed to add description column', { error: error as Error });
    }

    // Add loan_type column to existing loans table (for backward compatibility)
    try {
      this.db.exec(`ALTER TABLE loans ADD COLUMN loan_type TEXT DEFAULT 'compound' CHECK (loan_type IN ('compound', 'amortizing'))`);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Generate loan codes for existing loans without them
    try {
      // First check if loan_code column exists
      const columns = this.db.prepare(`PRAGMA table_info(loans)`).all();
      const hasLoanCode = columns.some((col: any) => col.name === 'loan_code');
      
      if (hasLoanCode) {
        const existingLoans = this.db.prepare(`SELECT id FROM loans WHERE loan_code IS NULL`).all();
        for (const loan of existingLoans) {
          // Generate a simple loan code without checking for duplicates during migration
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let loanCode = 'LOAN-';
          for (let i = 0; i < 6; i++) {
            loanCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          this.db.prepare(`UPDATE loans SET loan_code = ? WHERE id = ?`).run(loanCode, (loan as any).id);
        }
      }
    } catch (error) {
      // Ignore errors during migration
    }

    // Remove NOT NULL constraint from monthly_payment for compound loans
    try {
      this.db.exec(`
        CREATE TABLE loans_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lender_nation TEXT NOT NULL COLLATE NOCASE,
          borrower_nation TEXT NOT NULL COLLATE NOCASE,
          amount REAL NOT NULL CHECK (amount > 0),
          interest_rate REAL NOT NULL CHECK (interest_rate >= 0),
          term_months INTEGER NOT NULL CHECK (term_months > 0),
          loan_type TEXT DEFAULT 'compound' CHECK (loan_type IN ('compound', 'amortizing')),
          monthly_payment REAL CHECK (monthly_payment > 0),
          remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paid_off', 'defaulted', 'declined')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          accepted_at DATETIME,
          declined_at DATETIME,
          due_date DATETIME NOT NULL,
          last_payment DATETIME,
          FOREIGN KEY (lender_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (borrower_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
        );
        INSERT INTO loans_new SELECT 
          id, lender_nation, borrower_nation, amount, interest_rate, term_months, 
          COALESCE(loan_type, 'compound'), monthly_payment, remaining_balance, status, 
          created_at, accepted_at, declined_at, due_date, last_payment 
        FROM loans;
        DROP TABLE loans;
        ALTER TABLE loans_new RENAME TO loans;
        CREATE INDEX idx_loans_lender ON loans(lender_nation);
        CREATE INDEX idx_loans_borrower ON loans(borrower_nation);
        CREATE INDEX idx_loans_status ON loans(status);
      `);
    } catch (error) {
      // Migration already done or failed, ignore
    }

    // Create international relations tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS international_countries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL COLLATE NOCASE,
        code TEXT UNIQUE NOT NULL, -- ISO country code (US, CA, GB, etc.)
        continent TEXT NOT NULL,
        region TEXT,
        capital TEXT,
        population INTEGER,
        gdp_usd REAL, -- GDP in USD billions
        government_type TEXT,
        head_of_state TEXT,
        diplomatic_status TEXT DEFAULT 'neutral' CHECK (diplomatic_status IN ('allied', 'friendly', 'neutral', 'tense', 'hostile')),
        trade_status TEXT DEFAULT 'normal' CHECK (trade_status IN ('free_trade', 'normal', 'restricted', 'embargo')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS diplomatic_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_code TEXT UNIQUE NOT NULL,
        requesting_nation TEXT NOT NULL COLLATE NOCASE, -- US state/nation making request
        target_country TEXT NOT NULL COLLATE NOCASE, -- International country
        request_type TEXT NOT NULL CHECK (request_type IN (
          'trade_agreement', 'diplomatic_recognition', 'embassy_establishment',
          'military_cooperation', 'cultural_exchange', 'economic_aid',
          'sanctions_request', 'peace_treaty', 'alliance_proposal',
          'immigration_agreement', 'extradition_treaty', 'climate_accord'
        )),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        proposed_terms TEXT,
        economic_impact TEXT,
        political_justification TEXT,
        expected_duration TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')),
        requested_by TEXT NOT NULL, -- Discord user ID
        reviewed_by TEXT, -- Admin Discord user ID
        admin_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        expires_at DATETIME,
        FOREIGN KEY (requesting_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (target_country) REFERENCES international_countries(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS diplomatic_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        us_nation TEXT NOT NULL COLLATE NOCASE,
        international_country TEXT NOT NULL COLLATE NOCASE,
        relation_type TEXT NOT NULL CHECK (relation_type IN (
          'trade_agreement', 'embassy', 'military_cooperation', 'cultural_exchange',
          'economic_aid', 'sanctions', 'alliance', 'immigration_pact', 'climate_accord'
        )),
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
        terms TEXT,
        economic_benefit REAL DEFAULT 0,
        political_influence REAL DEFAULT 0,
        established_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        last_reviewed DATETIME,
        established_by TEXT, -- Admin who approved
        FOREIGN KEY (us_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (international_country) REFERENCES international_countries(name) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE(us_nation, international_country, relation_type)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS diplomatic_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL CHECK (event_type IN (
          'request_submitted', 'request_approved', 'request_rejected',
          'relation_established', 'relation_terminated', 'crisis_event',
          'trade_dispute', 'diplomatic_incident', 'summit_meeting'
        )),
        us_nation TEXT COLLATE NOCASE,
        international_country TEXT COLLATE NOCASE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        impact_score INTEGER DEFAULT 0, -- -100 to +100
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (us_nation) REFERENCES nations(name) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (international_country) REFERENCES international_countries(name) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    // Create investments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        investor_nation TEXT NOT NULL COLLATE NOCASE,
        target_nation TEXT NOT NULL COLLATE NOCASE,
        amount REAL NOT NULL CHECK (amount > 0),
        investment_type TEXT NOT NULL CHECK (investment_type IN ('infrastructure', 'military', 'technology', 'education', 'healthcare')),
        expected_return REAL NOT NULL CHECK (expected_return >= 0),
        duration INTEGER NOT NULL CHECK (duration > 0),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'failed', 'declined')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        accepted_at DATETIME,
        declined_at DATETIME,
        maturity_date DATETIME NOT NULL,
        current_value REAL NOT NULL CHECK (current_value >= 0),
        FOREIGN KEY (investor_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (target_nation) REFERENCES international_countries(name) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Create indexes for better performance (with error handling for missing columns)
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_nations_name ON nations(name)',
      'CREATE INDEX IF NOT EXISTS idx_nations_last_rename ON nations(last_rename_at)',
      'CREATE INDEX IF NOT EXISTS idx_nations_flag_set_at ON nations(flag_set_at)',
      'CREATE INDEX IF NOT EXISTS idx_nations_capitol ON nations(capitol)',
      'CREATE INDEX IF NOT EXISTS idx_nations_gdp ON nations(gdp)',
      'CREATE INDEX IF NOT EXISTS idx_nations_population ON nations(population)',
      'CREATE INDEX IF NOT EXISTS idx_nations_stability ON nations(stability)',
      'CREATE INDEX IF NOT EXISTS idx_user_links_discord_id ON user_links(discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_links_nation_name ON user_links(nation_name)',
      'CREATE INDEX IF NOT EXISTS idx_user_links_role ON user_links(role)',
      'CREATE INDEX IF NOT EXISTS idx_wars_status ON wars(status)',
      'CREATE INDEX IF NOT EXISTS idx_wars_participants ON wars(participants)',
      'CREATE INDEX IF NOT EXISTS idx_wars_start_date ON wars(start_date)',
      'CREATE INDEX IF NOT EXISTS idx_alliances_status ON alliances(status)',
      'CREATE INDEX IF NOT EXISTS idx_alliances_nations ON alliances(nation1, nation2)',
      'CREATE INDEX IF NOT EXISTS idx_alliances_requested_by ON alliances(requested_by)',
      'CREATE INDEX IF NOT EXISTS idx_nation_renames_new_name ON nation_renames(new_name)',
      'CREATE INDEX IF NOT EXISTS idx_nation_renames_renamed_by ON nation_renames(renamed_by)',
      'CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_channel ON user_activity(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_activity_discord_id ON user_activity(discord_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id)',
      'CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions(action)',
      'CREATE INDEX IF NOT EXISTS idx_laws_nation_name ON laws(nation_name)',
      'CREATE INDEX IF NOT EXISTS idx_laws_is_public ON laws(is_public)',
      'CREATE INDEX IF NOT EXISTS idx_laws_created_by ON laws(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)',
      'CREATE INDEX IF NOT EXISTS idx_law_tags_law_id ON law_tags(law_id)',
      'CREATE INDEX IF NOT EXISTS idx_law_tags_tag_id ON law_tags(tag_id)',
      'CREATE INDEX IF NOT EXISTS idx_multi_alliances_name ON multi_alliances(name)',
      'CREATE INDEX IF NOT EXISTS idx_multi_alliances_leader ON multi_alliances(leader_nation)',
      'CREATE INDEX IF NOT EXISTS idx_multi_alliance_members_alliance ON multi_alliance_members(alliance_id)',
      'CREATE INDEX IF NOT EXISTS idx_multi_alliance_members_nation ON multi_alliance_members(nation_name)',
      'CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_nation)',
      'CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_nation)',
      'CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status)',
      'CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_nation)',
      'CREATE INDEX IF NOT EXISTS idx_investments_target ON investments(target_nation)',
      'CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status)',
      'CREATE INDEX IF NOT EXISTS idx_map_settings_type ON map_settings(map_type)',
      'CREATE INDEX IF NOT EXISTS idx_international_countries_name ON international_countries(name)',
      'CREATE INDEX IF NOT EXISTS idx_international_countries_code ON international_countries(code)',
      'CREATE INDEX IF NOT EXISTS idx_international_countries_continent ON international_countries(continent)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_requests_code ON diplomatic_requests(request_code)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_requests_status ON diplomatic_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_requests_nation ON diplomatic_requests(requesting_nation)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_requests_country ON diplomatic_requests(target_country)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_requests_type ON diplomatic_requests(request_type)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_requests_priority ON diplomatic_requests(priority)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_relations_nation ON diplomatic_relations(us_nation)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_relations_country ON diplomatic_relations(international_country)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_relations_type ON diplomatic_relations(relation_type)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_relations_status ON diplomatic_relations(status)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_events_nation ON diplomatic_events(us_nation)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_events_country ON diplomatic_events(international_country)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_events_type ON diplomatic_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_diplomatic_events_created_at ON diplomatic_events(created_at)'
    ];

    // Create indexes with individual error handling
    for (const query of indexQueries) {
      try {
        this.db.exec(query);
      } catch (error) {
        // Log but don't fail - some indexes might reference columns that don't exist yet
        this.logger.warn(`Failed to create index: ${query}`, { error: error as Error });
      }
    }

    // Create loan_code index only if the column exists
    try {
      const hasLoanCode = this.db.prepare(`PRAGMA table_info(loans)`).all()
        .some((col: any) => col.name === 'loan_code');
      
      if (hasLoanCode) {
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_loans_loan_code ON loans(loan_code)');
      }
    } catch (error) {
      this.logger.warn('Failed to create loan_code index', { error: error as Error });
    }

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

    // Create disasters table for tracking disaster occurrences and dynamic probabilities
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS disasters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        severity TEXT NOT NULL CHECK (severity IN ('very_small', 'small', 'medium', 'large', 'major', 'catastrophic')),
        category TEXT NOT NULL CHECK (category IN ('natural', 'artificial')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_regions TEXT NOT NULL,
        estimated_casualties INTEGER NOT NULL DEFAULT 0,
        economic_cost REAL NOT NULL DEFAULT 0,
        generated_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create disaster odds tracking table for Kappa's system
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS disaster_odds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        very_small_odds REAL NOT NULL DEFAULT 0.0,
        small_odds REAL NOT NULL DEFAULT 0.67,
        medium_odds REAL NOT NULL DEFAULT 0.20,
        large_odds REAL NOT NULL DEFAULT 0.10,
        major_odds REAL NOT NULL DEFAULT 0.025,
        catastrophic_odds REAL NOT NULL DEFAULT 0.005,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )
    `);

    // Initialize default odds if table is empty
    this.db.exec(`
      INSERT OR IGNORE INTO disaster_odds (id, updated_by) 
      SELECT 1, 'system' 
      WHERE NOT EXISTS (SELECT 1 FROM disaster_odds WHERE id = 1)
    `);

    // Create index for efficient severity lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_disasters_severity_date ON disasters(severity, created_at DESC)
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_multi_alliances_timestamp 
      AFTER UPDATE ON multi_alliances
      BEGIN
        UPDATE multi_alliances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);

    this.logger.info('Database schema initialized successfully');
    
    // Ensure loans table has all required columns
    try {
      this.repairLoansTable();
    } catch (error) {
      this.logger.warn('Failed to repair loans table during initialization', { error: error as Error });
    }
  }

  /**
   * Safely close the database connection
   */
  public close(): void {
    try {
      if (this.db) {
        this.db.close();
        this.logger.info('Database connection closed successfully');
      }
    } catch (error) {
      this.logger.error('Error closing database connection:', { error: error as Error });
    }
  }

  /**
   * Check if database connection is open
   */
  public isOpen(): boolean {
    try {
      return this.db && this.db.open;
    } catch {
      return false;
    }
  }

  // Nation operations
  public createOrUpdateNation(stats: Omit<NationStats, 'budget' | 'gdpPerCapita' | 'gdpChange' | 'populationChange' | 'updatedAt' | 'leader'>): NationStats {
    // Check if this is an update (nation exists) to preserve flag data
    const existingNation = this.getNationByName(stats.name);
    const isUpdate = existingNation !== null;
    
    // For updates, preserve existing flag data if not explicitly provided
    let flagToUse = stats.flag;
    let flagSetAtToUse = stats.flagSetAt;
    
    if (isUpdate && stats.flag === undefined) {
      // Preserve existing flag data when updating without flag info
      flagToUse = existingNation.flag;
      flagSetAtToUse = existingNation.flagSetAt;
    }

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
        flag = excluded.flag,
        flag_set_at = excluded.flag_set_at,
        capitol = COALESCE(excluded.capitol, nations.capitol)
    `);

    stmt.run(
      stats.name,
      stats.gdp,
      stats.stability,
      stats.population,
      stats.taxRate,
      flagToUse || null,
      flagSetAtToUse?.toISOString() || null,
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
             n.flag, n.flag_set_at as flagSetAt, n.capitol as capital, n.description, 
             n.ground_strength as groundStrength,
             n.naval_strength as navalStrength, n.air_strength as airStrength,
             n.government_type as governmentType, n.provincial_capitals as provincialCapitals,
             n.national_debt as nationalDebt,
             n.trading_partners as tradingPartners,
             ul.discord_id as leaderDiscordId
      FROM nations n 
      LEFT JOIN user_links ul ON n.name = ul.nation_name COLLATE NOCASE AND ul.role = 'president'
      WHERE n.name = ? COLLATE NOCASE
    `);

    const row = stmt.get(name) as any;
    if (!row) return null;

    return {
      ...row,
      updatedAt: new Date(row.updatedAt),
      flagSetAt: row.flagSetAt ? new Date(row.flagSetAt) : undefined,
      leader: row.leaderDiscordId || undefined,
      provincialCapitals: safeJsonParse(row.provincialCapitals, []),
      tradingPartners: safeJsonParse(row.tradingPartners, []),
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

  public getNationsByRanking(category: 'gdp' | 'population' | 'stability' | 'tax_rate' | 'gdp_per_capita' | 'air_strength' | 'naval_strength' | 'ground_strength', limit: number = 10): NationStats[] {
    // Use separate queries for each category to avoid SQL injection
    let stmt;
    
    switch (category) {
      case 'gdp':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY gdp DESC
          LIMIT ?
        `);
        break;
      case 'population':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY population DESC
          LIMIT ?
        `);
        break;
      case 'stability':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY stability DESC
          LIMIT ?
        `);
        break;
      case 'tax_rate':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY tax_rate DESC
          LIMIT ?
        `);
        break;
      case 'gdp_per_capita':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY gdp_per_capita DESC
          LIMIT ?
        `);
        break;
      case 'air_strength':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY air_strength DESC NULLS LAST
          LIMIT ?
        `);
        break;
      case 'naval_strength':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY naval_strength DESC NULLS LAST
          LIMIT ?
        `);
        break;
      case 'ground_strength':
        stmt = this.db.prepare(`
          SELECT name, gdp, stability, population, tax_rate as taxRate, budget,
                 gdp_per_capita as gdpPerCapita, gdp_change as gdpChange, 
                 population_change as populationChange, updated_at as updatedAt,
                 ground_strength as groundStrength,
                 naval_strength as navalStrength, air_strength as airStrength
          FROM nations 
          ORDER BY ground_strength DESC NULLS LAST
          LIMIT ?
        `);
        break;
      default:
        throw new Error(`Invalid ranking category: ${category}`);
    }

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      updatedAt: new Date(row.updatedAt),
    }));
  }

  // User link operations
  public createOrUpdateUserLink(discordId: string, nationName: string): UserLink {
    return this.createOrUpdateUserLinkWithRole(discordId, nationName, 'president');
  }

  public createOrUpdateUserLinkWithRole(discordId: string, nationName: string, role: string = 'president'): UserLink {
    // Check if this user is already linked to this nation
    const existingUserLink = this.getUserLink(discordId);
    
    if (existingUserLink && existingUserLink.nationName === nationName) {
      // User is already linked to this nation, just update their role
      const stmt = this.db.prepare(`
        UPDATE user_links 
        SET role = ?
        WHERE discord_id = ? AND nation_name = ? COLLATE NOCASE
      `);
      stmt.run(role, discordId, nationName);
    } else {
      // Check if someone else already has this role for this nation
      const existingRoleLink = this.getUserByNationAndRole(nationName, role);
      if (existingRoleLink) {
        // Remove the existing role holder
        const deleteStmt = this.db.prepare(`
          DELETE FROM user_links 
          WHERE nation_name = ? COLLATE NOCASE AND role = ?
        `);
        deleteStmt.run(nationName, role);
      }
      
      // Remove user's existing link if they have one
      if (existingUserLink) {
        const deleteUserStmt = this.db.prepare(`
          DELETE FROM user_links WHERE discord_id = ?
        `);
        deleteUserStmt.run(discordId);
      }
      
      // Create new link
      const stmt = this.db.prepare(`
        INSERT INTO user_links (discord_id, nation_name, role)
        VALUES (?, ?, ?)
      `);
      stmt.run(discordId, nationName, role);
    }

    return this.getUserLink(discordId)!;
  }

  public getUserLink(discordId: string): UserLink | null {
    const stmt = this.db.prepare(`
      SELECT id, discord_id as discordId, nation_name as nationName, role, created_at as createdAt
      FROM user_links 
      WHERE discord_id = ?
    `);

    const row = stmt.get(discordId) as any;
    if (!row) return null;

    return {
      ...row,
      role: row.role || 'president', // Default to president for backward compatibility
      createdAt: new Date(row.createdAt),
    };
  }

  public getUserByNation(nationName: string): UserLink | null {
    const stmt = this.db.prepare(`
      SELECT id, discord_id as discordId, nation_name as nationName, role, created_at as createdAt
      FROM user_links 
      WHERE nation_name = ? COLLATE NOCASE
      ORDER BY 
        CASE role 
          WHEN 'president' THEN 1 
          WHEN 'vice_president' THEN 2 
          ELSE 3 
        END
      LIMIT 1
    `);

    const row = stmt.get(nationName) as any;
    if (!row) return null;

    return {
      ...row,
      role: row.role || 'president', // Default to president for backward compatibility
      createdAt: new Date(row.createdAt),
    };
  }

  public getUserByNationAndRole(nationName: string, role: string): UserLink | null {
    const stmt = this.db.prepare(`
      SELECT id, discord_id as discordId, nation_name as nationName, role, created_at as createdAt
      FROM user_links 
      WHERE nation_name = ? COLLATE NOCASE AND role = ?
    `);

    const row = stmt.get(nationName, role) as any;
    if (!row) return null;

    return {
      ...row,
      role: row.role || 'president',
      createdAt: new Date(row.createdAt),
    };
  }

  public getAllUsersByNation(nationName: string): UserLink[] {
    const stmt = this.db.prepare(`
      SELECT id, discord_id as discordId, nation_name as nationName, role, created_at as createdAt
      FROM user_links 
      WHERE nation_name = ? COLLATE NOCASE
      ORDER BY 
        CASE role 
          WHEN 'president' THEN 1 
          WHEN 'vice_president' THEN 2 
          ELSE 3 
        END
    `);

    const rows = stmt.all(nationName) as any[];
    return rows.map(row => ({
      ...row,
      role: row.role || 'president',
      createdAt: new Date(row.createdAt),
    }));
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
      participants: safeJsonParse(row.participants, []),
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
      participants: safeJsonParse(row.participants, []),
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
    // Validate nation exists
    const nation = this.getNationByName(nationName);
    if (!nation) {
      throw new Error('Nation not found');
    }

    // Validate flag format
    if (!flag || typeof flag !== 'string' || flag.trim().length === 0) {
      throw new Error('Flag cannot be empty');
    }

    const stmt = this.db.prepare(`
      UPDATE nations 
      SET flag = ?, flag_set_at = CURRENT_TIMESTAMP 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(flag.trim(), nationName);
    
    if (result.changes > 0) {
      // Verify the flag was set correctly
      const verifyStmt = this.db.prepare('SELECT flag FROM nations WHERE name = ? COLLATE NOCASE');
      const stored = verifyStmt.get(nationName) as { flag: string } | undefined;
      
      if (!stored || stored.flag !== flag.trim()) {
        throw new Error('Failed to verify flag storage');
      }
      
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
      participants: safeJsonParse(row.participants, []),
      startDate: new Date(row.start_date),
      endDate: row.end_date ? new Date(row.end_date) : undefined,
    }));
  }

  // Audit log operations
  public getNationAuditLog(nationName: string, limit: number = 50): AuditLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, admin_id as adminId, action, details, timestamp
      FROM admin_actions 
      WHERE details LIKE ? OR details LIKE ? OR details LIKE ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    // Try multiple search patterns to catch different ways the nation name might appear
    const patterns = [
      `%${nationName}%`,
      `%${nationName}:%`,
      `%"${nationName}"%`
    ];

    const rows = stmt.all(...patterns, limit) as any[];
    return rows.map(row => ({
      ...row,
      adminUsername: row.adminId || 'System', // Default to System if no admin ID
      timestamp: new Date(row.timestamp),
      nationAffected: nationName,
    }));
  }

  /**
   * Get all admin actions (for general audit purposes)
   */
  public getAllAdminActions(limit: number = 50): AuditLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, admin_id as adminId, action, details, timestamp
      FROM admin_actions 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      adminUsername: row.adminId || 'System',
      timestamp: new Date(row.timestamp),
      nationAffected: this.extractNationFromDetails(row.details),
    }));
  }

  /**
   * Extract nation name from audit details
   */
  private extractNationFromDetails(details: string): string | undefined {
    if (!details) return undefined;
    
    // Try to extract nation name from common patterns
    const patterns = [
      /Updated ([^:]+):/,
      /Nation "([^"]+)"/,
      /nation ([^,\s]+)/i,
      /([A-Z][a-zA-Z\s]+):/
    ];
    
    for (const pattern of patterns) {
      const match = details.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  // International Relations operations
  public createInternationalCountry(
    name: string,
    code: string,
    continent: string,
    region: string,
    capital: string,
    population: number,
    gdpUsd: number,
    governmentType: string,
    headOfState: string
  ): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO international_countries 
        (name, code, continent, region, capital, population, gdp_usd, government_type, head_of_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(name, code, continent, region, capital, population, gdpUsd, governmentType, headOfState);
      return true;
    } catch (error) {
      this.logger.error('Error creating international country:', { error: error as Error });
      return false;
    }
  }

  public getAllInternationalCountries(): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM international_countries 
      ORDER BY name
    `);
    return stmt.all();
  }

  public getInternationalCountryByName(name: string): any | null {
    const stmt = this.db.prepare(`
      SELECT * FROM international_countries 
      WHERE name = ? COLLATE NOCASE
    `);
    return stmt.get(name) || null;
  }

  public searchInternationalCountries(searchTerm: string, limit: number = 25): any[] {
    const stmt = this.db.prepare(`
      SELECT name, code, continent, capital
      FROM international_countries 
      WHERE name LIKE ? OR code LIKE ? COLLATE NOCASE
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN name LIKE ? THEN 2
          ELSE 3
        END,
        name
      LIMIT ?
    `);

    const searchPattern = `%${searchTerm}%`;
    const exactPattern = searchTerm;
    const startsWithPattern = `${searchTerm}%`;

    return stmt.all(searchPattern, searchPattern, exactPattern, startsWithPattern, limit);
  }

  private generateDiplomaticRequestCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'DIPL-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const existing = this.db.prepare(`SELECT id FROM diplomatic_requests WHERE request_code = ?`).get(code);
    if (existing) {
      return this.generateDiplomaticRequestCode(); // Try again if duplicate
    }
    
    return code;
  }

  public createDiplomaticRequest(
    requestingNation: string,
    targetCountry: string,
    requestType: string,
    priority: string,
    title: string,
    description: string,
    proposedTerms: string,
    economicImpact: string,
    politicalJustification: string,
    expectedDuration: string,
    requestedBy: string
  ): { success: boolean; code?: string; error?: string } {
    try {
      const requestCode = this.generateDiplomaticRequestCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days

      const stmt = this.db.prepare(`
        INSERT INTO diplomatic_requests 
        (request_code, requesting_nation, target_country, request_type, priority, title, description,
         proposed_terms, economic_impact, political_justification, expected_duration, requested_by, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        requestCode, requestingNation, targetCountry, requestType, priority, title, description,
        proposedTerms, economicImpact, politicalJustification, expectedDuration, requestedBy, expiresAt.toISOString()
      );

      return { success: true, code: requestCode };
    } catch (error) {
      this.logger.error('Error creating diplomatic request:', { error: error as Error });
      return { success: false, error: (error as Error).message };
    }
  }

  public getDiplomaticRequestByCode(code: string): any | null {
    const stmt = this.db.prepare(`
      SELECT dr.*, ic.name as country_full_name, ic.continent, ic.capital
      FROM diplomatic_requests dr
      LEFT JOIN international_countries ic ON dr.target_country = ic.name COLLATE NOCASE
      WHERE dr.request_code = ?
    `);
    return stmt.get(code) || null;
  }

  public getDiplomaticRequestsByStatus(status: string, limit: number = 50): any[] {
    const stmt = this.db.prepare(`
      SELECT dr.*, ic.name as country_full_name, ic.continent, ic.capital
      FROM diplomatic_requests dr
      LEFT JOIN international_countries ic ON dr.target_country = ic.name COLLATE NOCASE
      WHERE dr.status = ?
      ORDER BY 
        CASE dr.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        dr.created_at DESC
      LIMIT ?
    `);
    return stmt.all(status, limit);
  }

  public getDiplomaticRequestsByNation(nationName: string, limit: number = 25): any[] {
    const stmt = this.db.prepare(`
      SELECT dr.*, ic.name as country_full_name, ic.continent, ic.capital
      FROM diplomatic_requests dr
      LEFT JOIN international_countries ic ON dr.target_country = ic.name COLLATE NOCASE
      WHERE dr.requesting_nation = ? COLLATE NOCASE
      ORDER BY dr.created_at DESC
      LIMIT ?
    `);
    return stmt.all(nationName, limit);
  }

  public reviewDiplomaticRequest(
    requestCode: string,
    adminId: string,
    decision: 'approved' | 'rejected',
    adminNotes?: string
  ): boolean {
    return this.transaction(() => {
      try {
        // Update the request
        const updateStmt = this.db.prepare(`
          UPDATE diplomatic_requests 
          SET status = ?, reviewed_by = ?, admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP
          WHERE request_code = ?
        `);
        
        const result = updateStmt.run(decision, adminId, adminNotes || '', requestCode);
        
        if (result.changes === 0) {
          return false;
        }

        // If approved, create the diplomatic relation
        if (decision === 'approved') {
          const request = this.getDiplomaticRequestByCode(requestCode);
          if (request) {
            this.createDiplomaticRelation(
              request.requesting_nation,
              request.target_country,
              request.request_type,
              request.proposed_terms,
              adminId
            );
          }
        }

        // Log the event
        const request = this.getDiplomaticRequestByCode(requestCode);
        if (request) {
          this.createDiplomaticEvent(
            decision === 'approved' ? 'request_approved' : 'request_rejected',
            request.requesting_nation,
            request.target_country,
            `Diplomatic request ${decision}`,
            `Request "${request.title}" has been ${decision} by admin`,
            decision === 'approved' ? 25 : -10,
            adminId
          );
        }

        return true;
      } catch (error) {
        this.logger.error('Error reviewing diplomatic request:', { error: error as Error });
        return false;
      }
    });
  }

  public createDiplomaticRelation(
    usNation: string,
    internationalCountry: string,
    relationType: string,
    terms: string,
    establishedBy: string
  ): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO diplomatic_relations 
        (us_nation, international_country, relation_type, terms, established_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(usNation, internationalCountry, relationType, terms, establishedBy);
      return true;
    } catch (error) {
      this.logger.error('Error creating diplomatic relation:', { error: error as Error });
      return false;
    }
  }

  public getDiplomaticRelationsByNation(nationName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT dr.*, ic.name as country_full_name, ic.continent, ic.capital, ic.head_of_state
      FROM diplomatic_relations dr
      LEFT JOIN international_countries ic ON dr.international_country = ic.name COLLATE NOCASE
      WHERE dr.us_nation = ? COLLATE NOCASE AND dr.status = 'active'
      ORDER BY dr.established_at DESC
    `);
    return stmt.all(nationName);
  }

  public createDiplomaticEvent(
    eventType: string,
    usNation: string,
    internationalCountry: string,
    title: string,
    description: string,
    impactScore: number,
    createdBy: string
  ): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO diplomatic_events 
        (event_type, us_nation, international_country, title, description, impact_score, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(eventType, usNation, internationalCountry, title, description, impactScore, createdBy);
      return true;
    } catch (error) {
      this.logger.error('Error creating diplomatic event:', { error: error as Error });
      return false;
    }
  }

  public getDiplomaticEventsByNation(nationName: string, limit: number = 25): any[] {
    const stmt = this.db.prepare(`
      SELECT de.*, ic.name as country_full_name
      FROM diplomatic_events de
      LEFT JOIN international_countries ic ON de.international_country = ic.name COLLATE NOCASE
      WHERE de.us_nation = ? COLLATE NOCASE
      ORDER BY de.created_at DESC
      LIMIT ?
    `);
    return stmt.all(nationName, limit);
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

  // Legacy method for backward compatibility (deprecated)
  public setMilitaryReadiness(nationName: string, readiness: number, setBy: string): boolean {
    // This method is deprecated and does nothing
    return true;
  }

  public setGroundStrength(nationName: string, strength: number, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET ground_strength = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(strength, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_GROUND_STRENGTH', `Set ground strength for ${nationName}: ${strength}/10`);
      return true;
    }
    return false;
  }

  public setNavalStrength(nationName: string, strength: number, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET naval_strength = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(strength, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_NAVAL_STRENGTH', `Set naval strength for ${nationName}: ${strength}/10`);
      return true;
    }
    return false;
  }

  public setAirStrength(nationName: string, strength: number, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET air_strength = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(strength, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_AIR_STRENGTH', `Set air strength for ${nationName}: ${strength}/10`);
      return true;
    }
    return false;
  }

  public deleteLaw(lawId: number, deletedBy?: string): boolean {
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
        if (deletedBy) {
          this.logAdminAction(deletedBy, 'DELETE_LAW', `Deleted law: ${law.name} from nation ${law.nationName}`);
        }
        return true;
      }
      return false;
    });
  }

  public editLaw(lawId: number, newText: string, editedBy: string, originalText?: string): void {
    const stmt = this.db.prepare(`
      UPDATE laws 
      SET body_text = ?, edited_at = CURRENT_TIMESTAMP, edited_by = ?, original_text = COALESCE(original_text, ?)
      WHERE id = ?
    `);
    stmt.run(newText, editedBy, originalText, lawId);
  }

  public renameLaw(lawId: number, newName: string): void {
    const stmt = this.db.prepare(`
      UPDATE laws 
      SET name = ?
      WHERE id = ?
    `);
    stmt.run(newName, lawId);
  }

  public getLawsByNation(nationName: string, includePrivate: boolean = false): any[] {
    let query = `
      SELECT * FROM laws 
      WHERE nation_name = ? COLLATE NOCASE
    `;
    
    if (!includePrivate) {
      query += ` AND is_public = 1`;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const stmt = this.db.prepare(query);
    return stmt.all(nationName);
  }

  public getLawByNameGlobal(lawName: string): any {
    const stmt = this.db.prepare(`
      SELECT * FROM laws 
      WHERE name = ? COLLATE NOCASE
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(lawName);
  }

  public getAllLaws(): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM laws 
      ORDER BY nation_name, name
    `);
    return stmt.all();
  }

  public transferLaw(lawId: number, newNationName: string): void {
    const stmt = this.db.prepare(`
      UPDATE laws 
      SET nation_name = ?
      WHERE id = ?
    `);
    stmt.run(newNationName, lawId);
  }

  public updateLawTags(lawId: number, tagNames: string[]): void {
    this.transaction(() => {
      // Remove existing tags
      const removeStmt = this.db.prepare(`
        DELETE FROM law_tags WHERE law_id = ?
      `);
      removeStmt.run(lawId);

      // Add new tags
      if (tagNames.length > 0) {
        const addStmt = this.db.prepare(`
          INSERT OR IGNORE INTO law_tags (law_id, tag_id)
          SELECT ?, id FROM tags WHERE name = ? COLLATE NOCASE
        `);
        
        for (const tagName of tagNames) {
          // Create tag if it doesn't exist
          const tag = this.getTagByName(tagName) || this.createTag(tagName, `Auto-created tag: ${tagName}`, 'system');
          if (tag) {
            addStmt.run(lawId, tagName.trim());
          }
        }
      }
    });
  }

  // Multi-Alliance System Methods
  public createMultiAlliance(name: string, description: string, leaderNation: string, createdBy: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO multi_alliances (name, description, leader_nation, created_by)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name, description, leaderNation, createdBy);
    
    // Add the leader as the first member
    this.joinMultiAlliance(result.lastInsertRowid as number, leaderNation, createdBy);
    
    return result.lastInsertRowid as number;
  }

  public getMultiAllianceByName(name: string): any {
    const stmt = this.db.prepare(`
      SELECT * FROM multi_alliances 
      WHERE name = ? COLLATE NOCASE
    `);
    return stmt.get(name);
  }

  public getAllMultiAlliances(): any[] {
    try {
      const stmt = this.db.prepare(`
        SELECT ma.*, COUNT(mam.nation_name) as memberCount
        FROM multi_alliances ma
        LEFT JOIN multi_alliance_members mam ON ma.id = mam.alliance_id
        GROUP BY ma.id
        ORDER BY ma.name
      `);
      const result = stmt.all();
      this.logger.debug(`getAllMultiAlliances returned ${result.length} alliances`);
      return result;
    } catch (error) {
      this.logger.error('Error in getAllMultiAlliances:', { error: error as Error });
      throw error;
    }
  }

  public getNationMultiAlliance(nationName: string): any {
    const stmt = this.db.prepare(`
      SELECT ma.* FROM multi_alliances ma
      JOIN multi_alliance_members mam ON ma.id = mam.alliance_id
      WHERE mam.nation_name = ? COLLATE NOCASE
      LIMIT 1
    `);
    return stmt.get(nationName);
  }

  public getNationMultiAlliances(nationName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT ma.* FROM multi_alliances ma
      JOIN multi_alliance_members mam ON ma.id = mam.alliance_id
      WHERE mam.nation_name = ? COLLATE NOCASE
      ORDER BY mam.joined_at
    `);
    return stmt.all(nationName);
  }

  public getMultiAllianceMembers(allianceId: number): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM multi_alliance_members 
      WHERE alliance_id = ?
      ORDER BY joined_at
    `);
    return stmt.all(allianceId);
  }

  public joinMultiAlliance(allianceId: number, nationName: string, joinedBy: string): void {
    // Check how many alliances the nation is already in
    const currentAlliancesStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM multi_alliance_members 
      WHERE nation_name = ? COLLATE NOCASE
    `);
    const result = currentAlliancesStmt.get(nationName) as any;
    const currentCount = result.count;

    if (currentCount >= 2) {
      const existingAlliancesStmt = this.db.prepare(`
        SELECT ma.name FROM multi_alliances ma
        JOIN multi_alliance_members mam ON ma.id = mam.alliance_id
        WHERE mam.nation_name = ? COLLATE NOCASE
      `);
      const existingAlliances = existingAlliancesStmt.all(nationName) as any[];
      const allianceNames = existingAlliances.map(a => a.name).join('", "');
      throw new Error(`Nation ${nationName} is already in the maximum number of alliances (2): "${allianceNames}"`);
    }

    // Check if already in this specific alliance
    const alreadyInThisAllianceStmt = this.db.prepare(`
      SELECT 1 FROM multi_alliance_members 
      WHERE alliance_id = ? AND nation_name = ? COLLATE NOCASE
    `);
    const alreadyInThis = alreadyInThisAllianceStmt.get(allianceId, nationName);
    if (alreadyInThis) {
      const allianceStmt = this.db.prepare(`SELECT name FROM multi_alliances WHERE id = ?`);
      const alliance = allianceStmt.get(allianceId) as any;
      throw new Error(`Nation ${nationName} is already a member of "${alliance.name}"`);
    }

    // Check if the target alliance exists
    const targetAlliance = this.db.prepare(`SELECT * FROM multi_alliances WHERE id = ?`).get(allianceId);
    if (!targetAlliance) {
      throw new Error(`Alliance with ID ${allianceId} does not exist`);
    }

    const stmt = this.db.prepare(`
      INSERT INTO multi_alliance_members (alliance_id, nation_name, joined_by)
      VALUES (?, ?, ?)
    `);
    stmt.run(allianceId, nationName, joinedBy);
  }

  public leaveMultiAlliance(nationName: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM multi_alliance_members 
      WHERE nation_name = ? COLLATE NOCASE
    `);
    stmt.run(nationName);
  }

  public transferMultiAllianceLeadership(allianceId: number, newLeaderNation: string): void {
    const stmt = this.db.prepare(`
      UPDATE multi_alliances 
      SET leader_nation = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(newLeaderNation, allianceId);
  }

  public disbandMultiAlliance(allianceId: number): void {
    // Delete all members first (cascade should handle this, but being explicit)
    const deleteMembersStmt = this.db.prepare(`
      DELETE FROM multi_alliance_members WHERE alliance_id = ?
    `);
    deleteMembersStmt.run(allianceId);

    // Delete the alliance
    const deleteAllianceStmt = this.db.prepare(`
      DELETE FROM multi_alliances WHERE id = ?
    `);
    deleteAllianceStmt.run(allianceId);
  }

  public updateMultiAllianceDescription(allianceId: number, description: string): void {
    const stmt = this.db.prepare(`
      UPDATE multi_alliances 
      SET description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(description, allianceId);
  }

  public cleanupEmptyMultiAlliances(): void {
    // Get alliances with no members
    const emptyAlliancesStmt = this.db.prepare(`
      SELECT ma.id, ma.name 
      FROM multi_alliances ma
      LEFT JOIN multi_alliance_members mam ON ma.id = mam.alliance_id
      WHERE mam.alliance_id IS NULL
    `);
    const emptyAlliances = emptyAlliancesStmt.all();

    // Delete empty alliances
    if (emptyAlliances.length > 0) {
      const deleteStmt = this.db.prepare(`DELETE FROM multi_alliances WHERE id = ?`);
      for (const alliance of emptyAlliances) {
        deleteStmt.run((alliance as any).id);
      }
    }
  }

  public searchMultiAlliancesForAutocomplete(query: string): any[] {
    const stmt = this.db.prepare(`
      SELECT name FROM multi_alliances 
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY name
      LIMIT 25
    `);
    return stmt.all(`%${query}%`);
  }

  // Map System Methods
  public getCurrentMap(type: 'world' | 'alliance' = 'world'): any {
    const stmt = this.db.prepare(`
      SELECT * FROM map_settings 
      WHERE map_type = ?
      ORDER BY set_at DESC
      LIMIT 1
    `);
    return stmt.get(type);
  }

  public setMap(mapUrl: string, description: string, setBy: string, mapType: 'world' | 'alliance' = 'world'): void {
    const stmt = this.db.prepare(`
      INSERT INTO map_settings (map_url, map_description, set_by, map_type)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(map_type) DO UPDATE SET
        map_url = excluded.map_url,
        map_description = excluded.map_description,
        set_by = excluded.set_by,
        set_at = CURRENT_TIMESTAMP
    `);
    stmt.run(mapUrl, description, setBy, mapType);
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

  // Provincial capitals management
  public setProvincialCapitals(nationName: string, capitals: string[], setBy: string): boolean {
    // No limit on number of provincial capitals

    // Validate capitals array
    if (!Array.isArray(capitals)) {
      throw new Error('Provincial capitals must be an array');
    }

    // Validate each capital name
    for (const capital of capitals) {
      if (typeof capital !== 'string' || capital.trim().length === 0) {
        throw new Error('Each provincial capital must be a non-empty string');
      }
      if (capital.length > 50) {
        throw new Error('Provincial capital names cannot exceed 50 characters');
      }
    }

    const stmt = this.db.prepare(`
      UPDATE nations 
      SET provincial_capitals = ? 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const capitalsJson = JSON.stringify(capitals);
    const result = stmt.run(capitalsJson, nationName);
    
    if (result.changes > 0) {
      // Verify the JSON was stored correctly by reading it back
      const verifyStmt = this.db.prepare('SELECT provincial_capitals FROM nations WHERE name = ? COLLATE NOCASE');
      const stored = verifyStmt.get(nationName) as { provincial_capitals: string } | undefined;
      
      if (stored && stored.provincial_capitals) {
        try {
          const parsed = JSON.parse(stored.provincial_capitals);
          if (!Array.isArray(parsed) || parsed.length !== capitals.length) {
            throw new Error('Provincial capitals JSON verification failed');
          }
        } catch (error) {
          throw new Error('Failed to verify provincial capitals storage');
        }
      }
      
      this.logAdminAction(setBy, 'SET_PROVINCIAL_CAPITALS', `Set provincial capitals for ${nationName}: ${capitals.join(', ')}`);
      return true;
    }
    return false;
  }

  public addProvincialCapital(nationName: string, capital: string, setBy: string): boolean {
    const nation = this.getNationByName(nationName);
    if (!nation) {
      throw new Error('Nation not found');
    }

    // Validate capital name
    if (!capital || typeof capital !== 'string' || capital.trim().length === 0) {
      throw new Error('Provincial capital name cannot be empty');
    }
    
    const trimmedCapital = capital.trim();
    if (trimmedCapital.length > 50) {
      throw new Error('Provincial capital name cannot exceed 50 characters');
    }

    const currentCapitals = nation.provincialCapitals || [];
    // No limit on number of provincial capitals

    // Check for duplicates (case-insensitive)
    const capitalExists = currentCapitals.some(c => 
      c.toLowerCase() === trimmedCapital.toLowerCase()
    );
    
    if (capitalExists) {
      throw new Error('This provincial capital already exists');
    }

    const newCapitals = [...currentCapitals, trimmedCapital];
    return this.setProvincialCapitals(nationName, newCapitals, setBy);
  }

  public removeProvincialCapital(nationName: string, capital: string, setBy: string): boolean {
    const nation = this.getNationByName(nationName);
    if (!nation) {
      throw new Error('Nation not found');
    }

    const currentCapitals = nation.provincialCapitals || [];
    
    // Find capital to remove (case-insensitive)
    const capitalIndex = currentCapitals.findIndex(c => 
      c.toLowerCase() === capital.toLowerCase()
    );
    
    if (capitalIndex === -1) {
      throw new Error('Provincial capital not found');
    }

    const newCapitals = currentCapitals.filter((_, index) => index !== capitalIndex);
    return this.setProvincialCapitals(nationName, newCapitals, setBy);
  }

  // Utility method to repair corrupted provincial capitals data
  public repairProvincialCapitals(): { repaired: number; errors: string[] } {
    const stmt = this.db.prepare('SELECT name, provincial_capitals FROM nations WHERE provincial_capitals IS NOT NULL');
    const nations = stmt.all() as { name: string; provincial_capitals: string }[];
    
    let repaired = 0;
    const errors: string[] = [];
    
    for (const nation of nations) {
      try {
        const parsed = JSON.parse(nation.provincial_capitals);
        if (!Array.isArray(parsed)) {
          // Fix non-array data
          const updateStmt = this.db.prepare('UPDATE nations SET provincial_capitals = ? WHERE name = ?');
          updateStmt.run(JSON.stringify([]), nation.name);
          repaired++;
        } else if (parsed.length > 3) {
          // Fix too many capitals
          const fixed = parsed.slice(0, 3);
          const updateStmt = this.db.prepare('UPDATE nations SET provincial_capitals = ? WHERE name = ?');
          updateStmt.run(JSON.stringify(fixed), nation.name);
          repaired++;
        }
      } catch (error) {
        // Fix corrupted JSON
        const updateStmt = this.db.prepare('UPDATE nations SET provincial_capitals = ? WHERE name = ?');
        updateStmt.run(JSON.stringify([]), nation.name);
        repaired++;
        errors.push(`Repaired corrupted JSON for ${nation.name}`);
      }
    }
    
    return { repaired, errors };
  }

  // Government type management
  public setGovernmentType(nationName: string, governmentType: string, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET government_type = ? 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(governmentType, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_GOVERNMENT_TYPE', `Set government type for ${nationName}: ${governmentType}`);
      return true;
    }
    return false;
  }

  // National debt management
  public setNationalDebt(nationName: string, debt: number, setBy: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE nations 
      SET national_debt = ? 
      WHERE name = ? COLLATE NOCASE
    `);
    
    const result = stmt.run(debt, nationName);
    
    if (result.changes > 0) {
      this.logAdminAction(setBy, 'SET_NATIONAL_DEBT', `Set national debt for ${nationName}: $${debt.toFixed(2)} billion`);
      return true;
    }
    return false;
  }

  // Loan management
  public createLoanProposal(
    lenderNation: string, 
    borrowerNation: string, 
    amount: number, 
    interestRate: number, 
    termMonths: number,
    description: string,
    createdBy: string
  ): { id: number; code: string } {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + termMonths);

    // Default to compound loan type
    const loanType = 'compound';
    let monthlyPayment: number;
    let remainingBalance = amount;

    // Both compound and amortizing loans have monthly payments
    // For compound loans, calculate payment needed to pay off the full compound amount
    if (loanType === 'compound') {
      monthlyPayment = this.calculateCompoundMonthlyPayment(amount, interestRate, termMonths);
    } else {
      monthlyPayment = this.calculateMonthlyPayment(amount, interestRate, termMonths);
    }

    const loanCode = this.generateLoanCode();

    const stmt = this.db.prepare(`
      INSERT INTO loans (lender_nation, borrower_nation, amount, interest_rate, term_months, loan_type, monthly_payment, remaining_balance, due_date, status, loan_code, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    const result = stmt.run(lenderNation, borrowerNation, amount, interestRate, termMonths, loanType, monthlyPayment, remainingBalance, dueDate.toISOString(), loanCode, description);
    
    this.logAdminAction(createdBy, 'CREATE_LOAN_PROPOSAL', `Created loan proposal ${loanCode}: ${lenderNation} → ${borrowerNation}, $${amount}B at ${interestRate}% for ${termMonths} months - ${description}`);
    
    return { id: result.lastInsertRowid as number, code: loanCode };
  }

  public acceptLoan(loanId: number, acceptedBy: string): void {
    this.transaction(() => {
      // Get loan details first
      const loanStmt = this.db.prepare(`
        SELECT * FROM loans WHERE id = ? AND status = 'pending'
      `);
      const loan = loanStmt.get(loanId) as any;
      
      if (!loan) {
        throw new Error('Loan not found or already processed');
      }
      
      // Update loan status
      const updateLoanStmt = this.db.prepare(`
        UPDATE loans 
        SET status = 'active', accepted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateLoanStmt.run(loanId);
      
      // Update borrower's national debt
      const updateDebtStmt = this.db.prepare(`
        UPDATE nations 
        SET national_debt = COALESCE(national_debt, 0) + ?
        WHERE name = ? COLLATE NOCASE
      `);
      updateDebtStmt.run(loan.amount, loan.borrower_nation);
      
      this.logAdminAction(acceptedBy, 'ACCEPT_LOAN', `Accepted loan #${loanId} - Added ${loan.amount}B to ${loan.borrower_nation}'s national debt`);
    });
  }

  public declineLoan(loanId: number, declinedBy: string): void {
    const stmt = this.db.prepare(`
      UPDATE loans 
      SET status = 'declined', declined_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
    
    const result = stmt.run(loanId);
    
    if (result.changes > 0) {
      this.logAdminAction(declinedBy, 'DECLINE_LOAN', `Declined loan #${loanId}`);
    }
  }

  public makeLoanPayment(loanId: number, paymentAmount: number, paidBy: string): boolean {
    return this.transaction(() => {
      // Get loan details
      const loanStmt = this.db.prepare(`
        SELECT * FROM loans WHERE id = ? AND status = 'active'
      `);
      const loan = loanStmt.get(loanId) as any;
      
      if (!loan) {
        return false;
      }

      // Get borrower's current budget
      const borrowerStmt = this.db.prepare(`
        SELECT budget FROM nations WHERE name = ? COLLATE NOCASE
      `);
      const borrower = borrowerStmt.get(loan.borrower_nation) as any;
      
      if (!borrower || borrower.budget < paymentAmount) {
        return false; // Insufficient budget
      }
      
      // Calculate new remaining balance
      const newBalance = Math.max(0, loan.remaining_balance - paymentAmount);
      const actualPayment = loan.remaining_balance - newBalance;
      
      // Update loan
      const updateLoanStmt = this.db.prepare(`
        UPDATE loans 
        SET remaining_balance = ?, 
            last_payment = CURRENT_TIMESTAMP,
            status = CASE WHEN ? <= 0 THEN 'paid_off' ELSE 'active' END
        WHERE id = ?
      `);
      updateLoanStmt.run(newBalance, newBalance, loanId);
      
      // Deduct payment from borrower's budget (by reducing GDP temporarily)
      const updateBudgetStmt = this.db.prepare(`
        UPDATE nations 
        SET gdp = gdp - (? / (tax_rate / 100))
        WHERE name = ? COLLATE NOCASE
      `);
      updateBudgetStmt.run(actualPayment, loan.borrower_nation);
      
      // Reduce borrower's national debt by the payment amount
      const updateDebtStmt = this.db.prepare(`
        UPDATE nations 
        SET national_debt = MAX(0, COALESCE(national_debt, 0) - ?)
        WHERE name = ? COLLATE NOCASE
      `);
      updateDebtStmt.run(actualPayment, loan.borrower_nation);
      
      const status = newBalance <= 0 ? 'PAID_OFF' : 'PAYMENT_MADE';
      this.logAdminAction(paidBy, status, `Loan #${loanId} payment: ${actualPayment}B - Reduced ${loan.borrower_nation}'s debt and budget`);
      
      return true;
    });
  }

  public getLoanById(loanId: number): any {
    const stmt = this.db.prepare(`
      SELECT * FROM loans WHERE id = ?
    `);
    return stmt.get(loanId);
  }

  public getLoanByCode(loanCode: string): any {
    const stmt = this.db.prepare(`
      SELECT * FROM loans WHERE loan_code = ? COLLATE NOCASE
    `);
    return stmt.get(loanCode);
  }

  public getLoansForAutocomplete(nationName: string, status?: string): any[] {
    let query = `
      SELECT id, loan_code, description, lender_nation, borrower_nation, amount, interest_rate, remaining_balance, status
      FROM loans 
      WHERE (lender_nation = ? COLLATE NOCASE) OR (borrower_nation = ? COLLATE NOCASE)
    `;
    let params = [nationName, nationName];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 25`;

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  public calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / termMonths;
    
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
  }

  public calculateCompoundAmount(principal: number, annualRate: number, termMonths: number): number {
    const monthlyRate = annualRate / 100 / 12;
    return principal * Math.pow(1 + monthlyRate, termMonths);
  }

  public calculateCompoundMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
    // Calculate the full compound amount, then divide by term to get monthly payment
    const fullCompoundAmount = this.calculateCompoundAmount(principal, annualRate, termMonths);
    return fullCompoundAmount / termMonths;
  }

  public calculateCurrentCompoundBalance(principal: number, annualRate: number, monthsElapsed: number): number {
    const monthlyRate = annualRate / 100 / 12;
    return principal * Math.pow(1 + monthlyRate, monthsElapsed);
  }

  private generateLoanCode(): string {
    // Generate a readable loan code like "LOAN-ABC123"
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'LOAN-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists (only if loan_code column exists)
    try {
      const existing = this.db.prepare(`SELECT id FROM loans WHERE loan_code = ?`).get(code);
      if (existing) {
        return this.generateLoanCode(); // Try again if duplicate
      }
    } catch (error) {
      // If loan_code column doesn't exist, just return the generated code
      this.logger.warn('loan_code column not found, skipping duplicate check', { error: error as Error });
    }
    
    return code;
  }

  public repairLoansTable(): void {
    try {
      // Check current table structure
      const columns = this.db.prepare(`PRAGMA table_info(loans)`).all();
      const columnNames = columns.map((col: any) => col.name);
      
      this.logger.info(`Current loans table columns: ${columnNames.join(', ')}`);
      
      // Add missing columns
      if (!columnNames.includes('loan_code')) {
        this.db.exec(`ALTER TABLE loans ADD COLUMN loan_code TEXT`);
        this.logger.info('Added loan_code column');
      }
      
      if (!columnNames.includes('description')) {
        this.db.exec(`ALTER TABLE loans ADD COLUMN description TEXT`);
        this.logger.info('Added description column');
      }
      
      if (!columnNames.includes('loan_type')) {
        this.db.exec(`ALTER TABLE loans ADD COLUMN loan_type TEXT DEFAULT 'compound' CHECK (loan_type IN ('compound', 'amortizing'))`);
        this.logger.info('Added loan_type column');
      }
      
      // Generate loan codes for existing loans without them
      const existingLoans = this.db.prepare(`SELECT id FROM loans WHERE loan_code IS NULL OR loan_code = ''`).all();
      for (const loan of existingLoans) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let loanCode = 'LOAN-';
        for (let i = 0; i < 6; i++) {
          loanCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.db.prepare(`UPDATE loans SET loan_code = ? WHERE id = ?`).run(loanCode, (loan as any).id);
      }
      
      this.logger.info('Loans table repair completed');
    } catch (error) {
      this.logger.error('Failed to repair loans table', { error: error as Error });
      throw error;
    }
  }

  public isLoanTermRealistic(annualRate: number, termMonths: number): { realistic: boolean; warning?: string } {
    const years = termMonths / 12;
    
    // High interest rate warnings
    if (annualRate >= 30 && years > 5) {
      return {
        realistic: false,
        warning: `⚠️ **EXTREME RISK**: ${annualRate}% interest over ${years} years will result in astronomical debt growth!`
      };
    }
    
    if (annualRate >= 20 && years > 10) {
      return {
        realistic: false,
        warning: `⚠️ **HIGH RISK**: ${annualRate}% interest over ${years} years may be difficult to repay.`
      };
    }
    
    return { realistic: true };
  }

  // National debt compounding system
  public compoundNationalDebt(): void {
    this.transaction(() => {
      // Get all nations with active loans (borrowers)
      const stmt = this.db.prepare(`
        SELECT DISTINCT borrower_nation, 
               SUM(remaining_balance) as total_debt,
               AVG(interest_rate) as avg_rate
        FROM loans 
        WHERE status = 'active' 
        GROUP BY borrower_nation
      `);
      
      const debtors = stmt.all() as any[];
      
      for (const debtor of debtors) {
        // Calculate daily compound interest (game time: 1 year = 7 days, so daily rate = annual rate / 365)
        const dailyRate = debtor.avg_rate / 100 / 365;
        const currentDebt = debtor.total_debt;
        const newDebt = currentDebt * (1 + dailyRate);
        const interestAccrued = newDebt - currentDebt;
        
        // Update national debt
        const updateStmt = this.db.prepare(`
          UPDATE nations 
          SET national_debt = COALESCE(national_debt, 0) + ?
          WHERE name = ? COLLATE NOCASE
        `);
        updateStmt.run(interestAccrued, debtor.borrower_nation);
        
        // Update loan balances
        const updateLoansStmt = this.db.prepare(`
          UPDATE loans 
          SET remaining_balance = remaining_balance * (1 + ?)
          WHERE borrower_nation = ? COLLATE NOCASE AND status = 'active'
        `);
        updateLoansStmt.run(dailyRate, debtor.borrower_nation);
        
        this.logAdminAction('SYSTEM', 'DEBT_COMPOUND', `${debtor.borrower_nation}: +${interestAccrued.toFixed(2)}B interest (${(dailyRate * 100).toFixed(6)}% daily)`);
      }
    });
  }

  public getLastDebtCompound(): Date | null {
    const stmt = this.db.prepare(`
      SELECT MAX(timestamp) as last_compound 
      FROM admin_actions 
      WHERE action = 'DEBT_COMPOUND'
    `);
    const result = stmt.get() as any;
    return result?.last_compound ? new Date(result.last_compound) : null;
  }

  public getLoansByNation(nationName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM loans 
      WHERE (lender_nation = ? COLLATE NOCASE) OR (borrower_nation = ? COLLATE NOCASE)
      ORDER BY created_at DESC
    `);
    return stmt.all(nationName, nationName);
  }

  // Investment management
  public createInvestmentProposal(
    investorNation: string,
    targetNation: string,
    amount: number,
    investmentType: string,
    expectedReturn: number,
    duration: number,
    createdBy: string
  ): number {
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + duration);

    const stmt = this.db.prepare(`
      INSERT INTO investments (investor_nation, target_nation, amount, investment_type, expected_return, duration, current_value, maturity_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = stmt.run(investorNation, targetNation, amount, investmentType, expectedReturn, duration, amount, maturityDate.toISOString());
    
    this.logAdminAction(createdBy, 'CREATE_INVESTMENT_PROPOSAL', `Created investment proposal: ${investorNation} → ${targetNation}, $${amount}B in ${investmentType} for ${duration} months`);
    
    return result.lastInsertRowid as number;
  }

  public acceptInvestment(investmentId: number, acceptedBy: string): void {
    const stmt = this.db.prepare(`
      UPDATE investments 
      SET status = 'active', accepted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
    
    const result = stmt.run(investmentId);
    
    if (result.changes > 0) {
      this.logAdminAction(acceptedBy, 'ACCEPT_INVESTMENT', `Accepted investment #${investmentId}`);
    }
  }

  public declineInvestment(investmentId: number, declinedBy: string): void {
    const stmt = this.db.prepare(`
      UPDATE investments 
      SET status = 'declined', declined_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `);
    
    const result = stmt.run(investmentId);
    
    if (result.changes > 0) {
      this.logAdminAction(declinedBy, 'DECLINE_INVESTMENT', `Declined investment #${investmentId}`);
    }
  }

  public getInvestmentById(investmentId: number): any {
    const stmt = this.db.prepare(`
      SELECT * FROM investments WHERE id = ?
    `);
    return stmt.get(investmentId);
  }

  public getInvestmentsByNation(nationName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM investments 
      WHERE investor_nation = ? OR target_nation = ? COLLATE NOCASE
      ORDER BY created_at DESC
    `);
    return stmt.all(nationName, nationName);
  }

  // Disaster tracking operations
  public recordDisaster(disaster: {
    severity: string;
    category: string;
    title: string;
    description: string;
    affectedRegions: string[];
    estimatedCasualties: number;
    economicCost: number;
    generatedBy?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO disasters (severity, category, title, description, affected_regions, estimated_casualties, economic_cost, generated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      disaster.severity,
      disaster.category,
      disaster.title,
      disaster.description,
      JSON.stringify(disaster.affectedRegions),
      disaster.estimatedCasualties,
      disaster.economicCost,
      disaster.generatedBy || null
    );
    
    return result.lastInsertRowid as number;
  }

  public getDaysSinceLastDisasterBySeverity(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT 
        severity,
        MAX(created_at) as last_occurrence,
        CAST((julianday('now') - julianday(MAX(created_at))) AS INTEGER) as days_since
      FROM disasters 
      WHERE severity IN ('small', 'medium', 'large', 'major', 'catastrophic')
      GROUP BY severity
    `);
    
    const results = stmt.all() as Array<{
      severity: string;
      last_occurrence: string;
      days_since: number;
    }>;
    
    // Initialize with default values for severities that haven't occurred
    const daysSince: Record<string, number> = {
      small: 0,
      medium: 1,
      large: 2,
      major: 5,
      catastrophic: 10
    };
    
    // Update with actual values from database
    results.forEach(row => {
      daysSince[row.severity] = Math.max(0, row.days_since);
    });
    
    return daysSince;
  }

  public getDisasterHistory(limit: number = 50): Array<{
    id: number;
    severity: string;
    category: string;
    title: string;
    affectedRegions: string[];
    estimatedCasualties: number;
    economicCost: number;
    createdAt: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        id, severity, category, title, affected_regions, 
        estimated_casualties as estimatedCasualties, 
        economic_cost as economicCost,
        created_at as createdAt
      FROM disasters 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const results = stmt.all(limit) as Array<{
      id: number;
      severity: string;
      category: string;
      title: string;
      affected_regions: string;
      estimatedCasualties: number;
      economicCost: number;
      createdAt: string;
    }>;
    
    return results.map(row => ({
      ...row,
      affectedRegions: JSON.parse(row.affected_regions)
    }));
  }

  public getDisasterStatistics(): {
    totalDisasters: number;
    severityDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
    totalCasualties: number;
    totalEconomicCost: number;
  } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM disasters');
    const totalResult = totalStmt.get() as { count: number };
    
    const severityStmt = this.db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM disasters 
      GROUP BY severity
    `);
    const severityResults = severityStmt.all() as Array<{ severity: string; count: number }>;
    
    const categoryStmt = this.db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM disasters 
      GROUP BY category
    `);
    const categoryResults = categoryStmt.all() as Array<{ category: string; count: number }>;
    
    const impactStmt = this.db.prepare(`
      SELECT 
        SUM(estimated_casualties) as totalCasualties,
        SUM(economic_cost) as totalEconomicCost
      FROM disasters
    `);
    const impactResult = impactStmt.get() as { 
      totalCasualties: number | null; 
      totalEconomicCost: number | null; 
    };
    
    const severityDistribution: Record<string, number> = {};
    severityResults.forEach(row => {
      severityDistribution[row.severity] = row.count;
    });
    
    const categoryDistribution: Record<string, number> = {};
    categoryResults.forEach(row => {
      categoryDistribution[row.category] = row.count;
    });
    
    return {
      totalDisasters: totalResult.count,
      severityDistribution,
      categoryDistribution,
      totalCasualties: impactResult.totalCasualties || 0,
      totalEconomicCost: impactResult.totalEconomicCost || 0
    };
  }

  // Get current disaster odds for Kappa's system
  public getCurrentDisasterOdds(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT very_small_odds, small_odds, medium_odds, large_odds, major_odds, catastrophic_odds
      FROM disaster_odds 
      WHERE id = 1
    `);
    
    const result = stmt.get() as {
      very_small_odds: number;
      small_odds: number;
      medium_odds: number;
      large_odds: number;
      major_odds: number;
      catastrophic_odds: number;
    } | undefined;

    if (!result) {
      // Return default odds if no record found
      return {
        'very_small': 0.0,
        'small': 0.67,
        'medium': 0.20,
        'large': 0.10,
        'major': 0.025,
        'catastrophic': 0.005
      };
    }

    return {
      'very_small': result.very_small_odds,
      'small': result.small_odds,
      'medium': result.medium_odds,
      'large': result.large_odds,
      'major': result.major_odds,
      'catastrophic': result.catastrophic_odds
    };
  }

  // Update disaster odds for Kappa's system
  public updateDisasterOdds(odds: Record<string, number>, updatedBy: string = 'system'): void {
    const stmt = this.db.prepare(`
      UPDATE disaster_odds 
      SET very_small_odds = ?, small_odds = ?, medium_odds = ?, large_odds = ?, major_odds = ?, catastrophic_odds = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = 1
    `);
    
    stmt.run(
      odds['very_small'] || 0.0,
      odds['small'] || 0.67,
      odds['medium'] || 0.20,
      odds['large'] || 0.10,
      odds['major'] || 0.025,
      odds['catastrophic'] || 0.005,
      updatedBy
    );
  }

  // Reset disaster odds to base values
  public resetDisasterOdds(updatedBy: string = 'system'): void {
    const baseOdds = {
      'very_small': 0.0,
      'small': 0.67,
      'medium': 0.20,
      'large': 0.10,
      'major': 0.025,
      'catastrophic': 0.005
    };
    
    this.updateDisasterOdds(baseOdds, updatedBy);
  }

}