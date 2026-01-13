/**
 * Utility functions for formatting data consistently across the bot
 */

/**
 * Format GDP value in billions for display
 * @param billions GDP value in billions
 * @returns Formatted string in billions with $ symbol
 */
export function formatGDP(billions: number): string {
  return `$${billions.toFixed(2)} Billion`;
}

/**
 * Format relative time from a timestamp
 * @param timestamp The timestamp to format
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

/**
 * Calculate percentage change between two values
 * @param oldValue The original value
 * @param newValue The new value
 * @returns Percentage change as a number
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Format percentage change with appropriate sign and color indication
 * @param percentage The percentage change
 * @returns Formatted string with sign
 */
export function formatPercentageChange(percentage: number): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
}

/**
 * Validate flag format (emoji or image URL)
 * @param flag The flag string to validate
 * @returns True if valid emoji or image URL format
 */
export function isValidFlag(flag: string): boolean {
  // Check if it's a valid image URL
  if (isValidImageUrl(flag)) {
    return true;
  }
  
  // Check if it's a valid emoji
  const emojiRegex = /^[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;
  return emojiRegex.test(flag) && flag.length <= 10;
}

/**
 * Validate image URL format
 * @param url The URL to validate
 * @returns True if valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Must be HTTPS for security
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    
    // Check for common image file extensions
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const pathname = parsedUrl.pathname.toLowerCase();
    
    // Check if URL ends with image extension or contains image-related paths
    const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
    const isImageHost = ['imgur.com', 'i.imgur.com', 'cdn.discordapp.com', 'media.discordapp.net', 'github.com', 'raw.githubusercontent.com'].some(host => 
      parsedUrl.hostname.includes(host)
    );
    
    return hasImageExtension || isImageHost;
  } catch {
    return false;
  }
}

/**
 * Validate capital name
 * @param capital The capital name to validate
 * @returns True if valid capital name
 */
export function isValidCapital(capital: string): boolean {
  // Capital validation: 1-50 characters, alphanumeric and basic punctuation
  const capitalRegex = /^[a-zA-Z0-9\s\-'.,]{1,50}$/;
  return capitalRegex.test(capital.trim());
}

// Legacy function for backward compatibility
export function isValidCapitol(capitol: string): boolean {
  return isValidCapital(capitol);
}

/**
 * Get the proper casing for a nation name from the database
 * @param nationName The nation name (any case)
 * @param dbManager Database manager instance
 * @returns The properly cased nation name or null if not found
 */
export function getProperNationName(nationName: string, dbManager: any): string | null {
  try {
    const stmt = dbManager.db.prepare(`
      SELECT name FROM nations WHERE name = ? COLLATE NOCASE LIMIT 1
    `);
    const result = stmt.get(nationName);
    return result ? result.name : null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract the base name from a nation name by removing common prefixes
 * @param nationName The full nation name
 * @returns The base name without prefixes
 */
export function extractBaseName(nationName: string): string {
  const prefixes = [
    'Republic of ',
    'Empire of ',
    'Kingdom of ',
    'Federation of ',
    'Commonwealth of ',
    'United States of ',
    'Principality of ',
    'Duchy of '
  ];

  for (const prefix of prefixes) {
    if (nationName.startsWith(prefix)) {
      return nationName.substring(prefix.length);
    }
  }

  return nationName;
}
/**
 * Format time remaining in cooldown
 * @param milliseconds Time remaining in milliseconds
 * @returns Human-readable time remaining string
 */
export function formatTimeRemaining(milliseconds: number): string {
  const totalMinutes = Math.ceil(milliseconds / (1000 * 60));
  
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  
  return `${hours} hour${hours === 1 ? '' : 's'} and ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Format time remaining with Discord timestamp for better timezone handling
 * @param futureDate The future date when the cooldown expires
 * @returns Discord timestamp showing relative time
 */
export function formatCooldownTime(futureDate: Date): string {
  const timestamp = Math.floor(futureDate.getTime() / 1000);
  return `<t:${timestamp}:R>`;
}

/**
 * Create a timezone-aware Discord timestamp from a database datetime string
 * @param dateString Database datetime string (assumed to be UTC)
 * @param style Discord timestamp style (default: 'R' for relative)
 * @returns Discord timestamp that displays correctly in user's timezone
 */
export function formatDatabaseTimestamp(dateString: string, style: 'f' | 'F' | 'd' | 'D' | 't' | 'T' | 'R' = 'R'): string {
  // Parse the database date (SQLite CURRENT_TIMESTAMP is in UTC)
  const date = new Date(dateString + 'Z'); // Add 'Z' to ensure it's parsed as UTC
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}