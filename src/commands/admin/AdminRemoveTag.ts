import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminRemoveTagCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-remove-tag')
    .setDescription('Remove a tag (admin only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the tag to remove')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for removing the tag (for logs)')
        .setRequired(false)
        .setMaxLength(200)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const tagName = interaction.options.getString('name', true);
    const reason = interaction.options.getString('reason') || 'Why not?';

    try {
      // Get tag info before removal for the confirmation message
      const tag = dbManager.getTagByName(tagName);
      if (!tag) {
        await interaction.reply({
          content: `❌ Tag "${tagName}" not found.`
        });
        return;
      }

      // Get laws that use this tag to show impact
      const affectedLaws = dbManager.searchLaws({ 
        tagName: tag.name,
        isPublic: true // Only count public laws for the message
      });

      // Remove the tag
      const success = dbManager.removeTag(tagName, interaction.user.id, reason);
      
      if (!success) {
        await interaction.reply({
          content: `❌ Failed to remove tag "${tagName}". It may have already been removed.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Tag Removed')
        .setDescription(`Successfully removed tag: **${tag.name}**`)
        .addFields(
          { name: '📝 Description', value: tag.description, inline: false },
          { name: '👤 Originally Created By', value: `<@${tag.createdBy}>`, inline: true },
          { name: '👤 Removed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setColor(0xff6b6b)
        .setTimestamp();

      if (affectedLaws.length > 0) {
        embed.addFields({
          name: '⚠️ Impact',
          value: `This tag was removed from ${affectedLaws.length} law${affectedLaws.length !== 1 ? 's' : ''}.`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.id} removed tag "${tagName}" - Reason: ${reason}`);

    } catch (error) {
      logger.error('Error removing tag:', {
        command: 'admin-remove-tag',
        user: interaction.user.id,
        error: error as Error,
        metadata: { tagName, reason }
      });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while removing the tag. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    try {
      const focusedValue = interaction.options.getFocused();
      
      // Simple, fast tag search
      if (focusedValue.length === 0) {
        const stmt = (dbManager as any).db.prepare(`SELECT name FROM tags ORDER BY name LIMIT 10`);
        const rows = stmt.all() as any[];
        const results = rows.map(row => ({ name: row.name, value: row.name }));
        await interaction.respond(results);
        return;
      }

      const stmt = (dbManager as any).db.prepare(`
        SELECT name FROM tags 
        WHERE name LIKE ? COLLATE NOCASE
        ORDER BY name
        LIMIT 10
      `);
      
      const searchPattern = `%${focusedValue}%`;
      const rows = stmt.all(searchPattern) as any[];
      const results = rows.map(row => ({ name: row.name, value: row.name }));
      
      await interaction.respond(results);
    } catch (error) {
      logger.error('AdminRemoveTag autocomplete error:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}