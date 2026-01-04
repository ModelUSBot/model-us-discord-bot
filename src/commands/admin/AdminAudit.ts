import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatRelativeTime } from '../../utils/FormatUtils';

export class AdminAuditCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-audit')
    .setDescription('View audit log and change history for a nation')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation name to view audit history for')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of entries to show (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const limit = interaction.options.getInteger('limit') || 10;

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

      // Get admin actions related to this nation
      const auditEntries = dbManager.getNationAuditLog(nationName, limit);

      if (auditEntries.length === 0) {
        await interaction.reply({
          content: `📋 No audit entries found for nation "${nationName}".`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Audit Log: ${nationName}`)
        .setDescription(`Showing last ${auditEntries.length} entries`)
        .setColor(0x3498db)
        .setTimestamp();

      // Add audit entries as fields
      auditEntries.forEach((entry, index) => {
        const timestamp = formatRelativeTime(new Date(entry.timestamp));
        
        embed.addFields({
          name: `${index + 1}. ${entry.action} - ${timestamp}`,
          value: `**Admin:** System Administrator\n**Details:** ${entry.details}`,
          inline: false
        });
      });

      // Add nation current stats for reference
      embed.addFields({
        name: '📊 Current Nation Stats',
        value: `**GDP:** ${nation.gdp.toFixed(2)} Billion\n**Population:** ${nation.population.toLocaleString()}\n**Stability:** ${nation.stability.toFixed(1)}%`,
        inline: true
      });

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.id} viewed audit log for nation: ${nationName}`);

    } catch (error) {
      logger.error('Error retrieving audit log', { 
        command: 'admin-audit',
        user: interaction.user.id,
        error: error as Error,
        metadata: { nationName, limit }
      });
      
      await interaction.reply({
        content: '❌ Database temporarily unavailable. Please try again in a moment.'
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
      logger.error('Error in autocomplete', { 
        command: 'admin-audit',
        user: interaction.user.id,
        error: error as Error
      });
      await interaction.respond([]);
    }
  }
}