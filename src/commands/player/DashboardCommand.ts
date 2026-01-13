import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';
import { TimeUtils } from '../../utils/TimeUtils';

export class DashboardCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View a comprehensive overview of your nation and the world');

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 Model US Dashboard')
        .setTimestamp();

      // Get world statistics (USA-focused)
      const allNations = dbManager.getAllNations();
      const usaNations = allNations; // All nations are US states/territories
      const totalGDP = usaNations.reduce((sum, nation) => sum + nation.gdp, 0);
      const totalPopulation = usaNations.reduce((sum, nation) => sum + nation.population, 0);
      const avgStability = usaNations.reduce((sum, nation) => sum + nation.stability, 0) / usaNations.length;
      const avgTaxRate = usaNations.reduce((sum, nation) => sum + nation.taxRate, 0) / usaNations.length;

      // Get top nations
      const topGDPNations = dbManager.getNationsByRanking('gdp', 3);
      const topPopNations = dbManager.getNationsByRanking('population', 3);

      // World overview
      embed.addFields(
        { name: '\u200B', value: '**🇺🇸 United States Overview**', inline: false },
        { name: '🏛️ Total States/Territories', value: usaNations.length.toString(), inline: true },
        { name: '💰 Total US GDP', value: formatGDP(totalGDP), inline: true },
        { name: '👥 Total US Population', value: totalPopulation.toLocaleString(), inline: true },
        { name: '📈 Avg Stability', value: `${avgStability.toFixed(1)}%`, inline: true },
        { name: '💸 Avg Tax Rate', value: `${avgTaxRate.toFixed(1)}%`, inline: true },
        { name: '💵 US GDP per Capita', value: `$${((totalGDP * 1000000000) / totalPopulation).toFixed(2)}`, inline: true }
      );

      // Top nations
      const topGDPList = topGDPNations.map((nation, index) => 
        `${index + 1}. **${nation.name}** - ${formatGDP(nation.gdp)}`
      ).join('\n');

      const topPopList = topPopNations.map((nation, index) => 
        `${index + 1}. **${nation.name}** - ${nation.population.toLocaleString()}`
      ).join('\n');

      embed.addFields(
        { name: '\u200B', value: '**🏆 Top US States/Territories**', inline: false },
        { name: '💰 Largest Economies', value: topGDPList, inline: true },
        { name: '👥 Most Populous', value: topPopList, inline: true }
      );

      // Active wars
      const activeWars = dbManager.getActiveWars();
      if (activeWars.length > 0) {
        const warsList = activeWars.slice(0, 3).map(war => {
          const participants = Array.isArray(war.participants) ? war.participants : JSON.parse(war.participants);
          const startDate = new Date(war.startDate);
          return `**${war.name}**\n└ ${participants.join(' vs ')}\n└ ${TimeUtils.getRelativeTime(startDate)}, ${war.casualties.toLocaleString()} casualties`;
        }).join('\n\n');

        embed.addFields({
          name: `⚔️ Active Wars (${activeWars.length})`,
          value: warsList,
          inline: false
        });
      }

      // Multi-alliances
      const allMultiAlliances = dbManager.getAllMultiAlliances();
      if (allMultiAlliances.length > 0) {
        const alliancesList = allMultiAlliances.slice(0, 3).map(alliance => 
          `**${alliance.name}** - ${alliance.memberCount} member${alliance.memberCount === 1 ? '' : 's'}`
        ).join('\n');

        embed.addFields({
          name: `🤝 Multi-Nation Alliances (${allMultiAlliances.length})`,
          value: alliancesList + (allMultiAlliances.length > 3 ? `\n... and ${allMultiAlliances.length - 3} more` : ''),
          inline: false
        });
      }

      // User's nation information (if linked)
      if (userLink) {
        const userNation = dbManager.getNationByName(userLink.nationName);
        if (userNation) {
          // Calculate rankings
          const gdpRanking = dbManager.getNationsByRanking('gdp', 1000);
          const popRanking = dbManager.getNationsByRanking('population', 1000);
          const stabilityRanking = dbManager.getNationsByRanking('stability', 1000);

          const gdpRank = gdpRanking.findIndex(n => n.name === userNation.name) + 1;
          const popRank = popRanking.findIndex(n => n.name === userNation.name) + 1;
          const stabilityRank = stabilityRanking.findIndex(n => n.name === userNation.name) + 1;

          embed.addFields(
            { name: '\u200B', value: `**🏛️ Your Nation - ${userNation.name}**`, inline: false },
            { name: '💰 GDP', value: `${formatGDP(userNation.gdp)} (#${gdpRank})`, inline: true },
            { name: '👥 Population', value: `${userNation.population.toLocaleString()} (#${popRank})`, inline: true },
            { name: '📈 Stability', value: `${userNation.stability.toFixed(1)}% (#${stabilityRank})`, inline: true },
            { name: '💸 Tax Rate', value: `${userNation.taxRate.toFixed(1)}%`, inline: true },
            { name: '🏛️ Budget', value: formatGDP(userNation.budget), inline: true },
            { name: '💵 GDP per Capita', value: `$${userNation.gdpPerCapita.toFixed(2)}`, inline: true }
          );

          // User's multi-alliances
          const userAlliances = dbManager.getNationMultiAlliances(userNation.name);
          if (userAlliances.length > 0) {
            const userAlliancesList = userAlliances.map(alliance => {
              const members = dbManager.getMultiAllianceMembers(alliance.id);
              const leaderName = alliance.leader_nation || alliance.leaderNation;
              const isLeader = leaderName === userNation.name;
              return `**${alliance.name}** (${members.length} member${members.length === 1 ? '' : 's'})${isLeader ? ' - 👑 Leader' : ''}`;
            }).join('\n');

            embed.addFields({
              name: `🤝 Your Alliance${userAlliances.length > 1 ? 's' : ''}`,
              value: userAlliancesList,
              inline: false
            });
          }

          // User's loans
          const userLoans = dbManager.getLoansByNation(userNation.name);
          if (userLoans.length > 0) {
            const activeLoans = userLoans.filter((loan: any) => loan.status === 'active');
            if (activeLoans.length > 0) {
              const totalLent = activeLoans
                .filter((loan: any) => loan.lender_nation === userNation.name)
                .reduce((sum: number, loan: any) => sum + loan.remaining_balance, 0);
              
              const totalBorrowed = activeLoans
                .filter((loan: any) => loan.borrower_nation === userNation.name)
                .reduce((sum: number, loan: any) => sum + loan.remaining_balance, 0);

              if (totalLent > 0 || totalBorrowed > 0) {
                embed.addFields({
                  name: '💰 Active Loans',
                  value: `Lent: $${totalLent.toFixed(2)}B\nBorrowed: $${totalBorrowed.toFixed(2)}B`,
                  inline: true
                });
              }
            }
          }

          // Recent changes
          if (userNation.gdpChange !== null && userNation.gdpChange !== undefined) {
            const changeIcon = userNation.gdpChange >= 0 ? '📈' : '📉';
            const changeColor = userNation.gdpChange >= 0 ? '+' : '';
            embed.addFields({
              name: `${changeIcon} Recent GDP Change`,
              value: `${changeColor}${userNation.gdpChange.toFixed(2)}%`,
              inline: true
            });
          }
        }
      } else {
        embed.addFields({
          name: '🔗 Link Your Nation',
          value: 'Use `/admin-link-user` (admin) to link your Discord account to a nation for personalized dashboard information.',
          inline: false
        });
      }

      // Recent activity summary
      const recentBackups = (dbManager as any).db.prepare(`
        SELECT COUNT(*) as count FROM backup_records 
        WHERE created_at > datetime('now', '-7 days')
      `).get();

      const recentAdminActions = (dbManager as any).db.prepare(`
        SELECT COUNT(*) as count FROM admin_actions 
        WHERE timestamp > datetime('now', '-7 days')
      `).get();

      embed.addFields({
        name: '📊 Recent Activity (7 days)',
        value: `Backups: ${recentBackups.count}\nAdmin Actions: ${recentAdminActions.count}`,
        inline: true
      });

      embed.setFooter({ text: 'Dashboard updates in real-time • Use /nation for detailed nation info' });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error generating dashboard:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Loading Dashboard')
        .setDescription('An error occurred while loading the dashboard. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}