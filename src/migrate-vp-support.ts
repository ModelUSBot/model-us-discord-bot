import Database from 'better-sqlite3';
import { config } from 'dotenv';

config();

const dbPath = process.env.DATABASE_PATH || './data/model-us-bot.db';

console.log('🔄 Adding Vice President support...');

const db = new Database(dbPath);

try {
  // Begin transaction
  db.exec('BEGIN TRANSACTION');

  // Add VP column to nations table
  console.log('👥 Adding Vice President support to nations...');
  try {
    db.exec('ALTER TABLE nations ADD COLUMN vice_president TEXT'); // Discord username
  } catch (e) { console.log('  - vice_president column already exists'); }

  // Update user links to support role types
  console.log('🔗 Adding role support to user links...');
  try {
    db.exec('ALTER TABLE user_links ADD COLUMN role TEXT DEFAULT "citizen"');
  } catch (e) { console.log('  - role column already exists'); }

  // Update existing links to be presidents (only if role column was just added)
  try {
    db.exec('UPDATE user_links SET role = "president" WHERE role = "citizen"');
  } catch (e) { 
    console.log('  - role column may not exist yet, skipping update'); 
  }

  // Commit transaction
  db.exec('COMMIT');
  
  console.log('✅ Vice President support added successfully!');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}