import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class ListLawsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('list-laws')
    .setDescription('List laws (only public ones if not yours)')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Name of nation whose laws you want to list (leave empty for all)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Search by tag')
        .setRequired(false)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation');
    const tagName = interaction.options.getString('tag');

    try {
      // Check if user is admin
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);

      // Search for laws
      const searchOptions: any = {};
      
      if (nationName) searchOptions.nationName = nationName;
      if (tagName) searchOptions.tagName = tagName;
      
      // Only set requestingUser if not admin (admins see all laws)
      if (!isAdmin) {
        searchOptions.requestingUser = interaction.user.id;
      }
      
      const laws = dbManager.searchLaws(searchOptions);

      if (laws.length === 0) {
        let message = '📜 No laws found';
        if (nationName) message += ` for nation "${nationName}"`;
        if (tagName) message += ` with tag "${tagName}"`;
        message += '.';

        await interaction.reply({ content: message });
        return;
      }

      // Group laws by nation for better organization
      const lawsByNation = laws.reduce((acc, law) => {
        if (!acc[law.nationName]) {
          acc[law.nationName] = [];
        }
        acc[law.nationName]!.push(law);
        return acc;
      }, {} as Record<string, typeof laws>);

      const embed = new EmbedBuilder()
        .setTitle('📜 Laws')
        .setColor(0x3498db)
        .setTimestamp();

      let description = '';
      if (nationName) description += `**Nation:** ${nationName}\n`;
      if (tagName) description += `**Tag:** ${tagName}\n`;
      if (description) embed.setDescription(description);

      // Add fields for each nation
      for (const [nation, nationLaws] of Object.entries(lawsByNation)) {
        const lawList = (nationLaws as any[])
          .slice(0, 10) // Limit to prevent embed size issues
          .map((law: any) => {
            const visibility = law.isPublic ? '🌐' : '🔒';
            const tags = law.tags.length > 0 ? ` [${law.tags.map((t: any) => t.name).join(', ')}]` : '';
            return `${visibility} **${law.name}**${tags}`;
          })
          .join('\n');

        const fieldName = `🏛️ ${nation} (${(nationLaws as any[]).length} law${(nationLaws as any[]).length !== 1 ? 's' : ''})`;
        embed.addFields({ 
          name: fieldName, 
          value: lawList || 'No laws', 
          inline: false 
        });

        if ((nationLaws as any[]).length > 10) {
          embed.addFields({
            name: '📋 Note',
            value: `Showing first 10 of ${(nationLaws as any[]).length} laws. Use filters to narrow results.`,
            inline: false
          });
        }
      }

      // Add legend
      const legendText = isAdmin 
        ? '🌐 Public law • 🔒 Private law • 👑 Admin view (all laws visible)'
        : '🌐 Public law • 🔒 Private law (yours only)';
        
      embed.addFields({
        name: '📖 Legend',
        value: legendText,
        inline: false
      });

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} listed laws (nation: ${nationName || 'all'}, tag: ${tagName || 'none'})`);

    } catch (error) {
      logger.error('Error listing laws:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while listing laws. Please try again.'
      });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'nation') {
        // Autocomplete nation names
        const filtered = dbManager.searchNationsForAutocomplete(focusedOption.value, 25);
        await interaction.respond(filtered);
      } else if (focusedOption.name === 'tag') {
        // Autocomplete tag names
        const { tags } = dbManager.getAllTags(25, 1);
        
        const filtered = tags
          .filter(tag => tag.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .slice(0, 25)
          .map(tag => ({
            name: `${tag.name} - ${tag.description}`,
            value: tag.name
          }));

        await interaction.respond(filtered);
      }
    } catch (error) {
      logger.error('Error in autocomplete:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}