import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminAllianceRemoveCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-alliance-remove')
    .setDescription('Remove an alliance between two nations')
    .addStringOption(option =>
      option.setName('nation1')
        .setDescription('First nation in the alliance')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('nation2')
        .setDescription('Second nation in the alliance')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nation1 = interaction.options.getString('nation1', true);
    const nation2 = interaction.options.getString('nation2', true);

    try {
      // Find the alliance (in either direction)
      const findAllianceStmt = (dbManager as any).db.prepare(`
        SELECT * FROM alliances 
        WHERE ((nation1 = ? AND nation2 = ?) OR (nation1 = ? AND nation2 = ?))
        AND status = 'active'
      `);
      const alliance = findAllianceStmt.get(nation1, nation2, nation2, nation1);

      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`No active alliance exists between "${nation1}" and "${nation2}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Remove the alliance
      const removeAllianceStmt = (dbManager as any).db.prepare(`
        DELETE FROM alliances WHERE id = ?
      `);
      const result = removeAllianceStmt.run(alliance.id);

      if (result.changes === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Remove Alliance')
          .setDescription('Could not remove the alliance. Please try again.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Log admin action
      dbManager.logAdminAction(
        interaction.user.id,
        'ALLIANCE_REMOVE',
        `Removed alliance between "${alliance.nation1}" and "${alliance.nation2}"`
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Alliance Removed Successfully')
        .setDescription(`The alliance between **${alliance.nation1}** and **${alliance.nation2}** has been dissolved.`)
        .addFields(
          { name: '💔 Former Alliance', value: `${alliance.nation1} ❌ ${alliance.nation2}`, inline: false },
          { name: '👑 Removed By', value: 'Admin', inline: true },
          { name: '📅 Original Status', value: 'Active → Dissolved', inline: true }
        )
        .setFooter({ text: `Removed by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.tag} removed alliance between "${alliance.nation1}" and "${alliance.nation2}"`);

    } catch (error) {
      logger.error('Error removing alliance:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Removing Alliance')
        .setDescription('An error occurred while removing the alliance. Please try again.')
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
      async () => {
        // Get nations that have active alliances for more relevant suggestions
        const stmt = (dbManager as any).db.prepare(`
          SELECT DISTINCT nation1 as name FROM alliances WHERE status = 'active'
          UNION
          SELECT DISTINCT nation2 as name FROM alliances WHERE status = 'active'
          ORDER BY name
        `);
        const allianceNations = stmt.all() as any[];
        
        return allianceNations
          .filter(nation => nation.name.toLowerCase().includes(focusedValue))
          .slice(0, 25)
          .map(nation => ({
            name: nation.name,
            value: nation.name
          }));
      },
      logger
    );
  }
}
