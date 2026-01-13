import { config } from 'dotenv';
import { BotClient } from './bot/BotClient';
import { BotConfig } from './types';
import { Logger } from './utils/Logger';
import express from 'express';

// Import all commands
import { AdminNationEditCommand } from './commands/admin/AdminNationEdit';
import { AdminLinkUserCommand } from './commands/admin/AdminLinkUser';
import { AdminActivityCommand } from './commands/admin/AdminActivity';
import { AdminDisasterCommand } from './commands/admin/AdminDisaster';
import { AdminWarAddCommand } from './commands/admin/AdminWarAdd';
import { AdminWarUpdateCommand } from './commands/admin/AdminWarUpdate';
import { AdminNationAddCommand } from './commands/admin/AdminNationAdd';
import { AdminNationDeleteCommand } from './commands/admin/AdminNationDelete';
import { AdminNationRenameCommand } from './commands/admin/AdminNationRename';
import { AdminAllianceAddCommand } from './commands/admin/AdminAllianceAdd';
import { AdminAllianceRemoveCommand } from './commands/admin/AdminAllianceRemove';
import { AdminUnlinkUserCommand } from './commands/admin/AdminUnlinkUser';
import { AdminBackupCommand } from './commands/admin/AdminBackup';
import { AdminEndWarCommand } from './commands/admin/AdminEndWar';
import { AdminAuditCommand } from './commands/admin/AdminAudit';
import { AdminSetFlagCommand } from './commands/admin/AdminSetFlag';
import { AdminRepairDataCommand } from './commands/admin/AdminRepairData';
import { AdminSetCapitalCommand } from './commands/admin/AdminSetCapital';
import { AdminSetPrefixCommand } from './commands/admin/AdminSetPrefix';
import { AdminLawCommand } from './commands/admin/AdminLawCommand';
import { AdminMultiAllianceCommand } from './commands/admin/AdminMultiAllianceCommand';
import { AdminSetMapCommand } from './commands/admin/AdminSetMapCommand';
import { AdminProvincialCapitalsCommand } from './commands/admin/AdminProvincialCapitalsCommand';
import { AdminLoansCommand } from './commands/admin/AdminLoansCommand';
import { AdminDiplomacyCommand } from './commands/admin/AdminDiplomacyCommand';

import { NationCommand } from './commands/player/NationCommand';
import { WarsCommand } from './commands/player/WarsCommand';
import { RankingsCommand } from './commands/player/RankingsCommand';
import { NationRenameCommand } from './commands/player/NationRenameCommand';
import { AllianceRequestCommand } from './commands/player/AllianceRequestCommand';
import { AllianceRespondCommand } from './commands/player/AllianceRespondCommand';
import { AlliancesCommand } from './commands/player/AlliancesCommand';
import { UnallyCommand } from './commands/player/UnallyCommand';
import { SetFlagCommand } from './commands/player/SetFlag';
import { SetCapitalCommand } from './commands/player/SetCapital';
import { SetTaxRateCommand } from './commands/player/SetTaxRateCommand';
import { SetPrefixCommand } from './commands/player/SetPrefixCommand';
import { LawCommand } from './commands/player/LawCommand';
import { MultiAllianceCommand } from './commands/player/MultiAllianceCommand';
import { MapCommand } from './commands/player/MapCommand';
import { TagCommand } from './commands/player/TagCommand';
import { AddDescCommand } from './commands/player/AddDescCommand';
import { AllianceMapCommand } from './commands/player/AllianceMapCommand';
import { ProvincialCapitalsCommand } from './commands/player/ProvincialCapitalsCommand';
import { LoansCommand } from './commands/player/LoansCommand';
import { InvestCommand } from './commands/player/InvestCommand';
import { CompareNationsCommand } from './commands/player/CompareNationsCommand';
import { DashboardCommand } from './commands/player/DashboardCommand';
import { SetGovernmentTypeCommand } from './commands/player/SetGovernmentTypeCommand';
import { InternationalRelationsCommand } from './commands/player/InternationalRelationsCommand';

// Load environment variables
config();

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create bot configuration
const botConfig: BotConfig = {
  token: process.env.DISCORD_TOKEN!,
  clientId: process.env.CLIENT_ID!,
  guildId: process.env.GUILD_ID || undefined,
  adminUserIds: process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [],
  database: {
    path: process.env.DATABASE_PATH || './data/model-us-bot.db',
    enableWAL: true,
    enableForeignKeys: true
  },
  logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  botLogChannelId: process.env.BOT_LOG_CHANNEL_ID || undefined,
  timezone: process.env.TIMEZONE || 'America/New_York'
};

