import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { TimeUtils } from '../../utils/TimeUtils';
import { formatGDP } from '../../utils/FormatUtils';

export class NationCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('nation')
    .setDescription('View nation statistics')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation name (optional - defaults to your linked nation)')
        .setRequired(false)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    let nationName = interaction.options.getString('nation');

    try {
      // If no nation specified, try to use user's linked nation
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

      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const allNations = dbManager.getAllNations();
        const suggestions = allNations
          .filter(n => n.name.toLowerCase().includes(nationName!.toLowerCase()))
          .slice(0, 5)
          .map(n => n.name)
          .join(', ');

        const suggestionText = suggestions ? `\n\nDid you mean: ${suggestions}?` : '';
        
        await interaction.reply({
          content: `❌ Nation "${nationName}" not found.${suggestionText}`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${nation.name} Statistics`)
        .addFields(
          { name: '💰 GDP', value: formatGDP(nation.gdp), inline: true },
          { name: '👥 Population', value: nation.population.toLocaleString(), inline: true },
          { name: '📈 Stability', value: `${nation.stability.toFixed(1)}%`, inline: true },
          { name: '💸 Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
          { name: '🏛️ Budget', value: formatGDP(nation.budget), inline: true },
          { name: '💵 GDP per Capita', value: `$${nation.gdpPerCapita.toFixed(2)}`, inline: true }
        )
        .setColor(0x0099ff)
        .setFooter({ text: `Last updated: ${TimeUtils.getRelativeTime(nation.updatedAt)}` })
        .setTimestamp();

      // Add leader information if nation is linked
      const userLink = dbManager.getUserByNation(nationName);
      if (userLink) {
        embed.addFields({
          name: '👑 Leader',
          value: `<@${userLink.discordId}>`,
          inline: true
        });
      }

      // Add flag if set (as image if it's a URL, otherwise as text)
      if (nation.flag) {
        if (nation.flag.startsWith('http')) {
          embed.setThumbnail(nation.flag);
          embed.addFields({
            name: '🏳️ Flag',
            value: 'See image above',
            inline: true
          });
        } else {
          embed.addFields({
            name: '🏳️ Flag',
            value: nation.flag,
            inline: true
          });
        }
      }

      // Add capital if set
      if (nation.capital) {
        embed.addFields({
          name: '🏛️ Capital',
          value: nation.capital,
          inline: true
        });
      }

      // Add description if set
      if (nation.description) {
        embed.addFields({
          name: '📖 Description',
          value: nation.description,
          inline: false
        });
      }

      // Add military readiness if set
      if (nation.militaryReadiness !== null && nation.militaryReadiness !== undefined) {
        const readinessDescriptions = [
          '🕊️ Peaceful',
          '🟢 Minimal',
          '🟡 Low',
          '🟠 Moderate',
          '🔴 Elevated',
          '⚠️ High',
          '🚨 Critical',
          '💥 Maximum',
          '⚔️ War Footing',
          '🔥 Total War',
          '☢️ DEFCON 1'
        ];
        
        const readinessDesc = readinessDescriptions[nation.militaryReadiness] || `Level ${nation.militaryReadiness}`;
        embed.addFields({
          name: '🎖️ Military Readiness',
          value: `${nation.militaryReadiness}/10 - ${readinessDesc}`,
          inline: true
        });
      }

      // Add change indicators if available
      if (nation.gdpChange !== null && nation.gdpChange !== undefined) {
        const changeIcon = nation.gdpChange >= 0 ? '📈' : '📉';
        const changeColor = nation.gdpChange >= 0 ? '+' : '';
        embed.addFields({
          name: `${changeIcon} GDP Change`,
          value: `${changeColor}${nation.gdpChange.toFixed(2)}%`,
          inline: true
        });
      }

      if (nation.populationChange !== null && nation.populationChange !== undefined) {
        const changeIcon = nation.populationChange >= 0 ? '📈' : '📉';
        const changeColor = nation.populationChange >= 0 ? '+' : '';
        embed.addFields({
          name: `${changeIcon} Population Change`,
          value: `${changeColor}${nation.populationChange.toFixed(2)}%`,
          inline: true
        });
      }

      // Check for active wars involving this nation
      const activeWarsStmt = (dbManager as any).db.prepare(`
        SELECT name, participants, start_date, casualties
        FROM wars 
        WHERE status = 'active' AND participants LIKE ?
      `);
      const activeWars = activeWarsStmt.all(`%${nationName}%`);

      if (activeWars.length > 0) {
        const warList = activeWars.map((war: any) => {
          const participants = war.participants.split(',').map((p: string) => p.trim());
          const otherParticipants = participants.filter((p: string) => p !== nationName);
          const startDate = new Date(war.start_date);
          const timeAgo = TimeUtils.getRelativeTime(startDate);
          return `**${war.name}** vs ${otherParticipants.join(', ')}\n└ Started ${timeAgo}, ${war.casualties.toLocaleString()} casualties`;
        }).join('\n\n');

        embed.addFields({
          name: '⚔️ Active Wars',
          value: warList,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error retrieving nation statistics:', {
        command: 'nation',
        user: interaction.user.id,
        error: error as Error,
        metadata: { nationName }
      });
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while retrieving nation statistics. Please try again.',
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
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    try {
      const nations = dbManager.getAllNations();
      
      const filtered = nations
        .filter(nation => nation.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(nation => ({
          name: nation.name,
          value: nation.name
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('Error in autocomplete:', {
        command: 'nation',
        user: interaction.user.id,
        error: error as Error
      });
      
      try {
        await interaction.respond([]);
      } catch (respondError) {
        // Ignore respond errors in autocomplete
      }
    }
  }
}