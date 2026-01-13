import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class SetGovernmentTypeCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('set-government-type')
    .setDescription('Set your nation\'s government type')
    .addStringOption(option =>
      option.setName('government_type')
        .setDescription('Type of government for your nation')
        .setRequired(true)
        .addChoices(
          { name: 'Democracy', value: 'Democracy' },
          { name: 'Republic', value: 'Republic' },
          { name: 'Constitutional Monarchy', value: 'Constitutional Monarchy' },
          { name: 'Parliamentary Democracy', value: 'Parliamentary Democracy' },
          { name: 'Federal Republic', value: 'Federal Republic' },
          { name: 'Presidential Republic', value: 'Presidential Republic' },
          { name: 'Monarchy', value: 'Monarchy' },
          { name: 'Absolute Monarchy', value: 'Absolute Monarchy' },
          { name: 'Dictatorship', value: 'Dictatorship' },
          { name: 'Military Dictatorship', value: 'Military Dictatorship' },
          { name: 'One-Party State', value: 'One-Party State' },
          { name: 'Totalitarian State', value: 'Totalitarian State' },
          { name: 'Fascist State', value: 'Fascist State' },
          { name: 'Communist State', value: 'Communist State' },
          { name: 'Socialist Republic', value: 'Socialist Republic' },
          { name: 'Theocracy', value: 'Theocracy' },
          { name: 'Islamic Republic', value: 'Islamic Republic' },
          { name: 'Oligarchy', value: 'Oligarchy' },
          { name: 'Technocracy', value: 'Technocracy' },
          { name: 'Federation', value: 'Federation' },
          { name: 'Confederation', value: 'Confederation' },
          { name: 'City-State', value: 'City-State' },
          { name: 'Empire', value: 'Empire' },
          { name: 'Anarchist Territory', value: 'Anarchist Territory' }
        ));

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const governmentType = interaction.options.getString('government_type', true);

    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to set a government type.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const currentNation = dbManager.getNationByName(userLink.nationName);
      if (!currentNation) {
        await interaction.reply({
          content: '❌ Your linked nation was not found in the database.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Set the government type
      const success = dbManager.setGovernmentType(userLink.nationName, governmentType, interaction.user.id);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to update government type. Please try again.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🏛️ Government Type Updated')
        .setDescription(`Successfully updated government type for **${userLink.nationName}**`)
        .addFields(
          { name: '🏛️ Previous Government Type', value: currentNation.governmentType || 'Democracy', inline: true },
          { name: '🏛️ New Government Type', value: governmentType, inline: true },
          { name: '👤 Updated By', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: `Updated by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.tag} updated government type for "${userLink.nationName}" to "${governmentType}"`);

    } catch (error) {
      logger.error('Error setting government type:', { error: error as Error });

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while setting the government type. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }
}