import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { isValidCapital } from '../../utils/FormatUtils';

export class AdminSetCapitalCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-set-capital')
    .setDescription('Set any nation\'s capital city (admin only)')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation name')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('capital')
        .setDescription('Name of the capital city')
        .setRequired(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const capital = interaction.options.getString('capital', true).trim();

    try {
      // Check if nation exists
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const allNations = dbManager.getAllNations();
        const suggestions = allNations
          .filter(n => n.name.toLowerCase().includes(nationName.toLowerCase()))
          .slice(0, 5)
          .map(n => n.name)
          .join(', ');

        const suggestionText = suggestions ? `\n\nDid you mean: ${suggestions}?` : '';
        
        await interaction.reply({
          content: `❌ Nation "${nationName}" not found.${suggestionText}`
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

      // Set the capital
      const success = dbManager.setNationCapital(nationName, capital, interaction.user.id);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to set the capital. Please try again.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏛️ Capital Updated (Admin)')
        .setDescription(`Successfully set the capital for **${nationName}**`)
        .addFields(
          { name: '🏛️ New Capital', value: capital, inline: true },
          { name: '🗺️ Nation', value: nationName, inline: true },
          { name: '👤 Set By', value: 'System Administrator', inline: true }
        )
        .setColor(0xff9500)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.id} set capital for nation ${nationName}: ${capital}`);

    } catch (error) {
      logger.error('Error setting capital (admin):', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while setting the capital. Please try again.'
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
      const nations = dbManager.getAllNations();
      
      const filtered = nations
        .filter(nation => nation.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(nation => ({
          name: nation.name,
          value: nation.name
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('Error in autocomplete:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}