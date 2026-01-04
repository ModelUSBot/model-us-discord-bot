import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class TagInfoCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('tag-info')
    .setDescription('Show detailed information about a tag')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the tag to get info about')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const tagName = interaction.options.getString('name', true);

    try {
      const tag = dbManager.getTagByName(tagName);
      
      if (!tag) {
        await interaction.reply({
          content: `❌ Tag "${tagName}" not found. Use \`/list-tags\` to see available tags.`
        });
        return;
      }

      // Get laws that use this tag
      const laws = dbManager.searchLaws({ 
        tagName: tag.name,
        requestingUser: interaction.user.id 
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏷️ Tag: ${tag.name}`)
        .setDescription(tag.description)
        .addFields(
          { name: '👤 Created By', value: `<@${tag.createdBy}>`, inline: true },
          { name: '📅 Created', value: tag.createdAt.toLocaleDateString(), inline: true },
          { name: '📊 Usage', value: `${laws.length} law${laws.length !== 1 ? 's' : ''}`, inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();

      // Show some example laws using this tag
      if (laws.length > 0) {
        const exampleLaws = laws
          .slice(0, 5) // Show up to 5 examples
          .map(law => {
            const visibility = law.isPublic ? '🌐' : '🔒';
            return `${visibility} **${law.name}** (${law.nationName})`;
          })
          .join('\n');

        embed.addFields({
          name: `📜 Laws Using This Tag${laws.length > 5 ? ' (showing first 5)' : ''}`,
          value: exampleLaws,
          inline: false
        });

        if (laws.length > 5) {
          embed.addFields({
            name: '📋 More Laws',
            value: `Use \`/list-laws tag:${tag.name}\` to see all ${laws.length} laws with this tag.`,
            inline: false
          });
        }
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} viewed info for tag "${tagName}"`);

    } catch (error) {
      logger.error('Error getting tag info:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while getting tag information. Please try again.'
      });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    try {
      const { tags } = dbManager.getAllTags(25, 1);
      
      const filtered = tags
        .filter(tag => tag.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(tag => ({
          name: `${tag.name} - ${tag.description}`,
          value: tag.name
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('Error in autocomplete:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}