import { 
  Client, 
  Collection, 
  GatewayIntentBits, 
  Partials,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Events,
  ActivityType,
  Interaction,
  MessageFlags
} from 'discord.js';
import { DatabaseManager } from '../database/DatabaseManager';
import { PermissionManager } from './PermissionManager';
import { Logger } from '../utils/Logger';
import { DisasterGenerator } from '../utils/DisasterGenerator';
import { BotConfig, Command } from '../types';

export class BotClient extends Client {
  public commands: Collection<string, Command>;
  public database: DatabaseManager;
  public permissions: PermissionManager;
  public logger: Logger;
  public config: BotConfig;
  public disasterGenerator: DisasterGenerator;

  constructor(config: BotConfig) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    });

    this.config = config;
    this.logger = new Logger(config.logLevel);
    this.commands = new Collection();
    this.database = new DatabaseManager(config.database, this.logger);
    this.permissions = new PermissionManager(config.adminUserIds, this.logger);
    this.disasterGenerator = new DisasterGenerator(this.logger);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.once(Events.ClientReady, this.onReady.bind(this));
    this.on(Events.InteractionCreate, this.onInteractionCreate.bind(this));
    this.on(Events.MessageCreate, this.onMessageCreate.bind(this));
    this.on(Events.Error, this.onError.bind(this));
    this.on(Events.Warn, this.onWarn.bind(this));
  }

  private async onReady(): Promise<void> {
    if (!this.user) return;
    
    // Set up Discord logging after client is ready
    if (this.config.botLogChannelId) {
      this.logger.setDiscordClient(this, this.config.botLogChannelId);
    }
    
    this.logger.info(`Bot is ready! Logged in as ${this.user.tag}`);
    this.logger.info(`Serving ${this.guilds.cache.size} guilds`);
    
    // Set bot activity
    this.user.setActivity('Model US Simulation', { type: ActivityType.Watching });
    
    // Log registered commands
    this.logger.info(`Loaded ${this.commands.size} commands:`);
    this.commands.forEach((command, name) => {
      this.logger.debug(`  - /${name}`);
    });
  }

  private async onInteractionCreate(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleChatInputCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
      }
    } catch (error) {
      this.logger.error('Error handling interaction:', { error: error as Error });
      
      // Only try to respond if the interaction hasn't been handled yet
      if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ 
            content: 'There was an error while executing this command!', 
            flags: MessageFlags.Ephemeral
          });
        } catch (replyError) {
          // If we can't reply, log it but don't throw
          this.logger.error('Failed to send error response:', { error: replyError as Error });
        }
      }
    }
  }

  private async handleChatInputCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    
    if (!command) {
      this.logger.warn(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    // Check admin permissions for admin commands
    if (interaction.commandName.startsWith('admin-')) {
      const hasPermission = await this.permissions.isAdmin(interaction);
      if (!hasPermission) {
        await interaction.reply({
          content: '❌ You do not have permission to use this command. Admin privileges required.'
        });
        this.logger.warn(`Unauthorized admin command attempt by ${interaction.user.tag} (${interaction.user.id})`);
        return;
      }
    }

    this.logger.info(`${interaction.user.tag} executed /${interaction.commandName} in ${interaction.guild?.name || 'DM'}`);
    
    try {
      await command.execute(interaction, this.database, this.logger);
    } catch (error) {
      this.logger.error('Error executing command:', {
        command: interaction.commandName,
        user: interaction.user.id,
        error: error as Error
      });
      
      // Only try to respond if the interaction hasn't been handled yet
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ There was an error while executing this command!',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        this.logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    
    if (!command || !command.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction, this.database, this.logger);
    } catch (error) {
      this.logger.error('Error in autocomplete:', {
        command: interaction.commandName,
        user: interaction.user.id,
        error: error as Error
      });
      
      // Try to respond with empty array if possible
      try {
        if (!interaction.responded) {
          await interaction.respond([]);
        }
      } catch (respondError) {
        // Ignore respond errors in autocomplete
      }
    }
  }

  private async onMessageCreate(message: any): Promise<void> {
    // Track user activity for non-bot messages
    if (message.author.bot) return;
    if (!message.guild) return; // Only track guild messages
    
    try {
      this.database.updateUserActivity(message.author.id, message.channel.id);
    } catch (error) {
      this.logger.error('Error updating user activity:', { error: error as Error });
    }
  }

  private onError(error: Error): void {
    this.logger.error('Discord client error:', { error });
  }

  private onWarn(warning: string): void {
    this.logger.warn('Discord client warning:', { metadata: { warning } });
  }

  public addCommand(command: Command): void {
    this.commands.set(command.data.name, command);
    this.logger.debug(`Loaded command: ${command.data.name}`);
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting bot...');
      await this.login(this.config.token);
    } catch (error) {
      this.logger.error('Failed to start bot:', { error: error as Error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down bot...');
    
    try {
      // Close database connection
      this.database.close();
      
      // Destroy Discord client
      this.destroy();
      
      this.logger.info('Bot shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown:', { error: error as Error });
      throw error;
    }
  }
}