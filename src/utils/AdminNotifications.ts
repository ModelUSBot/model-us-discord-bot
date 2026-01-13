import { ChatInputCommandInteraction, EmbedBuilder, TextBasedChannel } from 'discord.js';
import { Logger } from './Logger';

/**
 * Utility class for sending admin notifications
 */
export class AdminNotifications {
  private static readonly ADMIN_ROLE_ID = '1456867369111519335';
  
  /**
   * Get the admin channel ID - correct admin notification channel
   */
  private static getAdminChannelId(): string {
    return '1457229969481531463';
  }

  /**
   * Send an admin notification to the configured admin channel
   */
  public static async sendNotification(
    interaction: ChatInputCommandInteraction,
    embed: EmbedBuilder,
    content: string,
    logger: Logger
  ): Promise<void> {
    try {
      const adminChannelId = this.getAdminChannelId();
      const adminChannel = await interaction.client.channels.fetch(adminChannelId);
      
      if (adminChannel && adminChannel.isTextBased() && 'send' in adminChannel) {
        await adminChannel.send({ 
          content: `<@&${this.ADMIN_ROLE_ID}> ${content}`,
          embeds: [embed] 
        });
      } else {
        logger.warn('Admin channel not found or not text-based', { 
          metadata: { channelId: adminChannelId }
        });
      }
    } catch (error) {
      logger.warn('Failed to send admin notification:', { error: error as Error });
    }
  }

  /**
   * Create a standard admin notification embed
   */
  public static createEmbed(
    title: string,
    description: string,
    color: number = 0x0099ff
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Send alliance request notification with comprehensive information
   */
  public static async sendAllianceRequestNotification(
    interaction: ChatInputCommandInteraction,
    requestingNation: string,
    targetNation: string,
    targetUserLinked: boolean,
    logger: Logger,
    targetUserId?: string
  ): Promise<void> {
    // Get additional nation information
    const guildName = interaction.guild?.name || 'Unknown Server';
    const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
    const embed = this.createEmbed(
      '🤝 New Alliance Request',
      `A new alliance request has been submitted and requires ${targetUserLinked ? 'player approval' : 'admin approval'}.`
    )
    .addFields(
      { name: '🏛️ Requesting Nation', value: requestingNation, inline: true },
      { name: '🎯 Target Nation', value: targetNation, inline: true },
      { name: '👤 Requested By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: '🔗 Target User Status', value: targetUserLinked ? `Linked to <@${targetUserId}>` : 'Not linked - Admin approval required', inline: false },
      { name: '🌍 Server', value: guildName, inline: true },
      { name: '📍 Channel', value: channelName, inline: true },
      { name: '⏰ Time (EST)', value: timestamp, inline: true },
      { name: '🆔 User ID', value: interaction.user.id, inline: true },
      { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
      { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true }
    )
    .setFooter({ 
      text: targetUserLinked 
        ? 'Target user has been notified via DM' 
        : 'Use /admin-alliance-add to approve this request manually' 
    });

    await this.sendNotification(interaction, embed, 'New alliance request!', logger);
  }

  /**
   * Send alliance response notification with comprehensive information
   */
  public static async sendAllianceResponseNotification(
    interaction: ChatInputCommandInteraction,
    requestingNation: string,
    respondingNation: string,
    accepted: boolean,
    originalRequesterId: string,
    logger: Logger
  ): Promise<void> {
    const guildName = interaction.guild?.name || 'Unknown Server';
    const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
    const embed = this.createEmbed(
      accepted ? '✅ Alliance Request Accepted' : '❌ Alliance Request Declined',
      `An alliance request has been ${accepted ? 'accepted' : 'declined'}.`,
      accepted ? 0x00ff00 : 0xff0000
    )
    .addFields(
      { name: '🏛️ Requesting Nation', value: requestingNation, inline: true },
      { name: '🏛️ Responding Nation', value: respondingNation, inline: true },
      { name: '👤 Responded By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: '👤 Original Requester', value: `<@${originalRequesterId}>`, inline: true },
      { name: '📅 Final Status', value: accepted ? 'Active Alliance' : 'Declined', inline: true },
      { name: '🌍 Server', value: guildName, inline: true },
      { name: '📍 Channel', value: channelName, inline: true },
      { name: '⏰ Time (EST)', value: timestamp, inline: true },
      { name: '🆔 Responder ID', value: interaction.user.id, inline: true },
      { name: '🆔 Requester ID', value: originalRequesterId, inline: true },
      { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
      { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true }
    )
    .setFooter({ 
      text: accepted 
        ? 'Alliance is now active - both parties have been notified' 
        : 'Alliance request declined - requester has been notified' 
    });

    await this.sendNotification(interaction, embed, `Alliance request ${accepted ? 'accepted' : 'declined'}!`, logger);
  }

  /**
   * Send multi-alliance creation notification with comprehensive information
   */
  public static async sendMultiAllianceCreationNotification(
    interaction: ChatInputCommandInteraction,
    allianceName: string,
    leaderNation: string,
    description: string,
    logger: Logger
  ): Promise<void> {
    const guildName = interaction.guild?.name || 'Unknown Server';
    const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
    const embed = this.createEmbed(
      '🤝 New Multi-Alliance Created',
      'A new multi-nation alliance has been created.',
      0x9932cc
    )
    .addFields(
      { name: '🏷️ Alliance Name', value: allianceName, inline: true },
      { name: '👑 Leader Nation', value: leaderNation, inline: true },
      { name: '👤 Created By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: '📋 Description', value: description || 'No description provided', inline: false },
      { name: '🌍 Server', value: guildName, inline: true },
      { name: '📍 Channel', value: channelName, inline: true },
      { name: '⏰ Time (EST)', value: timestamp, inline: true },
      { name: '🆔 Creator ID', value: interaction.user.id, inline: true },
      { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
      { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true },
      { name: '👥 Initial Members', value: '1 (Leader only)', inline: true },
      { name: '📊 Alliance Capacity', value: 'Unlimited members', inline: true }
    )
    .setFooter({ text: 'Alliance is now available for other nations to join' });

    await this.sendNotification(interaction, embed, 'New multi-alliance created!', logger);
  }

  /**
   * Send multi-alliance join notification with comprehensive information
   */
  public static async sendMultiAllianceJoinNotification(
    interaction: ChatInputCommandInteraction,
    nationName: string,
    allianceName: string,
    leaderNation: string,
    currentMemberCount: number,
    logger: Logger
  ): Promise<void> {
    const guildName = interaction.guild?.name || 'Unknown Server';
    const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
    const embed = this.createEmbed(
      '🤝 Nation Joined Multi-Alliance',
      'A nation has joined a multi-alliance.',
      0x9932cc
    )
    .addFields(
      { name: '🏛️ Nation', value: nationName, inline: true },
      { name: '🏷️ Alliance', value: allianceName, inline: true },
      { name: '👤 Joined By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: '👑 Alliance Leader', value: leaderNation, inline: true },
      { name: '👥 New Member Count', value: `${currentMemberCount + 1} members`, inline: true },
      { name: '🌍 Server', value: guildName, inline: true },
      { name: '📍 Channel', value: channelName, inline: true },
      { name: '⏰ Time (EST)', value: timestamp, inline: true },
      { name: '🆔 User ID', value: interaction.user.id, inline: true },
      { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
      { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true },
      { name: '📊 Nation Alliance Status', value: 'Now member of multi-alliance', inline: true }
    )
    .setFooter({ text: 'Nation successfully added to alliance roster' });

    await this.sendNotification(interaction, embed, 'Nation joined multi-alliance!', logger);
  }
}