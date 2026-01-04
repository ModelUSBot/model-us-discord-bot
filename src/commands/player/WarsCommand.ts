import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class WarsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('wars')
    .setDescription('View war records')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filter by war status')
        .setRequired(false)
        .addChoices(
          { name: 'All Wars', value: 'all' },
          { name: 'Active Wars', value: 'active' },
          { name: 'Ended Wars', value: 'ended' }
        )
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of wars to show (default: 10)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const statusFilter = interaction.options.getString('status') ?? 'all';
    const limit = interaction.options.getInteger('limit') ?? 10;

    try {
      let wars = dbManager.getAllWars();

      // Filter by status if specified
      if (statusFilter !== 'all') {
        wars = wars.filter(war => war.status === statusFilter);
      }

      if (wars.length === 0) {
        const message = statusFilter === 'all' 
          ? 'No war records found in the database.'
          : `No ${statusFilter} wars found.`;
        
        await interaction.reply({
          content: `❌ ${message}`
        });
        return;
      }

      // Limit results
      const limitedWars = wars.slice(0, limit);

      const embed = new EmbedBuilder()
        .setTitle('⚔️ War Records')
        .setColor(0xff4500)
        .setTimestamp();

      // Add war information
      const warList = limitedWars.map(war => {
        const statusIcon = war.status === 'active' ? '🔴' : '⚫';
        const endInfo = war.endDate ? war.endDate.toDateString() : 'Ongoing';
        const casualtyInfo = war.casualties > 0 ? ` (${war.casualties.toLocaleString()} casualties)` : '';
        
        return `${statusIcon} **${war.name}**\n` +
               `└ ${war.startDate.toDateString()} - ${endInfo}${casualtyInfo}\n` +
               `└ Participants: ${war.participants.join(', ')}`;
      }).join('\n\n');

      embed.setDescription(warList);

      // Add summary statistics
      const activeWars = wars.filter(w => w.status === 'active').length;
      const endedWars = wars.filter(w => w.status === 'ended').length;
      const totalCasualties = wars.reduce((sum, war) => sum + war.casualties, 0);

      embed.addFields({
        name: '📊 Summary',
        value: `**Active Wars:** ${activeWars}\n**Ended Wars:** ${endedWars}\n**Total Casualties:** ${totalCasualties.toLocaleString()}`,
        inline: false
      });

      if (wars.length > limit) {
        embed.setFooter({ text: `Showing ${limit} of ${wars.length} wars` });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error retrieving war records:', { error: error as Error });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while retrieving war records. Please try again.',
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
    await interaction.respond([]);
  }
}