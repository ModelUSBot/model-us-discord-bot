import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AllianceMapCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('alliance-map')
    .setDescription('View the current alliance map');

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    try {
      const mapSettings = dbManager.getCurrentMap('alliance');
      
      if (!mapSettings) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🗺️ No Alliance Map Available')
          .setDescription('No alliance map has been set by the administrators yet.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x9932cc)
        .setTitle('🤝 Alliance Map')
        .setDescription(mapSettings.map_description || 'Current alliance map')
        .setImage(mapSettings.map_url)
        .setFooter({ 
          text: `Alliance map set by admin • Last updated: ${new Date(mapSettings.set_at).toLocaleDateString()}` 
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error displaying alliance map:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Loading Alliance Map')
        .setDescription('An error occurred while loading the alliance map. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}