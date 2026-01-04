import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminNationDeleteCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-nation-delete')
    .setDescription('Delete a nation from the database')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the nation to delete')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const name = interaction.options.getString('name', true);

    try {
      // Check if nation exists
      const nation = dbManager.getNationByName(name);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`No nation named "${name}" was found in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if nation has linked users
      const userLink = dbManager.getUserByNation(name);
      if (userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Cannot Delete Nation')
          .setDescription(`Nation "${name}" is linked to user <@${userLink.discordId}>. Please unlink the user first before deleting the nation.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Delete the nation (this will cascade to related records due to foreign keys)
      const stmt = (dbManager as any).db.prepare('DELETE FROM nations WHERE name = ? COLLATE NOCASE');
      const result = stmt.run(name);

      if (result.changes === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Delete Nation')
          .setDescription(`Could not delete nation "${name}". Please try again.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Log admin action
      dbManager.logAdminAction(
        interaction.user.id,
        'NATION_DELETE',
        `Deleted nation: ${name} (GDP: ${nation.gdp}B, Population: ${nation.population.toLocaleString()})`
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Nation Deleted Successfully')
        .setDescription(`Nation "${name}" has been permanently deleted from the database.`)
        .addFields(
          { name: '💰 GDP', value: formatGDP(nation.gdp), inline: true },
          { name: '👥 Population', value: nation.population.toLocaleString(), inline: true },
          { name: '📊 Stability', value: `${nation.stability.toFixed(1)}%`, inline: true }
        )
        .setFooter({ text: `Deleted by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.tag} deleted nation: ${name}`);

    } catch (error) {
      logger.error('Error deleting nation:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Deleting Nation')
        .setDescription('An error occurred while deleting the nation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    await safeAutocomplete(
      interaction,
      async () => dbManager.searchNationsForAutocomplete(focusedValue, 25),
      logger
    );
  }
}
