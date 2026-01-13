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

      // Add national debt (always show, defaults to 0) - HIGH PRIORITY
      const nationalDebt = nation.nationalDebt || 0;
      embed.addFields({
        name: '💳 National Debt',
        value: `${nationalDebt.toFixed(2)}B`,
        inline: true
      });

      // Add leadership information if nation has linked users
      const allUsers = dbManager.getAllUsersByNation(nationName);
      if (allUsers.length > 0) {
        const president = allUsers.find(user => user.role === 'president');
        const vicePresident = allUsers.find(user => user.role === 'vice_president');
        
        if (president) {
          embed.addFields({
            name: '👑 President',
            value: `<@${president.discordId}>`,
            inline: true
          });
        }
        
        if (vicePresident) {
          embed.addFields({
            name: '🤝 Vice President',
            value: `<@${vicePresident.discordId}>`,
            inline: true
          });
        }
      }

      // Add flag if set (as image if it's a URL, otherwise as text)
      if (nation.flag) {
        if (nation.flag.startsWith('http://') || nation.flag.startsWith('https://')) {
          try {
            embed.setThumbnail(nation.flag);
            embed.addFields({
              name: '🏳️ Flag',
              value: '[View Flag Image](' + nation.flag + ')',
              inline: true
            });
          } catch (flagError) {
            // If setting thumbnail fails, just show as text
            embed.addFields({
              name: '🏳️ Flag',
              value: nation.flag,
              inline: true
            });
          }
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

      // Add government type if set
      if (nation.governmentType) {
        embed.addFields({
          name: '🏛️ Government',
          value: nation.governmentType,
          inline: true
        });
      }

      // Add provincial capitals if set
      if (nation.provincialCapitals && nation.provincialCapitals.length > 0) {
        embed.addFields({
          name: '🏙️ Provincial Capitals',
          value: nation.provincialCapitals.join(', '),
          inline: true
        });
      }

      // Add national debt (always show, defaults to 0) - REMOVED FROM HERE

      // Add description if set
      if (nation.description) {
        embed.addFields({
          name: '📖 Description',
          value: nation.description,
          inline: false
        });
      }

      // Add individual military stats if they exist
      if (nation.groundStrength !== null && nation.groundStrength !== undefined) {
        embed.addFields(
          { name: '🪖 Ground Forces', value: `${nation.groundStrength}/10`, inline: true },
          { name: '⚓ Naval Forces', value: `${nation.navalStrength || 0}/10`, inline: true },
          { name: '✈️ Air Forces', value: `${nation.airStrength || 0}/10`, inline: true }
        );
      }

      // Add leadership information from nation object (if available)
      if (nation.leader && !allUsers.find(user => user.role === 'president')) {
        embed.addFields({
          name: '🏛️ Leader',
          value: nation.leader,
          inline: true
        });
      }
      
      if (nation.vicePresident && !allUsers.find(user => user.role === 'vice_president')) {
        embed.addFields({
          name: '🤝 Vice President', 
          value: nation.vicePresident,
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
      try {
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
      } catch (warError) {
        logger.warn('Error loading wars:', { error: warError as Error });
      }

      // Check for multi-nation alliance membership
      const multiAlliances = dbManager.getNationMultiAlliances(nationName);
      if (multiAlliances.length > 0) {
        const allianceList = multiAlliances.map(alliance => {
          const members = dbManager.getMultiAllianceMembers(alliance.id);
          const leaderName = alliance.leader_nation || alliance.leaderNation;
          const isLeader = leaderName === nationName;
          return `**${alliance.name}** (${members.length} member${members.length === 1 ? '' : 's'})${isLeader ? ' - 👑 Leader' : ''}`;
        }).join('\n');
        
        embed.addFields({
          name: `🤝 Multi-Nation Alliance${multiAlliances.length > 1 ? 's' : ''}`,
          value: allianceList,
          inline: false
        });
      }

      // Show loans and investments
      const loans = dbManager.getLoansByNation(nationName);
      const activeLoans = loans.filter((loan: any) => loan.status === 'active');
      if (activeLoans.length > 0) {
        const totalLent = activeLoans
          .filter((loan: any) => loan.lender_nation === nationName)
          .reduce((sum: number, loan: any) => sum + loan.remaining_balance, 0);
        
        const totalBorrowed = activeLoans
          .filter((loan: any) => loan.borrower_nation === nationName)
          .reduce((sum: number, loan: any) => sum + loan.remaining_balance, 0);

        if (totalLent > 0 || totalBorrowed > 0) {
          let loanText = '';
          if (totalLent > 0) loanText += `Lent: $${totalLent.toFixed(2)}B\n`;
          if (totalBorrowed > 0) loanText += `Borrowed: $${totalBorrowed.toFixed(2)}B`;
          
          embed.addFields({
            name: '💰 Active Loans',
            value: loanText.trim(),
            inline: true
          });
        }
      }

      const investments = dbManager.getInvestmentsByNation(nationName);
      const activeInvestments = investments.filter((inv: any) => inv.status === 'active');
      if (activeInvestments.length > 0) {
        const totalInvested = activeInvestments
          .filter((inv: any) => inv.investor_nation === nationName)
          .reduce((sum: number, inv: any) => sum + inv.current_value, 0);
        
        const totalReceived = activeInvestments
          .filter((inv: any) => inv.target_nation === nationName)
          .reduce((sum: number, inv: any) => sum + inv.current_value, 0);

        if (totalInvested > 0 || totalReceived > 0) {
          let investText = '';
          if (totalInvested > 0) investText += `Invested: $${totalInvested.toFixed(2)}B\n`;
          if (totalReceived > 0) investText += `Received: $${totalReceived.toFixed(2)}B`;
          
          embed.addFields({
            name: '📈 Active Investments',
            value: investText.trim(),
            inline: true
          });
        }
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