#!/usr/bin/env node

import { DatabaseManager } from './database/DatabaseManager';
import { Logger } from './utils/Logger';

async function fixLoansTable() {
  const logger = new Logger('info');
  
  try {
    console.log('🔧 Starting loans table repair...');
    
    // Initialize database manager
    const dbManager = new DatabaseManager({ path: './data/model-us-bot.db' }, logger);
    
    // Run the repair
    dbManager.repairLoansTable();
    
    console.log('✅ Loans table repair completed successfully!');
    
    // Close the database
    dbManager.close();
    
  } catch (error) {
    console.error('❌ Failed to repair loans table:', error);
    process.exit(1);
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  fixLoansTable();
}

export { fixLoansTable };