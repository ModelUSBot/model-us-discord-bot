import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class MapCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('map')
    .setDescription('View the current world map');

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    try {
      const mapSettings = dbManager.getCurrentMap();
      
      if (!mapSettings) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🗺️ No Map Available')
          .setDescription('No world map has been set by the administrators yet.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🗺️ World Map')
        .setDescription(mapSettings.map_description || 'Current world map')
        .setImage(mapSettings.map_url)
        .setFooter({ 
          text: `Map set by admin • Last updated: ${new Date(mapSettings.set_at).toLocaleDateString()}` 
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error displaying map:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Loading Map')
        .setDescription('An error occurred while loading the map. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}