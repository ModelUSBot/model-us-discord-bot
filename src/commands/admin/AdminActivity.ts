import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AdminActivityCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-activity')
    .setDescription('Check user activity in a specific channel (Admin only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to check activity for')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildForum)
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Maximum number of users to display (default: 20)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);
    const limit = interaction.options.getInteger('limit') ?? 20;

    try {
      await interaction.deferReply();

      const activityData = dbManager.getChannelActivity(channel.id);

      dbManager.logAdminAction(
        interaction.user.id,
        'CHECK_ACTIVITY',
        `Checked activity for channel ${channel.name} (${channel.id})`
      );

      const embed = new EmbedBuilder()
        .setTitle(`📊 Activity Report: #${channel.name}`)
        .setDescription(`Found ${activityData.length} users with activity`)
        .setColor(0x0099ff)
        .setTimestamp();

      if (activityData.length === 0) {
        embed.addFields({
          name: '📭 No Activity',
          value: 'No user activity found in this channel.',
          inline: false
        });
      } else {
        const limitedData = activityData.slice(0, limit);
        const activityText = limitedData.map((activity, index) => {
          const timeDiff = Date.now() - activity.lastMessageAt.getTime();
          const timeAgo = this.formatTimeDifference(timeDiff);
          return `**${index + 1}.** <@${activity.discordId}>\n└ ${timeAgo} (${activity.messageCount} msgs)`;
        }).join('\n\n');

        embed.addFields({
          name: '👥 User Activity',
          value: activityText,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error checking user activity:', { error: error as Error });
      
      const errorMessage = '❌ An error occurred while checking user activity. Please try again.';
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    await interaction.respond([]);
  }

  private formatTimeDifference(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}