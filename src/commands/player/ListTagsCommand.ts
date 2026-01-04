import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class ListTagsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('list-tags')
    .setDescription('List all available tags')
    .addIntegerOption(option =>
      option.setName('items_per_page')
        .setDescription('How many tags to show per page (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    )
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to display (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const itemsPerPage = interaction.options.getInteger('items_per_page') || 10;
    const page = interaction.options.getInteger('page') || 1;

    try {
      const { tags, totalCount } = dbManager.getAllTags(itemsPerPage, page);

      if (totalCount === 0) {
        await interaction.reply({
          content: '🏷️ No tags have been created yet. Use `/add-tag` to create the first one!'
        });
        return;
      }

      const totalPages = Math.ceil(totalCount / itemsPerPage);

      if (page > totalPages) {
        await interaction.reply({
          content: `❌ Page ${page} doesn't exist. There are only ${totalPages} page(s) available.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏷️ Available Tags')
        .setDescription(`Showing page ${page} of ${totalPages} (${totalCount} total tags)`)
        .setColor(0x3498db)
        .setTimestamp();

      // Add tags as fields
      for (const tag of tags) {
        embed.addFields({
          name: `🏷️ ${tag.name}`,
          value: `${tag.description}\n*Created by <@${tag.createdBy}> on ${tag.createdAt.toLocaleDateString()}*`,
          inline: false
        });
      }

      // Add navigation info if there are multiple pages
      if (totalPages > 1) {
        embed.addFields({
          name: '📄 Navigation',
          value: `Use \`/list-tags page:${page + 1}\` for next page${page > 1 ? ` or \`/list-tags page:${page - 1}\` for previous page` : ''}`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} listed tags (page ${page})`);

    } catch (error) {
      logger.error('Error listing tags:', {
        command: 'list-tags',
        user: interaction.user.id,
        error: error as Error,
        metadata: { itemsPerPage, page }
      });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while listing tags. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }
}