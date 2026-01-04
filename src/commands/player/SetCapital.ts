import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { isValidCapital } from '../../utils/FormatUtils';

export class SetCapitalCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('set-capital')
    .setDescription('Set your nation\'s capital city')
    .addStringOption(option =>
      option.setName('capital')
        .setDescription('Name of your nation\'s capital city')
        .setRequired(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const capital = interaction.options.getString('capital', true).trim();

    try {
      // Check if user is linked to a nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to set a capital. Contact an admin to link your account.'
        });
        return;
      }

      // Validate capital name
      if (!isValidCapital(capital)) {
        await interaction.reply({
          content: '❌ Invalid capital name. Please use 1-50 characters with letters, numbers, spaces, and basic punctuation only.'
        });
        return;
      }

      // Check if nation exists
      const nation = dbManager.getNationByName(userLink.nationName);
      if (!nation) {
        await interaction.reply({
          content: '❌ Your linked nation was not found. Contact an admin.'
        });
        return;
      }

      // Set the capital
      const success = dbManager.setNationCapital(userLink.nationName, capital, interaction.user.id);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to set the capital. Please try again.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏛️ Capital Updated')
        .setDescription(`Successfully set the capital for **${userLink.nationName}**`)
        .addFields(
          { name: '🏛️ New Capital', value: capital, inline: true },
          { name: '🗺️ Nation', value: userLink.nationName, inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} set capital for nation ${userLink.nationName}: ${capital}`);

    } catch (error) {
      logger.error('Error setting capital:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while setting the capital. Please try again.'
      });
    }
  }
}