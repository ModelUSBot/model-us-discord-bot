import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AddLawCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('add-law')
    .setDescription('Add a law or note for your nation')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name/title of the law')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Body text of the law')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addBooleanOption(option =>
      option.setName('public')
        .setDescription('Whether this law is public (default: true)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('tags')
        .setDescription('Tags to apply, separated by commas (e.g., "constitutional,civil-rights")')
        .setRequired(false)
        .setMaxLength(200)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const name = interaction.options.getString('name', true);
    const bodyText = interaction.options.getString('text', true);
    const isPublic = interaction.options.getBoolean('public') ?? true;
    const tagsString = interaction.options.getString('tags');

    try {
      // Check if user is linked to a nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to add laws. Contact an admin to link your account.'
        });
        return;
      }

      // Parse tags
      const tags = tagsString 
        ? tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : [];

      // Validate tags exist if provided
      if (tags.length > 0) {
        const invalidTags: string[] = [];
        for (const tagName of tags) {
          const tag = dbManager.getTagByName(tagName);
          if (!tag) {
            invalidTags.push(tagName);
          }
        }

        if (invalidTags.length > 0) {
          await interaction.reply({
            content: `❌ The following tags don't exist: ${invalidTags.join(', ')}\n\nUse \`/tag list\` to see available tags or \`/tag add\` to create new ones.`
          });
          return;
        }
      }

      // Create the law
      const law = dbManager.createLaw(name, bodyText, isPublic, userLink.nationName, interaction.user.id, tags);
      
      if (!law) {
        await interaction.reply({
          content: `❌ A law with the name "${name}" already exists for your nation. Please choose a different name.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📜 Law Added')
        .setDescription(`Successfully added law: **${name}**`)
        .addFields(
          { name: '🏛️ Nation', value: userLink.nationName, inline: true },
          { name: '👁️ Visibility', value: isPublic ? 'Public' : 'Private', inline: true },
          { name: '📝 Body Text', value: bodyText.length > 500 ? bodyText.substring(0, 500) + '...' : bodyText, inline: false }
        )
        .setColor(isPublic ? 0x3498db : 0x95a5a6)
        .setTimestamp();

      if (tags.length > 0) {
        embed.addFields({ name: '🏷️ Tags', value: tags.join(', '), inline: false });
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} added law "${name}" for nation ${userLink.nationName}`);

    } catch (error) {
      logger.error('Error adding law:', {
        command: 'add-law',
        user: interaction.user.id,
        error: error as Error,
        metadata: { name, bodyText: bodyText.substring(0, 100) + '...', isPublic, tagsString }
      });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while adding the law. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }
}