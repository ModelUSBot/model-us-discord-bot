import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AdminUnlinkUserCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-unlink-user')
    .setDescription('Unlink a Discord user from their nation (Admin only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Discord user to unlink')
        .setRequired(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const user = interaction.options.getUser('user', true);

    try {
      const currentUserLink = dbManager.getUserLink(user.id);
      
      if (!currentUserLink) {
        await interaction.reply({
          content: `❌ User ${user} is not currently linked to any nation.`
        });
        return;
      }

      // Remove the user link
      const deleteStmt = (dbManager as any).db.prepare(`
        DELETE FROM user_links WHERE discord_id = ?
      `);
      deleteStmt.run(user.id);

      // Log admin action
      dbManager.logAdminAction(
        interaction.user.id,
        'UNLINK_USER',
        `Unlinked user ${user.tag} from nation "${currentUserLink.nationName}"`
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ User Unlinked Successfully')
        .setDescription(`${user} has been unlinked from **${currentUserLink.nationName}**`)
        .addFields(
          { name: '👤 Discord User', value: `${user.tag} (${user.id})`, inline: true },
          { name: '🏛️ Previous Nation', value: currentUserLink.nationName, inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error unlinking user from nation:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while unlinking the user. Please try again.'
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