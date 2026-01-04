import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminNationRenameCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-nation-rename')
    .setDescription('Rename a nation (admin can rename without cooldown)')
    .addStringOption(option =>
      option.setName('current-name')
        .setDescription('Current name of the nation')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('new-name')
        .setDescription('New name for the nation')
        .setRequired(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const currentName = interaction.options.getString('current-name', true);
    const newName = interaction.options.getString('new-name', true);

    try {
      // Check if current nation exists
      const nation = dbManager.getNationByName(currentName);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`No nation named "${currentName}" was found in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if new name already exists
      const existingNation = dbManager.getNationByName(newName);
      if (existingNation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Name Already Taken')
          .setDescription(`A nation named "${newName}" already exists in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Perform the rename in a transaction
      dbManager.transaction(() => {
        // Update nation name and last_rename_at
        const updateNationStmt = (dbManager as any).db.prepare(`
          UPDATE nations 
          SET name = ?, last_rename_at = CURRENT_TIMESTAMP 
          WHERE name = ? COLLATE NOCASE
        `);
        updateNationStmt.run(newName, currentName);

        // Update user links
        const updateUserLinksStmt = (dbManager as any).db.prepare(`
          UPDATE user_links 
          SET nation_name = ? 
          WHERE nation_name = ? COLLATE NOCASE
        `);
        updateUserLinksStmt.run(newName, currentName);

        // Record the rename
        const recordRenameStmt = (dbManager as any).db.prepare(`
          INSERT INTO nation_renames (old_name, new_name, renamed_by, is_admin_rename)
          VALUES (?, ?, ?, TRUE)
        `);
        recordRenameStmt.run(currentName, newName, interaction.user.id);
      });

      // Log admin action
      dbManager.logAdminAction(
        interaction.user.id,
        'NATION_RENAME',
        `Renamed nation from "${currentName}" to "${newName}"`
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Nation Renamed Successfully')
        .addFields(
          { name: '📝 Old Name', value: currentName, inline: true },
          { name: '📝 New Name', value: newName, inline: true },
          { name: '👑 Renamed By', value: 'Admin (No Cooldown)', inline: true }
        )
        .setFooter({ text: `Renamed by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.tag} renamed nation from "${currentName}" to "${newName}"`);

    } catch (error) {
      logger.error('Error renaming nation:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Renaming Nation')
        .setDescription('An error occurred while renaming the nation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    // Only provide autocomplete for the current-name field
    if (focusedOption.name === 'current-name') {
      await safeAutocomplete(
        interaction,
        async () => dbManager.searchNationsForAutocomplete(focusedOption.value.toLowerCase(), 25),
        logger
      );
    } else {
      await interaction.respond([]);
    }
  }
}
