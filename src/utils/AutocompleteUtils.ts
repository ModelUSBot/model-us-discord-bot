import { AutocompleteInteraction } from 'discord.js';
import { Logger } from './Logger';

/**
 * Utility functions for handling autocomplete interactions safely
 */

/**
 * Safely handle autocomplete with timeout protection
 * @param interaction The autocomplete interaction
 * @param handler The autocomplete handler function
 * @param logger Logger instance
 * @param timeoutMs Timeout in milliseconds (default: 2500ms)
 */
export async function safeAutocomplete(
  interaction: AutocompleteInteraction,
  handler: () => Promise<{ name: string; value: string }[]>,
  logger: Logger,
  timeoutMs: number = 2500
): Promise<void> {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<{ name: string; value: string }[]>((_, reject) => {
      setTimeout(() => reject(new Error('Autocomplete timeout')), timeoutMs);
    });

    // Race between the handler and timeout
    const results = await Promise.race([handler(), timeoutPromise]);
    
    await interaction.respond(results);
  } catch (error) {
    logger.warn('Autocomplete error or timeout:', { error: error as Error });
    
    // Always respond with empty array to prevent Discord errors
    try {
      await interaction.respond([]);
    } catch (responseError) {
      logger.error('Failed to respond to autocomplete:', { error: responseError as Error });
    }
  }
}

/**
 * Create a debounced autocomplete handler to reduce database calls
 * @param handler The original handler function
 * @param delayMs Debounce delay in milliseconds
 */
export function debounceAutocomplete<T extends any[]>(
  handler: (...args: T) => Promise<void>,
  delayMs: number = 300
): (...args: T) => Promise<void> {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return async (...args: T): Promise<void> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        try {
          await handler(...args);
          resolve();
        } catch (error) {
          resolve(); // Don't throw errors from debounced functions
        }
      }, delayMs);
    });
  };
}