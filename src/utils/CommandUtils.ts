import { ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { DatabaseManager } from '../database/DatabaseManager';
import { Logger } from './Logger';
import { NationStats } from '../types';

/**
 * Standardized error handling for commands
 */
export async function handleCommandError(
  interaction: ChatInputCommandInteraction,
  error: Error,
  logger: Logger,
  context?: string
): Promise<void> {
  const errorId = Math.random().toString(36).substring(2, 15);
  
  logger.error(`Command error [${errorId}]: ${context || 'Unknown context'}`, {
    error,
    user: interaction.user.id,
    command: interaction.commandName,
    ...(interaction.guild?.id && { guild: interaction.guild.id }),
    metadata: {
      channel: interaction.channel?.id
    }
  });

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('❌ Command Error')
    .setDescription('An unexpected error occurred while processing your command. Please try again in a moment.')
    .addFields({
      name: 'Error ID',
      value: `\`${errorId}\``,
      inline: true
    })
    .setTimestamp();

  try {
    if (interaction.replied) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (replyError) {
    logger.error(`Failed to send error response [${errorId}]:`, { 
      error: replyError as Error,
      metadata: {
        originalError: error
      }
    });
  }
}

/**
 * Safe interaction reply that handles all states
 */
export async function safeReply(
  interaction: ChatInputCommandInteraction,
  content: any,
  ephemeral: boolean = false
): Promise<void> {
  const options = typeof content === 'string' 
    ? { content, ephemeral }
    : { ...content, ephemeral };

  if (interaction.replied) {
    await interaction.followUp(options);
  } else if (interaction.deferred) {
    await interaction.editReply(options);
  } else {
    await interaction.reply(options);
  }
}

/**
 * Get nation with helpful suggestions if not found
 */
export async function getNationWithSuggestions(
  dbManager: DatabaseManager,
  nationName: string,
  interaction: ChatInputCommandInteraction,
  logger: Logger
): Promise<NationStats | null> {
  try {
    const nation = dbManager.getNationByName(nationName);
    if (!nation) {
      const allNations = dbManager.getAllNations();
      const suggestions = allNations
        .filter(n => n.name.toLowerCase().includes(nationName.toLowerCase()))
        .slice(0, 5)
        .map(n => n.name)
        .join(', ');

      const suggestionText = suggestions ? `\n\nDid you mean: ${suggestions}?` : '';
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Nation Not Found')
        .setDescription(`Nation "${nationName}" was not found.${suggestionText}`)
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return null;
    }
    return nation;
  } catch (error) {
    await handleCommandError(interaction, error as Error, logger, 'getNationWithSuggestions');
    return null;
  }
}

/**
 * Validate Discord user ID format
 */
export function isValidDiscordId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Validate nation name format
 */
export function validateNationName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nation name is required' };
  }
  
  if (name.length < 2) {
    return { valid: false, error: 'Nation name must be at least 2 characters long' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Nation name must be less than 100 characters' };
  }
  
  if (!/^[a-zA-Z0-9\s\-'.,()&]+$/.test(name)) {
    return { valid: false, error: 'Nation name contains invalid characters' };
  }
  
  return { valid: true };
}

/**
 * Validate tax rate
 */
export function validateTaxRate(rate: number): { valid: boolean; error?: string } {
  if (typeof rate !== 'number' || isNaN(rate) || !isFinite(rate)) {
    return { valid: false, error: 'Invalid tax rate format' };
  }
  
  if (rate < 0) {
    return { valid: false, error: 'Tax rate cannot be negative' };
  }
  
  if (rate > 50) {
    return { valid: false, error: 'Tax rate cannot exceed 50%' };
  }
  
  return { valid: true };
}

/**
 * Validate GDP value
 */
export function validateGDP(gdp: number): { valid: boolean; error?: string } {
  if (typeof gdp !== 'number' || isNaN(gdp) || !isFinite(gdp)) {
    return { valid: false, error: 'Invalid GDP format' };
  }
  
  if (gdp < 0) {
    return { valid: false, error: 'GDP cannot be negative' };
  }
  
  if (gdp > 1000000) {
    return { valid: false, error: 'GDP value is unrealistically high' };
  }
  
  return { valid: true };
}

/**
 * Validate population value
 */
export function validatePopulation(population: number): { valid: boolean; error?: string } {
  if (typeof population !== 'number' || isNaN(population) || !isFinite(population)) {
    return { valid: false, error: 'Invalid population format' };
  }
  
  if (population < 0) {
    return { valid: false, error: 'Population cannot be negative' };
  }
  
  if (!Number.isInteger(population)) {
    return { valid: false, error: 'Population must be a whole number' };
  }
  
  if (population > 10000000000) { // 10 billion
    return { valid: false, error: 'Population value is unrealistically high' };
  }
  
  return { valid: true };
}

/**
 * Validate stability value
 */
export function validateStability(stability: number): { valid: boolean; error?: string } {
  if (typeof stability !== 'number' || isNaN(stability) || !isFinite(stability)) {
    return { valid: false, error: 'Invalid stability format' };
  }
  
  if (stability < 0) {
    return { valid: false, error: 'Stability cannot be negative' };
  }
  
  if (stability > 100) {
    return { valid: false, error: 'Stability cannot exceed 100%' };
  }
  
  return { valid: true };
}

/**
 * Sanitize string input for logging
 */
export function sanitizeForLog(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potential sensitive patterns
  return input
    .replace(/password|token|secret|key/gi, '***')
    .substring(0, 200); // Limit length
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Standardized autocomplete handler
 */
export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  dbManager: DatabaseManager,
  logger: Logger,
  searchFunction: (searchTerm: string) => { name: string; value: string }[]
): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const results = searchFunction(focusedValue);
    
    await interaction.respond(results.slice(0, 25));
  } catch (error) {
    logger.error('Error in autocomplete handler:', {
      error: error as Error,
      command: interaction.commandName,
      user: interaction.user.id
    });
    
    // Return empty results on error to prevent Discord timeout
    await interaction.respond([]);
  }
}

/**
 * Command cooldown manager
 */
class CooldownManager {
  private cooldowns = new Map<string, Map<string, number>>();
  
  public getCooldown(commandName: string, userId: string, cooldownMs: number = 3000): number {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }
    
    const userCooldowns = this.cooldowns.get(commandName)!;
    const now = Date.now();
    const cooldownEnd = userCooldowns.get(userId) || 0;
    
    if (now < cooldownEnd) {
      return cooldownEnd - now;
    }
    
    userCooldowns.set(userId, now + cooldownMs);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup();
    }
    
    return 0;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [commandName, userCooldowns] of this.cooldowns) {
      for (const [userId, cooldownEnd] of userCooldowns) {
        if (now > cooldownEnd) {
          userCooldowns.delete(userId);
        }
      }
      
      if (userCooldowns.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }
  }
}

export const cooldownManager = new CooldownManager();

/**
 * Check command cooldown
 */
export async function checkCooldown(
  interaction: ChatInputCommandInteraction,
  cooldownMs: number = 3000
): Promise<boolean> {
  const remaining = cooldownManager.getCooldown(
    interaction.commandName,
    interaction.user.id,
    cooldownMs
  );
  
  if (remaining > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle('⏱️ Command Cooldown')
      .setDescription(`Please wait ${Math.ceil(remaining / 1000)} seconds before using this command again.`)
      .setTimestamp();
    
    await safeReply(interaction, { embeds: [embed] }, true);
    return false;
  }
  
  return true;
}