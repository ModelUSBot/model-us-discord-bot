import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminLinkUserCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-link-user')
    .setDescription('Link a Discord user to a nation (Admin only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Discord user to link')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation name to link the user to')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const user = interaction.options.getUser('user', true);
    const nationName = interaction.options.getString('nation', true);

    try {
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        await interaction.reply({
          content: `❌ Nation "${nationName}" not found. Please check the spelling or create the nation first.`
        });
        return;
      }

      const existingLink = dbManager.getUserByNation(nationName);
      if (existingLink && existingLink.discordId !== user.id) {
        await interaction.reply({
          content: `❌ Nation "${nationName}" is already linked to another user (<@${existingLink.discordId}>).`
        });
        return;
      }

      const currentUserLink = dbManager.getUserLink(user.id);
      dbManager.createOrUpdateUserLink(user.id, nationName);

      const actionDetails = currentUserLink 
        ? `Relinked user ${user.tag} from "${currentUserLink.nationName}" to "${nationName}"`
        : `Linked user ${user.tag} to "${nationName}"`;

      dbManager.logAdminAction(interaction.user.id, 'LINK_USER', actionDetails);

      const embed = new EmbedBuilder()
        .setTitle('✅ User Linked Successfully')
        .setDescription(`${user} has been linked to **${nation.name}**`)
        .addFields(
          { name: '👤 Discord User', value: `${user.tag} (${user.id})`, inline: true },
          { name: '🏛️ Nation', value: nation.name, inline: true },
          { name: '📊 Nation Stats', value: `GDP: ${formatGDP(nation.gdp)}\nPopulation: ${nation.population.toLocaleString()}`, inline: true }
        )
        .setColor(0x00ff00)
        .setTimestamp();

      if (currentUserLink) {
        embed.addFields({
          name: '🔄 Previous Link',
          value: `Was previously linked to "${currentUserLink.nationName}"`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error linking user to nation:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while linking the user. Please try again.'
      });
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
      async () => dbManager.searchNationsForAutocomplete(focusedValue, 25),
      logger
    );
  }
}