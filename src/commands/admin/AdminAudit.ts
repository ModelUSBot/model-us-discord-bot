import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatRelativeTime } from '../../utils/FormatUtils';
import { handleCommandError, getNationWithSuggestions, handleAutocomplete, checkCooldown } from '../../utils/CommandUtils';

export class AdminAuditCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-audit')
    .setDescription('View audit log and change history')
    .addSubcommand(subcommand =>
      subcommand
        .setName('nation')
        .setDescription('View audit history for a specific nation')
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
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('View all recent admin actions')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of entries to show (default: 15, max: 50)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Check cooldown
    if (!(await checkCooldown(interaction, 5000))) { // 5 second cooldown
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'nation') {
        await this.handleNationAudit(interaction, dbManager, logger);
      } else if (subcommand === 'all') {
        await this.handleAllAudit(interaction, dbManager, logger);
      }
    } catch (error) {
      await handleCommandError(interaction, error as Error, logger, 'admin-audit');
    }
  }

  private async handleNationAudit(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const limit = interaction.options.getInteger('limit') || 10;

    // Get nation with suggestions if not found
    const nation = await getNationWithSuggestions(dbManager, nationName, interaction, logger);
    if (!nation) return;

    // Get admin actions related to this nation
    const auditEntries = dbManager.getNationAuditLog(nationName, limit);

    if (auditEntries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('📋 No Audit Entries Found')
        .setDescription(`No audit entries found for nation "${nationName}". This could mean:\n• No admin actions have been performed on this nation\n• The nation name doesn't appear in audit details\n• All actions were performed before audit logging was implemented`)
        .addFields({
          name: '💡 Tip',
          value: 'Try using `/admin-audit all` to see all recent admin actions.',
          inline: false
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Audit Log: ${nationName}`)
      .setDescription(`Showing last ${auditEntries.length} entries`)
      .setColor(0x3498db)
      .setTimestamp();

    // Add audit entries as fields
    auditEntries.forEach((entry, index) => {
      const timestamp = formatRelativeTime(entry.timestamp);
      const adminInfo = entry.adminUsername === 'System' ? 'System' : `<@${entry.adminId}>`;
      
      embed.addFields({
        name: `${index + 1}. ${entry.action} - ${timestamp}`,
        value: `**Admin:** ${adminInfo}\n**Details:** ${entry.details}`,
        inline: false
      });
    });

    // Add nation current stats for reference
    embed.addFields({
      name: '📊 Current Nation Stats',
      value: `**GDP:** ${nation.gdp.toFixed(2)} Billion\n**Population:** ${nation.population.toLocaleString()}\n**Stability:** ${nation.stability.toFixed(1)}%\n**Tax Rate:** ${nation.taxRate.toFixed(1)}%`,
      inline: true
    });

    await interaction.reply({ embeds: [embed] });

    logger.info(`Admin ${interaction.user.id} viewed audit log for nation: ${nationName}`);
  }

  private async handleAllAudit(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const limit = interaction.options.getInteger('limit') || 15;

    // Get all recent admin actions
    const auditEntries = dbManager.getAllAdminActions(limit);

    if (auditEntries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('📋 No Audit Entries Found')
        .setDescription('No admin actions found in the audit log.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Recent Admin Actions')
      .setDescription(`Showing last ${auditEntries.length} admin actions`)
      .setColor(0x3498db)
      .setTimestamp();

    // Group entries by action type for better readability
    const groupedEntries = new Map<string, typeof auditEntries>();
    auditEntries.forEach(entry => {
      if (!groupedEntries.has(entry.action)) {
        groupedEntries.set(entry.action, []);
      }
      groupedEntries.get(entry.action)!.push(entry);
    });

    // Add entries, limiting to prevent embed size issues
    let fieldCount = 0;
    for (const [action, entries] of groupedEntries) {
      if (fieldCount >= 10) break; // Discord embed field limit

      const recentEntries = entries.slice(0, 3); // Show max 3 per action type
      const entriesText = recentEntries.map(entry => {
        const timestamp = formatRelativeTime(entry.timestamp);
        const nation = entry.nationAffected ? ` (${entry.nationAffected})` : '';
        return `• ${timestamp}${nation}: ${entry.details.substring(0, 100)}${entry.details.length > 100 ? '...' : ''}`;
      }).join('\n');

      embed.addFields({
        name: `${action} (${entries.length} recent)`,
        value: entriesText,
        inline: false
      });

      fieldCount++;
    }

    await interaction.reply({ embeds: [embed] });

    logger.info(`Admin ${interaction.user.id} viewed all admin actions audit log`);
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'nation') {
      await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
        const nations = dbManager.getAllNations();
        return nations
          .filter(nation => nation.name.toLowerCase().includes(searchTerm))
          .slice(0, 25)
          .map(nation => ({
            name: nation.name,
            value: nation.name
          }));
      });
    }
  }
}