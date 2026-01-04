import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class NationRenameCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('nation-rename')
    .setDescription('Rename your linked nation (24 hour cooldown)')
    .addStringOption(option =>
      option.setName('new-name')
        .setDescription('New name for your nation')
        .setRequired(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const newName = interaction.options.getString('new-name', true);

    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Linked Nation')
          .setDescription('You must have a linked nation to use this command. Ask an admin to link your nation first.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const currentName = userLink.nationName;

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

      // Check if user is admin (admins bypass cooldown)
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);

      // Check cooldown (24 hours) - unless admin
      if (!isAdmin) {
        const nation = dbManager.getNationByName(currentName);
        if (nation?.updatedAt) {
          const lastRenameStmt = (dbManager as any).db.prepare(`
            SELECT last_rename_at FROM nations WHERE name = ? COLLATE NOCASE
          `);
          const result = lastRenameStmt.get(currentName);
          
          if (result?.last_rename_at) {
            const lastRename = new Date(result.last_rename_at);
            const now = new Date();
            const hoursSinceRename = (now.getTime() - lastRename.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceRename < 24) {
              const hoursRemaining = Math.ceil(24 - hoursSinceRename);
              const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Rename Cooldown Active')
                .setDescription(`You can only rename your nation once every 24 hours. Please wait ${hoursRemaining} more hour(s).`)
                .addFields(
                  { name: '⏰ Last Rename', value: `<t:${Math.floor(lastRename.getTime() / 1000)}:R>`, inline: true },
                  { name: '⏳ Next Available', value: `<t:${Math.floor((lastRename.getTime() + 24 * 60 * 60 * 1000) / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

              await interaction.reply({ embeds: [embed], ephemeral: true });
              return;
            }
          }
        }
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
          VALUES (?, ?, ?, ?)
        `);
        recordRenameStmt.run(currentName, newName, interaction.user.id, isAdmin ? 1 : 0);
      });

      const embed = new EmbedBuilder()
        .setColor(isAdmin ? 0xff9500 : 0x00ff00)
        .setTitle(`✅ Nation Renamed Successfully${isAdmin ? ' (Admin Override)' : ''}`)
        .setDescription(`Your nation has been renamed from **${currentName}** to **${newName}**.`)
        .addFields(
          { name: '📝 Old Name', value: currentName, inline: true },
          { name: '📝 New Name', value: newName, inline: true },
          { name: '⏰ Next Rename Available', value: isAdmin ? 'No cooldown (Admin)' : '<t:' + Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000) + ':R>', inline: true }
        )
        .setFooter({ text: `Renamed by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.tag} renamed their nation from "${currentName}" to "${newName}"`);

    } catch (error) {
      logger.error('Error renaming nation:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Renaming Nation')
        .setDescription('An error occurred while renaming your nation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
