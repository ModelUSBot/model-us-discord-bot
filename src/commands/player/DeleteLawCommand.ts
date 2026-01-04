import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class DeleteLawCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('delete-law')
    .setDescription('Delete one of your laws')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the law to delete')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const lawName = interaction.options.getString('name', true);

    try {
      // Get user's linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to delete laws.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Get the law
      const law = dbManager.getLawByName(lawName, userLink.nationName);
      if (!law) {
        await interaction.reply({
          content: `❌ Law "${lawName}" not found for your nation "${userLink.nationName}".`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Check if user can delete this law (must be the creator or admin)
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);
      
      const canDelete = law.createdBy === interaction.user.id || isAdmin;

      if (!canDelete) {
        await interaction.reply({
          content: `❌ You can only delete laws that you created. This law was created by someone else.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Delete the law
      const success = dbManager.deleteLaw(law.id, interaction.user.id);
      
      if (success) {
        await interaction.reply({
          content: `✅ Successfully deleted law "${lawName}" from nation "${userLink.nationName}".`
        });

        logger.info(`User ${interaction.user.id} deleted law "${lawName}" from nation ${userLink.nationName}`);
      } else {
        await interaction.reply({
          content: '❌ Failed to delete the law. Please try again.',
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error) {
      logger.error('Error deleting law:', { error: error as Error });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while deleting the law. Please try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error response:', { error: replyError as Error });
      }
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'name') {
        // Get user's linked nation
        const userLink = dbManager.getUserLink(interaction.user.id);
        if (!userLink) {
          await interaction.respond([]);
          return;
        }

        // Get laws created by this user in their nation
        const laws = dbManager.searchLaws({ 
          nationName: userLink.nationName,
          requestingUser: interaction.user.id
        });
        
        // Filter to only laws created by this user
        const userLaws = laws.filter(law => law.createdBy === interaction.user.id);
        
        const filtered = userLaws
          .filter(law => law.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .slice(0, 25)
          .map(law => ({
            name: `${law.name} (${law.isPublic ? 'Public' : 'Private'})`,
            value: law.name
          }));

        await interaction.respond(filtered);
      }
    } catch (error) {
      logger.error('Error in autocomplete:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}