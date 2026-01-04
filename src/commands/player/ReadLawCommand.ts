import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class ReadLawCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('read-law')
    .setDescription('Read your own or someone else\'s law')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the law to read')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Name of the nation that made the law (leave empty for your nation)')
        .setRequired(false)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const lawName = interaction.options.getString('name', true);
    let nationName = interaction.options.getString('nation');

    try {
      // If no nation specified, use the user's linked nation
      if (!nationName) {
        const userLink = dbManager.getUserLink(interaction.user.id);
        if (!userLink) {
          await interaction.reply({
            content: '❌ You must specify a nation name or have your Discord account linked to a nation.'
          });
          return;
        }
        nationName = userLink.nationName;
      }

      // Get the law
      const law = dbManager.getLawByName(lawName, nationName);
      if (!law) {
        await interaction.reply({
          content: `❌ Law "${lawName}" not found for nation "${nationName}".`
        });
        return;
      }

      // Check if user can view this law
      const userLink = dbManager.getUserLink(interaction.user.id);
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);
      
      const canView = law.isPublic || 
                     (userLink && userLink.nationName.toLowerCase() === law.nationName.toLowerCase()) ||
                     law.createdBy === interaction.user.id ||
                     isAdmin;

      if (!canView) {
        await interaction.reply({
          content: `❌ Law "${lawName}" is private and you don't have permission to view it.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Get law with tags
      const lawWithTags = dbManager.getLawWithTags(law.id);
      if (!lawWithTags) {
        await interaction.reply({
          content: '❌ Error retrieving law details.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📜 ${lawWithTags.name}`)
        .setDescription(lawWithTags.bodyText)
        .addFields(
          { name: '🏛️ Nation', value: lawWithTags.nationName, inline: true },
          { name: '👁️ Visibility', value: lawWithTags.isPublic ? 'Public' : 'Private', inline: true },
          { name: '📅 Created', value: lawWithTags.createdAt.toLocaleDateString(), inline: true }
        )
        .setColor(lawWithTags.isPublic ? 0x3498db : 0x95a5a6)
        .setTimestamp();

      if (lawWithTags.tags.length > 0) {
        embed.addFields({ 
          name: '🏷️ Tags', 
          value: lawWithTags.tags.map((tag: any) => tag.name).join(', '), 
          inline: false 
        });
      }

      await interaction.reply({ 
        embeds: [embed]
      });

      logger.info(`User ${interaction.user.id} read law "${lawName}" from nation ${nationName}`);

    } catch (error) {
      logger.error('Error reading law:', { error: error as Error });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while reading the law. Please try again.',
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
        // Autocomplete law names
        const nationName = interaction.options.getString('nation');
        let searchNation = nationName;

        // If no nation specified, use user's linked nation
        if (!searchNation) {
          const userLink = dbManager.getUserLink(interaction.user.id);
          if (userLink) {
            searchNation = userLink.nationName;
          }
        }

        if (searchNation) {
          // For autocomplete, we can't easily check admin status, so we'll use the regular user-based search
          // Admins will still see all laws when they actually execute the command
          const laws = dbManager.searchLaws({ 
            nationName: searchNation,
            requestingUser: interaction.user.id
          });
          
          const filtered = laws
            .filter(law => law.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
            .slice(0, 25)
            .map(law => ({
              name: `${law.name} (${law.isPublic ? 'Public' : 'Private'})`,
              value: law.name
            }));

          await interaction.respond(filtered);
        } else {
          await interaction.respond([]);
        }
      } else if (focusedOption.name === 'nation') {
        // Autocomplete nation names
        const filtered = dbManager.searchNationsForAutocomplete(focusedOption.value, 25);
        await interaction.respond(filtered);
      }
    } catch (error) {
      logger.error('Error in autocomplete:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}