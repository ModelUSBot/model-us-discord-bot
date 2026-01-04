import { TextChannel, Client, EmbedBuilder } from 'discord.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  command?: string;
  user?: string;
  guild?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export class Logger {
  private level: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  private discordClient?: Client;
  private logChannelId?: string;
  private debugMode: boolean = false;

  constructor(level: LogLevel = 'info', discordClient?: Client, logChannelId?: string) {
    this.level = level;
    this.debugMode = process.env.DEBUG_MODE === 'true' || level === 'debug';
    
    if (discordClient) {
      this.discordClient = discordClient;
    }
    if (logChannelId) {
      this.logChannelId = logChannelId;
    }
  }

  public setDiscordClient(client: Client, logChannelId?: string): void {
    this.discordClient = client;
    if (logChannelId) {
      this.logChannelId = logChannelId;
    }
  }

  public enableDebugMode(enabled: boolean = true): void {
    this.debugMode = enabled;
    if (enabled && this.level !== 'debug') {
      this.info('Debug mode enabled - verbose logging activated');
    }
  }

  public isDebugMode(): boolean {
    return this.debugMode;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    
    let contextStr = '';
    if (context) {
      const contextParts: string[] = [];
      if (context.command) contextParts.push(`cmd:${context.command}`);
      if (context.user) contextParts.push(`user:${context.user}`);
      if (context.guild) contextParts.push(`guild:${context.guild}`);
      if (contextParts.length > 0) {
        contextStr = ` [${contextParts.join(', ')}]`;
      }
    }
    
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, this.debugMode ? 2 : 0) : String(arg)
    ).join(' ')}` : '';
    
    return `[${timestamp}] ${levelStr}${contextStr} ${message}${formattedArgs}`;
  }

  private getLogColor(level: LogLevel): number {
    switch (level) {
      case 'debug': return 0x6c757d; // Gray
      case 'info': return 0x17a2b8;  // Blue
      case 'warn': return 0xffc107;  // Yellow
      case 'error': return 0xdc3545; // Red
      default: return 0x6c757d;
    }
  }

  private async logToDiscord(level: LogLevel, message: string, context?: LogContext, ...args: any[]): Promise<void> {
    if (!this.discordClient || !this.logChannelId) return;
    
    try {
      const channel = await this.discordClient.channels.fetch(this.logChannelId) as TextChannel;
      if (!channel || !channel.isTextBased()) return;

      // For debug mode or errors, use embeds for better formatting
      if (this.debugMode || level === 'error' || level === 'warn') {
        const embed = new EmbedBuilder()
          .setColor(this.getLogColor(level))
          .setTitle(`${level.toUpperCase()} Log`)
          .setDescription(message)
          .setTimestamp();

        if (context) {
          if (context.command) embed.addFields({ name: 'Command', value: context.command, inline: true });
          if (context.user) embed.addFields({ name: 'User', value: context.user, inline: true });
          if (context.guild) embed.addFields({ name: 'Guild', value: context.guild, inline: true });
          
          if (context.error) {
            embed.addFields({ 
              name: 'Error Details', 
              value: `\`\`\`${context.error.stack || context.error.message}\`\`\``.substring(0, 1024),
              inline: false 
            });
          }
          
          if (context.metadata && Object.keys(context.metadata).length > 0) {
            embed.addFields({ 
              name: 'Metadata', 
              value: `\`\`\`json\n${JSON.stringify(context.metadata, null, 2)}\`\`\``.substring(0, 1024),
              inline: false 
            });
          }
        }

        if (args.length > 0) {
          const argsText = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join('\n');
          
          if (argsText.length > 0) {
            embed.addFields({ 
              name: 'Additional Data', 
              value: `\`\`\`${argsText}\`\`\``.substring(0, 1024),
              inline: false 
            });
          }
        }

        await channel.send({ embeds: [embed] });
      } else {
        // Simple text format for info logs
        const formattedMessage = this.formatMessage(level, message, context, ...args);
        
        if (formattedMessage.length > 1900) {
          const chunks = formattedMessage.match(/.{1,1900}/g) || [formattedMessage];
          for (const chunk of chunks) {
            await channel.send(`\`\`\`${chunk}\`\`\``);
          }
        } else {
          await channel.send(`\`\`\`${formattedMessage}\`\`\``);
        }
      }
    } catch (error) {
      // Don't log Discord errors to avoid infinite loops
      console.error('Failed to log to Discord channel:', error);
    }
  }

  debug(message: string, context?: LogContext, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context, ...args));
      this.logToDiscord('debug', message, context, ...args);
    }
  }

  info(message: string, context?: LogContext, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context, ...args));
      this.logToDiscord('info', message, context, ...args);
    }
  }

  warn(message: string, context?: LogContext, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context, ...args));
      this.logToDiscord('warn', message, context, ...args);
    }
  }

  error(message: string, context?: LogContext, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context, ...args));
      this.logToDiscord('error', message, context, ...args);
    }
  }

  // Convenience methods for common logging scenarios
  commandLog(command: string, user: string, message: string, metadata?: Record<string, any>): void {
    const context: LogContext = { command, user };
    if (metadata) {
      context.metadata = metadata;
    }
    this.info(message, context);
  }

  errorLog(message: string, error: Error, context?: Omit<LogContext, 'error'>): void {
    this.error(message, { ...context, error });
  }

  debugLog(message: string, metadata?: Record<string, any>, context?: Omit<LogContext, 'metadata'>): void {
    const logContext: LogContext = { ...context };
    if (metadata) {
      logContext.metadata = metadata;
    }
    this.debug(message, logContext);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
    this.info(`Log level changed to: ${level}`);
  }
}