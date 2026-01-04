import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminSetPrefixCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-set-prefix')
    .setDescription('Set a prefix for any nation (Admin only)')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation to modify')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('prefix')
        .setDescription('Prefix to add to the nation name')
        .setRequired(true)
        .addChoices(
          { name: 'Republic of', value: 'Republic of' },
          { name: 'Empire of', value: 'Empire of' },
          { name: 'Kingdom of', value: 'Kingdom of' },
          { name: 'Federation of', value: 'Federation of' },
          { name: 'Commonwealth of', value: 'Commonwealth of' },
          { name: 'United States of', value: 'United States of' },
          { name: 'Principality of', value: 'Principality of' },
          { name: 'Duchy of', value: 'Duchy of' },
          { name: 'Remove Prefix', value: 'REMOVE' }
        )
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const prefix = interaction.options.getString('prefix', true);

    try {
      // Check if nation exists
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        await interaction.reply({
          content: `❌ Nation "${nationName}" not found.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      let newName: string;
      let actionDescription: string;

      if (prefix === 'REMOVE') {
        // Remove prefix - extract the base name
        const baseName = this.extractBaseName(nation.name);
        newName = baseName;
        actionDescription = `Removed prefix from "${nation.name}" → "${newName}"`;
      } else {
        // Add prefix
        const baseName = this.extractBaseName(nation.name);
        newName = `${prefix} ${baseName}`;
        actionDescription = `Added prefix to "${nation.name}" → "${newName}"`;
      }

      // Check if the new name already exists
      if (newName !== nation.name) {
        const existingNation = dbManager.getNationByName(newName);
        if (existingNation) {
          await interaction.reply({
            content: `❌ A nation named "${newName}" already exists. Please choose a different prefix.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      // Perform the rename if the name actually changed
      if (newName !== nation.name) {
        dbManager.transaction(() => {
          // Update nation name
          const updateNationStmt = (dbManager as any).db.prepare(`
            UPDATE nations 
            SET name = ?
            WHERE name = ? COLLATE NOCASE
          `);
          updateNationStmt.run(newName, nation.name);

          // Update user links
          const updateUserLinksStmt = (dbManager as any).db.prepare(`
            UPDATE user_links 
            SET nation_name = ? 
            WHERE nation_name = ? COLLATE NOCASE
          `);
          updateUserLinksStmt.run(newName, nation.name);

          // Update alliances
          const updateAlliancesStmt1 = (dbManager as any).db.prepare(`
            UPDATE alliances 
            SET nation1 = ? 
            WHERE nation1 = ? COLLATE NOCASE
          `);
          updateAlliancesStmt1.run(newName, nation.name);

          const updateAlliancesStmt2 = (dbManager as any).db.prepare(`
            UPDATE alliances 
            SET nation2 = ? 
            WHERE nation2 = ? COLLATE NOCASE
          `);
          updateAlliancesStmt2.run(newName, nation.name);

          // Update laws
          const updateLawsStmt = (dbManager as any).db.prepare(`
            UPDATE laws 
            SET nation_name = ? 
            WHERE nation_name = ? COLLATE NOCASE
          `);
          updateLawsStmt.run(newName, nation.name);

          // Record the rename
          const recordRenameStmt = (dbManager as any).db.prepare(`
            INSERT INTO nation_renames (old_name, new_name, renamed_by, is_admin_rename)
            VALUES (?, ?, ?, TRUE)
          `);
          recordRenameStmt.run(nation.name, newName, interaction.user.id);
        });

        // Log admin action
        dbManager.logAdminAction(
          interaction.user.id,
          'SET_PREFIX',
          actionDescription
        );

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Nation Prefix Updated (Admin)')
          .setDescription(actionDescription)
          .addFields(
            { name: '📝 Previous Name', value: nation.name, inline: true },
            { name: '📝 New Name', value: newName, inline: true },
            { name: '👑 Updated By', value: 'Admin (No Cooldown)', inline: true }
          )
          .setFooter({ text: `Updated by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        logger.info(`Admin ${interaction.user.tag} updated nation prefix from "${nation.name}" to "${newName}"`);
      } else {
        await interaction.reply({
          content: '❌ No changes were made to the nation name.',
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error) {
      logger.error('Error setting nation prefix:', { error: error as Error });

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while setting the prefix. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }

  /**
   * Extract the base name from a nation name by removing common prefixes
   */
  private extractBaseName(nationName: string): string {
    const prefixes = [
      'Republic of ',
      'Empire of ',
      'Kingdom of ',
      'Federation of ',
      'Commonwealth of ',
      'United States of ',
      'Principality of ',
      'Duchy of '
    ];

    for (const prefix of prefixes) {
      if (nationName.startsWith(prefix)) {
        return nationName.substring(prefix.length);
      }
    }

    return nationName;
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