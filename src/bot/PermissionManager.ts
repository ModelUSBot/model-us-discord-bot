import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { Logger } from '../utils/Logger';

export class PermissionManager {
  private adminUserIds: Set<string>;
  private logger: Logger;

  constructor(adminUserIds: string[], logger: Logger) {
    this.adminUserIds = new Set(adminUserIds);
    this.logger = logger;
  }

  /**
   * Check if a user has admin permissions
   * Checks both Discord role permissions and hardcoded admin user IDs
   */
  public async isAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const userId = interaction.user.id;
    
    // Check hardcoded admin user IDs first
    if (this.adminUserIds.has(userId)) {
      this.logger.debug(`User ${interaction.user.tag} has admin access via user ID`);
      return true;
    }

    // Check Discord role permissions
    if (interaction.guild && interaction.memberPermissions) {
      const hasAdminRole = interaction.memberPermissions.has([
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles
      ], false); // false = user needs ANY of these permissions, not all

      if (hasAdminRole) {
        this.logger.debug(`User ${interaction.user.tag} has admin access via Discord roles`);
        return true;
      }
    }

    this.logger.debug(`User ${interaction.user.tag} does not have admin access`);
    return false;
  }

  /**
   * Verify admin permissions and respond with error if not authorized
   * Returns true if user is admin, false if not (and sends error response)
   */
  public async verifyAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const isAdmin = await this.isAdmin(interaction);
    
    if (!isAdmin) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command. Admin privileges required.',
        flags: MessageFlags.Ephemeral
      });
      
      this.logger.warn(`Unauthorized admin command attempt by ${interaction.user.tag} (${interaction.user.id})`);
      return false;
    }

    return true;
  }

  /**
   * Log an admin action for audit purposes
   */
  public logAdminAction(
    interaction: ChatInputCommandInteraction, 
    action: string, 
    details: string,
    database: any // DatabaseManager type
  ): void {
    try {
      database.logAdminAction(interaction.user.id, action, details);
      this.logger.info(`Admin action logged: ${interaction.user.tag} - ${action}`);
    } catch (error) {
      this.logger.error('Failed to log admin action:', { error: error as Error });
    }
  }

  /**
   * Add a new admin user ID
   */
  public addAdminUser(userId: string): void {
    this.adminUserIds.add(userId);
    this.logger.info(`Added admin user: ${userId}`);
  }

  /**
   * Remove an admin user ID
   */
  public removeAdminUser(userId: string): void {
    this.adminUserIds.delete(userId);
    this.logger.info(`Removed admin user: ${userId}`);
  }

  /**
   * Get all admin user IDs
   */
  public getAdminUsers(): string[] {
    return Array.from(this.adminUserIds);
  }

  /**
   * Check if user has leadership permissions (President or Vice President)
   */
  public hasLeadershipPermissions(interaction: ChatInputCommandInteraction, dbManager: any): boolean {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      return false;
    }

    return userLink.role === 'president' || userLink.role === 'vice_president';
  }

  /**
   * Check if user is admin or has leadership permissions
   */
  public async isAdminOrLeader(interaction: ChatInputCommandInteraction, dbManager: any): Promise<boolean> {
    const isAdmin = await this.isAdmin(interaction);
    if (isAdmin) {
      return true;
    }

    return this.hasLeadershipPermissions(interaction, dbManager);
  }

  /**
   * Check if user has specific Discord permission
   */
  public hasPermission(interaction: ChatInputCommandInteraction, permission: bigint): boolean {
    if (!interaction.guild || !interaction.memberPermissions) {
      return false;
    }

    return interaction.memberPermissions.has(permission);
  }
}