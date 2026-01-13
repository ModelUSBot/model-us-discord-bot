const sqlite3 = require('better-sqlite3');
const mysql = require('mysql2/promise');
const fs = require('fs');

async function migrateToMySQL() {
  console.log('🚀 Starting SQLite to MySQL migration...');

  // Connect to SQLite
  const sqliteDb = new sqlite3('./data/model-us-bot.db');
  
  // Connect to MySQL
  const mysqlDb = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'botuser',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'discord_bot',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    // Migrate nations table
    console.log('📊 Migrating nations...');
    const nations = sqliteDb.prepare('SELECT * FROM nations').all();
    
    for (const nation of nations) {
      await mysqlDb.execute(`
        INSERT INTO nations (
          name, gdp, stability, population, tax_rate, previous_gdp, previous_population,
          flag, flag_set_at, capitol, description, military_readiness, ground_strength,
          naval_strength, air_strength, vice_president, tax_rate_changed_at,
          government_type, provincial_capitals, national_debt, trading_partners,
          last_rename_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          gdp = VALUES(gdp),
          stability = VALUES(stability),
          population = VALUES(population)
      `, [
        nation.name, nation.gdp, nation.stability, nation.population, nation.tax_rate,
        nation.previous_gdp, nation.previous_population, nation.flag, nation.flag_set_at,
        nation.capitol, nation.description, nation.military_readiness, nation.ground_strength,
        nation.naval_strength, nation.air_strength, nation.vice_president, nation.tax_rate_changed_at,
        nation.government_type, nation.provincial_capitals, nation.national_debt, nation.trading_partners,
        nation.last_rename_at, nation.created_at, nation.updated_at
      ]);
    }
    console.log(`✅ Migrated ${nations.length} nations`);

    // Migrate loans table
    console.log('💰 Migrating loans...');
    const loans = sqliteDb.prepare('SELECT * FROM loans').all();
    
    for (const loan of loans) {
      await mysqlDb.execute(`
        INSERT INTO loans (
          loan_code, description, lender_nation, borrower_nation, amount, interest_rate,
          term_months, loan_type, monthly_payment, remaining_balance, status,
          created_at, accepted_at, declined_at, due_date, last_payment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          remaining_balance = VALUES(remaining_balance),
          status = VALUES(status)
      `, [
        loan.loan_code, loan.description, loan.lender_nation, loan.borrower_nation,
        loan.amount, loan.interest_rate, loan.term_months, loan.loan_type,
        loan.monthly_payment, loan.remaining_balance, loan.status,
        loan.created_at, loan.accepted_at, loan.declined_at, loan.due_date, loan.last_payment
      ]);
    }
    console.log(`✅ Migrated ${loans.length} loans`);

    // Add more table migrations as needed...

    console.log('🎉 Migration completed successfully!');
    
    // Create backup of original SQLite database
    const backupName = `sqlite-backup-${Date.now()}.db`;
    fs.copyFileSync('./data/model-us-bot.db', `./data/${backupName}`);
    console.log(`📦 SQLite backup created: ${backupName}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await mysqlDb.end();
  }
}

// Run migration
if (require.main === module) {
  migrateToMySQL().catch(console.error);
}

module.exports = { migrateToMySQL };