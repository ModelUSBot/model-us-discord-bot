import Database from 'better-sqlite3';
import { config } from 'dotenv';

config();

const dbPath = process.env.DATABASE_PATH || './data/model-us-bot.db';

console.log('🔧 Fixing VP support in user_links table...');

const db = new Database(dbPath);

try {
  // Start transaction
  db.exec('BEGIN TRANSACTION');

  console.log('📋 Creating new user_links table with proper constraints...');
  
  // Create new table with correct constraints
  db.exec(`
    CREATE TABLE user_links_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      nation_name TEXT NOT NULL COLLATE NOCASE,
      role TEXT DEFAULT 'president' CHECK (role IN ('president', 'vice_president', 'citizen')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE(nation_name, role)
    )
  `);

  console.log('📊 Copying existing data...');
  
  // Copy data from old table
  db.exec(`
    INSERT INTO user_links_new (id, discord_id, nation_name, role, created_at)
    SELECT id, discord_id, nation_name, role, created_at FROM user_links
  `);

  console.log('🗑️ Dropping old table...');
  
  // Drop old table
  db.exec('DROP TABLE user_links');

  console.log('🔄 Renaming new table...');
  
  // Rename new table
  db.exec('ALTER TABLE user_links_new RENAME TO user_links');

  console.log('📇 Creating indexes...');
  
  // Recreate indexes
  db.exec(`
    CREATE INDEX idx_user_links_discord_id ON user_links(discord_id);
    CREATE INDEX idx_user_links_nation_name ON user_links(nation_name);
    CREATE INDEX idx_user_links_role ON user_links(role);
  `);

  // Commit transaction
  db.exec('COMMIT');

  console.log('✅ VP support migration completed successfully!');
  console.log('📋 New constraints:');
  console.log('   - Multiple users can be linked to the same nation');
  console.log('   - Each nation can have only one President and one VP');
  console.log('   - Same user can be linked to multiple nations (if needed)');

} catch (error) {
  console.error('❌ Migration failed:', error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}