async function main(): Promise<void> {
  const logger = new Logger(botConfig.logLevel);
  
  try {
    logger.info('Starting Model US Discord Bot...');
    console.log('Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- DATABASE_PATH:', process.env.DATABASE_PATH);
    console.log('- DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
    console.log('- CLIENT_ID exists:', !!process.env.CLIENT_ID);
    
    // Create health check server for Render
    if (process.env.NODE_ENV === 'production') {
      console.log('Setting up health check server...');
      const app = express();
      const port = process.env.PORT || 3000;
      
      app.get('/health', (req: express.Request, res: express.Response) => {
        res.status(200).json({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      });
      
      app.listen(port, () => {
        logger.info(`Health check server running on port ${port}`);
        console.log(`Health check server running on port ${port}`);
      });
    }
    
    // Create bot client
    console.log('Creating bot client...');
    const client = new BotClient(botConfig);
    
    // Register all commands
    logger.info('Registering commands...');
    console.log('Registering commands...');
    
    // Admin commands
    client.addCommand(new AdminNationEditCommand());
    client.addCommand(new AdminLinkUserCommand());
    client.addCommand(new AdminActivityCommand());
    client.addCommand(new AdminDisasterCommand());
    client.addCommand(new AdminWarAddCommand());
    client.addCommand(new AdminWarUpdateCommand());
    client.addCommand(new AdminNationAddCommand());
    client.addCommand(new AdminNationDeleteCommand());
    client.addCommand(new AdminNationRenameCommand());
    client.addCommand(new AdminAllianceAddCommand());
    client.addCommand(new AdminAllianceRemoveCommand());
    client.addCommand(new AdminBackupCommand());
    client.addCommand(new AdminUnlinkUserCommand());
    client.addCommand(new AdminEndWarCommand());
    client.addCommand(new AdminAuditCommand());
    client.addCommand(new AdminSetFlagCommand());
    client.addCommand(new AdminRepairDataCommand());
    client.addCommand(new AdminSetCapitalCommand());
    client.addCommand(new AdminSetPrefixCommand());
    client.addCommand(new AdminLawCommand());
    client.addCommand(new AdminMultiAllianceCommand());
    client.addCommand(new AdminSetMapCommand());
    client.addCommand(new AdminProvincialCapitalsCommand());
    client.addCommand(new AdminLoansCommand());
    client.addCommand(new AdminDiplomacyCommand());

    
    // Player commands
    client.addCommand(new NationCommand());
    client.addCommand(new WarsCommand());
    client.addCommand(new RankingsCommand());
    client.addCommand(new NationRenameCommand());
    client.addCommand(new AllianceRequestCommand());
    client.addCommand(new AllianceRespondCommand());
    client.addCommand(new AlliancesCommand());
    client.addCommand(new UnallyCommand());
    client.addCommand(new SetFlagCommand());
    client.addCommand(new SetCapitalCommand());
    client.addCommand(new SetTaxRateCommand());
    client.addCommand(new SetPrefixCommand());
    client.addCommand(new LawCommand());
    client.addCommand(new MultiAllianceCommand());
    client.addCommand(new MapCommand());
    client.addCommand(new AllianceMapCommand());
    client.addCommand(new TagCommand());
    client.addCommand(new AddDescCommand());
    client.addCommand(new ProvincialCapitalsCommand());
    client.addCommand(new LoansCommand());
    client.addCommand(new InvestCommand());
    client.addCommand(new CompareNationsCommand());
    client.addCommand(new DashboardCommand());
    client.addCommand(new SetGovernmentTypeCommand());
    client.addCommand(new InternationalRelationsCommand());
    
    logger.info(`Registered ${client.commands.size} commands`);
    console.log(`Registered ${client.commands.size} commands`);
    
    // Start the bot
    console.log('Starting bot client...');
    await client.start();
    console.log('Bot started successfully!');
    
    // Start daily debt compounding (every 24 hours)
    let debtCompoundingInterval: NodeJS.Timeout | null = null;
    
    const startDebtCompounding = () => {
      const checkAndCompound = () => {
        try {
          const lastCompound = client.database.getLastDebtCompound();
          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          if (!lastCompound || lastCompound < twentyFourHoursAgo) {
            logger.info('Running daily debt compounding...');
            client.database.compoundNationalDebt();
            logger.info('Daily debt compounding completed');
          }
        } catch (error) {
          logger.error('Error during debt compounding:', { error: error as Error });
        }
      };
      
      // Run immediately on startup
      checkAndCompound();
      
      // Then run every hour to check if 24 hours have passed
      debtCompoundingInterval = setInterval(checkAndCompound, 60 * 60 * 1000); // Check every hour
    };
    
    startDebtCompounding();
    
    // Handle graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        // Clear the debt compounding interval
        if (debtCompoundingInterval) {
          clearInterval(debtCompoundingInterval);
          debtCompoundingInterval = null;
          logger.info('Debt compounding interval cleared');
        }
        
        await client.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', { error: error as Error });
        process.exit(1);
      }
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', { error });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { metadata: { promise, reason } });
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start bot:', { error: error as Error });
    console.error('Detailed error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// Start the bot
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});