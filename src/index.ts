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
import { AdminSetCapitalCommand } from './commands/admin/AdminSetCapital';
import { AdminRemoveTagCommand } from './commands/admin/AdminRemoveTag';
import { AdminSetPrefixCommand } from './commands/admin/AdminSetPrefix';

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
import { AddLawCommand } from './commands/player/AddLawCommand';
import { ReadLawCommand } from './commands/player/ReadLawCommand';
import { ListLawsCommand } from './commands/player/ListLawsCommand';
import { DeleteLawCommand } from './commands/player/DeleteLawCommand';
import { AddTagCommand } from './commands/player/AddTagCommand';
import { ListTagsCommand } from './commands/player/ListTagsCommand';
import { TagInfoCommand } from './commands/player/TagInfoCommand';
import { AddDescCommand } from './commands/player/AddDescCommand';

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
    client.addCommand(new AdminSetCapitalCommand());
    client.addCommand(new AdminRemoveTagCommand());
    client.addCommand(new AdminSetPrefixCommand());

    
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
    client.addCommand(new AddLawCommand());
    client.addCommand(new ReadLawCommand());
    client.addCommand(new ListLawsCommand());
    client.addCommand(new DeleteLawCommand());
    client.addCommand(new AddTagCommand());
    client.addCommand(new ListTagsCommand());
    client.addCommand(new TagInfoCommand());
    client.addCommand(new AddDescCommand());
    
    logger.info(`Registered ${client.commands.size} commands`);
    console.log(`Registered ${client.commands.size} commands`);
    
    // Start the bot
    console.log('Starting bot client...');
    await client.start();
    console.log('Bot started successfully!');
    
    // Handle graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
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