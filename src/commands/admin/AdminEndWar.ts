import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AdminEndWarCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-end-war')
    .setDescription('End an active war')
    .addIntegerOption(option =>
      option.setName('war_id')
        .setDescription('ID of the war to end')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for ending the war (optional)')
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const warId = interaction.options.getInteger('war_id', true);
    const reason = interaction.options.getString('reason');

    try {
      // Check if war exists and is active
      const existingWar = dbManager.getWarById(warId);
      if (!existingWar) {
        await interaction.reply({
          content: `❌ War with ID ${warId} not found.`
        });
        return;
      }

      if (existingWar.status !== 'active') {
        await interaction.reply({
          content: `❌ War "${existingWar.name}" is already ${existingWar.status}.`
        });
        return;
      }

      // End the war
      const endedWar = dbManager.endWar(warId, interaction.user.id, reason || undefined);
      
      if (!endedWar) {
        await interaction.reply({
          content: '❌ Failed to end the war. Please try again.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚔️ War Ended')
        .setDescription(`Successfully ended the war: **${endedWar.name}**`)
        .addFields(
          { name: '🆔 War ID', value: endedWar.id.toString(), inline: true },
          { name: '👥 Participants', value: Array.isArray(endedWar.participants) ? endedWar.participants.join(', ') : endedWar.participants, inline: true },
          { name: '💀 Total Casualties', value: endedWar.casualties.toLocaleString(), inline: true },
          { name: '📅 Started', value: new Date(endedWar.startDate).toLocaleDateString(), inline: true },
          { name: '🏁 Ended', value: new Date().toLocaleDateString(), inline: true },
          { name: '👤 Ended By', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor(0xff6b6b)
        .setTimestamp();

      if (reason) {
        embed.addFields({ name: '📝 Reason', value: reason, inline: false });
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.id} ended war ${warId}: ${endedWar.name}`);

    } catch (error) {
      logger.error('Error ending war:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while ending the war. Please try again.'
      });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toString().toLowerCase();
    
    try {
      // Get all active wars
      const activeWars = dbManager.getAllWars().filter(war => war.status === 'active');
      
      const filtered = activeWars
        .filter(war => 
          war.name.toLowerCase().includes(focusedValue) ||
          (Array.isArray(war.participants) ? war.participants.join(', ') : war.participants).toLowerCase().includes(focusedValue) ||
          war.id.toString().includes(focusedValue)
        )
        .slice(0, 25)
        .map(war => ({
          name: `${war.id}: ${war.name} (${Array.isArray(war.participants) ? war.participants.join(', ') : war.participants})`,
          value: war.id
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('Error in autocomplete:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}