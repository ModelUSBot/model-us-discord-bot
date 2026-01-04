import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AddDescCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('add-desc')
    .setDescription('Add or update a description for your nation')
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Description of your nation')
        .setRequired(true)
        .setMaxLength(1000)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const description = interaction.options.getString('description', true);

    try {
      // Check if user is linked to a nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to set a description. Contact an admin to link your account.'
        });
        return;
      }

      // Set the description
      const success = dbManager.setNationDescription(userLink.nationName, description, interaction.user.id);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to set the description. Please try again.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📝 Nation Description Updated')
        .setDescription(`Successfully updated description for **${userLink.nationName}**`)
        .addFields({
          name: '📖 Description',
          value: description,
          inline: false
        })
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} set description for nation ${userLink.nationName}`);

    } catch (error) {
      logger.error('Error setting nation description:', { error: error as Error });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while setting the description. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }
}