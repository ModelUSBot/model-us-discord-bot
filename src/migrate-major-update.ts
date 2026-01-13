import Database from 'better-sqlite3';
import { config } from 'dotenv';

config();

const dbPath = process.env.DATABASE_PATH || './data/model-us-bot.db';

console.log('🔄 Starting major database migration...');

const db = new Database(dbPath);

try {
  // Begin transaction
  db.exec('BEGIN TRANSACTION');

  // 1. Add new military stats to nations table
  console.log('📊 Adding military stats to nations...');
  try {
    db.exec('ALTER TABLE nations ADD COLUMN ground_strength REAL DEFAULT 5.0 CHECK (ground_strength >= 0 AND ground_strength <= 10)');
  } catch (e) { console.log('  - ground_strength column already exists'); }
  
  try {
    db.exec('ALTER TABLE nations ADD COLUMN naval_strength REAL DEFAULT 5.0 CHECK (naval_strength >= 0 AND naval_strength <= 10)');
  } catch (e) { console.log('  - naval_strength column already exists'); }
  
  try {
    db.exec('ALTER TABLE nations ADD COLUMN air_strength REAL DEFAULT 5.0 CHECK (air_strength >= 0 AND air_strength <= 10)');
  } catch (e) { console.log('  - air_strength column already exists'); }

  // Rename military_readiness to military_strength
  console.log('🔄 Renaming military_readiness to military_strength...');
  try {
    // SQLite doesn't support column rename directly, so we'll add the new column and copy data
    db.exec('ALTER TABLE nations ADD COLUMN military_strength REAL DEFAULT 5.0 CHECK (military_strength >= 0 AND military_strength <= 10)');
    db.exec('UPDATE nations SET military_strength = military_readiness WHERE military_readiness IS NOT NULL');
  } catch (e) { console.log('  - military_strength column already exists'); }

  // 2. Create multi-nation alliances table
  console.log('🤝 Creating multi-nation alliances system...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS multi_alliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT,
      leader_nation TEXT NOT NULL COLLATE NOCASE,
      created_by TEXT NOT NULL, -- Discord ID
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_nation) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  // Multi-alliance memberships
  db.exec(`
    CREATE TABLE IF NOT EXISTS multi_alliance_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alliance_id INTEGER NOT NULL,
      nation_name TEXT NOT NULL COLLATE NOCASE,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      joined_by TEXT NOT NULL, -- Discord ID (leader or admin)
      FOREIGN KEY (alliance_id) REFERENCES multi_alliances(id) ON DELETE CASCADE,
      FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE(alliance_id, nation_name)
    )
  `);

  // 3. Create map storage table
  console.log('🗺️ Creating map system...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one map at a time
      map_url TEXT NOT NULL,
      map_description TEXT,
      set_by TEXT NOT NULL, -- Admin Discord ID
      set_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Add law editing capabilities (add edited fields to laws table)
  console.log('📜 Enhancing law system...');
  try {
    db.exec('ALTER TABLE laws ADD COLUMN edited_at DATETIME');
  } catch (e) { console.log('  - edited_at column already exists'); }
  
  try {
    db.exec('ALTER TABLE laws ADD COLUMN edited_by TEXT'); // Discord ID
  } catch (e) { console.log('  - edited_by column already exists'); }

  try {
    db.exec('ALTER TABLE laws ADD COLUMN original_text TEXT'); // Store original for history
  } catch (e) { console.log('  - original_text column already exists'); }

  // Update triggers for new tables
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_multi_alliances_timestamp
    AFTER UPDATE ON multi_alliances
    BEGIN
      UPDATE multi_alliances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  // Commit transaction
  db.exec('COMMIT');
  
  console.log('✅ Migration completed successfully!');
  console.log('📊 New features available:');
  console.log('  - Military stats: Ground, Naval, Air (0-10)');
  console.log('  - Military readiness renamed to Military strength');
  console.log('  - Multi-nation alliances with leaders');
  console.log('  - Map system');
  console.log('  - Enhanced law editing');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}