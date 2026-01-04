import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { Logger } from './Logger';

/**
 * Utility functions for handling command interactions safely
 */

/**
 * Safely execute a command with timeout protection and error handling
 * @param interaction The command interaction
 * @param handler The command handler function
 * @param logger Logger instance
 * @param timeoutMs Timeout in milliseconds (default: 10 seconds)
 */
export async function safeCommandExecution(
  interaction: ChatInputCommandInteraction,
  handler: () => Promise<void>,
  logger: Logger,
  timeoutMs: number = 10000
): Promise<void> {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Command execution timeout')), timeoutMs);
    });

    // Race between the handler and timeout
    await Promise.race([handler(), timeoutPromise]);
  } catch (error) {
    logger.error('Command execution error or timeout:', { 
      error: error as Error,
      command: interaction.commandName,
      user: interaction.user.id
    });
    
    // Only respond if we haven't already responded
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ The command took too long to execute or encountered an error. Please try again.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (responseError) {
      logger.error('Failed to send error response:', { error: responseError as Error });
    }
  }
}

/**
 * Check if an interaction is still valid (not expired)
 * @param interaction The interaction to check
 * @returns True if the interaction is still valid
 */
export function isInteractionValid(interaction: ChatInputCommandInteraction): boolean {
  // Discord interactions expire after 15 minutes
  const expirationTime = interaction.createdTimestamp + (15 * 60 * 1000);
  return Date.now() < expirationTime;
}

/**
 * Safely reply to an interaction with automatic fallback to followUp
 * @param interaction The interaction
 * @param options Reply options
 */
export async function safeReply(
  interaction: ChatInputCommandInteraction,
  options: Parameters<ChatInputCommandInteraction['reply']>[0]
): Promise<void> {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(options);
    } else {
      await interaction.followUp(options);
    }
  } catch (error) {
    // If reply fails, try followUp as a fallback
    try {
      if (!interaction.replied) {
        await interaction.followUp(options);
      }
    } catch (followUpError) {
      // If both fail, log the error but don't throw
      console.error('Failed to reply to interaction:', error);
      console.error('Failed to follow up interaction:', followUpError);
    }
  }
}