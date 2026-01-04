import { format, formatInTimeZone } from 'date-fns-tz';

export class TimeUtils {
  private static timezone = process.env.TIMEZONE || 'America/New_York';

  /**
   * Format a date in the configured timezone
   */
  public static formatInLocalTime(date: Date, formatStr: string = 'yyyy-MM-dd HH:mm:ss zzz'): string {
    return formatInTimeZone(date, this.timezone, formatStr);
  }

  /**
   * Get Discord timestamp for local timezone
   */
  public static getDiscordTimestamp(date: Date, style: 'f' | 'F' | 'd' | 'D' | 't' | 'T' | 'R' = 'f'): string {
    const timestamp = Math.floor(date.getTime() / 1000);
    return `<t:${timestamp}:${style}>`;
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  public static getRelativeTime(date: Date): string {
    return this.getDiscordTimestamp(date, 'R');
  }

  /**
   * Format full date and time
   */
  public static getFullDateTime(date: Date): string {
    return this.getDiscordTimestamp(date, 'F');
  }

  /**
   * Format short time
   */
  public static getShortTime(date: Date): string {
    return this.getDiscordTimestamp(date, 't');
  }
}