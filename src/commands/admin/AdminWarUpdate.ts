import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AdminWarUpdateCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-war-update')
    .setDescription('Update war casualties (Admin only)')
    .addIntegerOption(option =>
      option.setName('war_id')
        .setDescription('ID of the war to update')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option.setName('casualties')
        .setDescription('New casualty count')
        .setRequired(true)
        .setMinValue(0)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const warId = interaction.options.getInteger('war_id', true);
    const casualties = interaction.options.getInteger('casualties', true);

    try {
      const currentWar = dbManager.getWarById(warId);
      if (!currentWar) {
        await interaction.reply({
          content: `❌ War with ID ${warId} not found.`,
          ephemeral: true
        });
        return;
      }

      const updatedWar = dbManager.updateWarCasualties(warId, casualties);
      if (!updatedWar) {
        await interaction.reply({
          content: '❌ Failed to update war casualties.',
          ephemeral: true
        });
        return;
      }

      dbManager.logAdminAction(
        interaction.user.id,
        'UPDATE_WAR',
        `Updated casualties for "${updatedWar.name}" from ${currentWar.casualties} to ${casualties}`
      );

      const embed = new EmbedBuilder()
        .setTitle('⚔️ War Casualties Updated')
        .setDescription(`Updated casualties for **${updatedWar.name}**`)
        .addFields(
          { name: '🆔 War ID', value: updatedWar.id.toString(), inline: true },
          { name: '📊 Previous Casualties', value: currentWar.casualties.toLocaleString(), inline: true },
          { name: '📊 New Casualties', value: updatedWar.casualties.toLocaleString(), inline: true },
          { name: '🏛️ Participants', value: updatedWar.participants.join(', '), inline: false }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error updating war casualties:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while updating war casualties. Please try again.',
        ephemeral: true
      });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    await interaction.respond([]);
  }
}