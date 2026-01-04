import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AddTagCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('add-tag')
    .setDescription('Add a new tag for categorizing laws')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the tag (unique)')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Description of what this tag represents')
        .setRequired(true)
        .setMaxLength(200)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const name = interaction.options.getString('name', true).toLowerCase().trim();
    const description = interaction.options.getString('description', true);

    try {
      // Validate tag name format (alphanumeric, hyphens, underscores only)
      if (!/^[a-z0-9_-]+$/.test(name)) {
        await interaction.reply({
          content: '❌ Tag name can only contain lowercase letters, numbers, hyphens, and underscores.'
        });
        return;
      }

      // Create the tag
      const tag = dbManager.createTag(name, description, interaction.user.id);
      
      if (!tag) {
        await interaction.reply({
          content: `❌ A tag with the name "${name}" already exists. Please choose a different name.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏷️ Tag Created')
        .setDescription(`Successfully created tag: **${tag.name}**`)
        .addFields(
          { name: '📝 Description', value: tag.description, inline: false },
          { name: '👤 Created By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Created', value: tag.createdAt.toLocaleDateString(), inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} created tag "${name}"`);

    } catch (error) {
      logger.error('Error creating tag:', {
        command: 'add-tag',
        user: interaction.user.id,
        error: error as Error,
        metadata: { name, description }
      });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while creating the tag. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }
}