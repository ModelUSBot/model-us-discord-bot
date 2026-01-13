import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatDatabaseTimestamp } from '../../utils/FormatUtils';
import { handleCommandError, safeReply, checkCooldown } from '../../utils/CommandUtils';

export class AlliancesCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('alliances')
    .setDescription('View alliance information')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of alliances to view')
        .setRequired(false)
        .addChoices(
          { name: 'All Active Alliances', value: 'all' },
          { name: 'My Nation\'s Alliances', value: 'mine' },
          { name: 'Pending Requests', value: 'pending' },
          { name: 'Multi-Nation Alliances', value: 'multi' }
        )
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Check cooldown
    if (!(await checkCooldown(interaction, 3000))) {
      return;
    }

    const type = interaction.options.getString('type') || 'all';

    try {
      let embed: EmbedBuilder;

      if (type === 'mine') {
        // Show user's nation alliances
        const userLink = dbManager.getUserLink(interaction.user.id);
        if (!userLink) {
          embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ No Linked Nation')
            .setDescription('You must have a linked nation to view your alliances. Ask an admin to link your nation first.')
            .setTimestamp();

          await safeReply(interaction, { embeds: [embed] }, true);
          return;
        }

        const myNation = userLink.nationName;
        let myAlliances;
        try {
          const myAlliancesStmt = (dbManager as any).db.prepare(`
            SELECT 
              n1.name as nation1_proper,
              n2.name as nation2_proper,
              a.status, a.requested_at, a.approved_at 
            FROM alliances a
            JOIN nations n1 ON a.nation1 = n1.name COLLATE NOCASE
            JOIN nations n2 ON a.nation2 = n2.name COLLATE NOCASE
            WHERE (a.nation1 = ? OR a.nation2 = ?) AND a.status = 'active'
            ORDER BY a.approved_at DESC
          `);
          myAlliances = myAlliancesStmt.all(myNation, myNation);
          logger.info(`Successfully fetched ${myAlliances.length} alliances for ${myNation}`);
        } catch (dbError) {
          logger.error('Database error fetching nation alliances:', { 
            error: dbError as Error, 
            metadata: { nation: myNation }
          });
          throw new Error(`Database error: ${(dbError as Error).message}`);
        }

        embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`🤝 ${myNation}'s Alliances`)
          .setTimestamp();

        if (myAlliances.length === 0) {
          embed.setDescription('Your nation has no active alliances.');
        } else {
          // Limit to prevent embed description from being too long
          const displayAlliances = myAlliances.slice(0, 20);
          const allianceList = displayAlliances.map((alliance: any, index: number) => {
            const partner = alliance.nation1_proper.toLowerCase() === myNation.toLowerCase() ? alliance.nation2_proper : alliance.nation1_proper;
            const approvedTimestamp = formatDatabaseTimestamp(alliance.approved_at);
            return `${index + 1}. **${partner}** - ${approvedTimestamp}`;
          }).join('\n');

          let description = `**Active Alliances (${myAlliances.length}):**\n${allianceList}`;
          
          if (myAlliances.length > 20) {
            description += `\n\n*... and ${myAlliances.length - 20} more alliances*`;
          }

          // Ensure description doesn't exceed Discord's limit
          if (description.length > 4000) {
            description = description.substring(0, 3900) + '\n\n*... (truncated)*';
          }

          embed.setDescription(description);
        }

      } else if (type === 'pending') {
        // Show pending alliance requests
        let pendingAlliances;
        try {
          const pendingStmt = (dbManager as any).db.prepare(`
            SELECT 
              n1.name as nation1_proper,
              n2.name as nation2_proper,
              a.requested_by, a.requested_at 
            FROM alliances a
            JOIN nations n1 ON a.nation1 = n1.name COLLATE NOCASE
            JOIN nations n2 ON a.nation2 = n2.name COLLATE NOCASE
            WHERE a.status = 'pending'
            ORDER BY a.requested_at DESC
          `);
          pendingAlliances = pendingStmt.all();
          logger.info(`Successfully fetched ${pendingAlliances.length} pending alliances`);
        } catch (dbError) {
          logger.error('Database error fetching pending alliances:', { error: dbError as Error });
          throw new Error(`Database error: ${(dbError as Error).message}`);
        }

        embed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('⏳ Pending Alliance Requests')
          .setTimestamp();

        if (pendingAlliances.length === 0) {
          embed.setDescription('There are no pending alliance requests.');
        } else {
          // Limit to prevent embed description from being too long
          const displayPending = pendingAlliances.slice(0, 15);
          const pendingList = displayPending.map((alliance: any, index: number) => {
            const requestedTimestamp = formatDatabaseTimestamp(alliance.requested_at);
            return `${index + 1}. **${alliance.nation1_proper}** → **${alliance.nation2_proper}** - ${requestedTimestamp}`;
          }).join('\n');

          let description = `**Pending Requests (${pendingAlliances.length}):**\n${pendingList}`;
          
          if (pendingAlliances.length > 15) {
            description += `\n\n*... and ${pendingAlliances.length - 15} more requests*`;
          }

          // Ensure description doesn't exceed Discord's limit
          if (description.length > 4000) {
            description = description.substring(0, 3900) + '\n\n*... (truncated)*';
          }

          embed.setDescription(description);
        }

      } else if (type === 'multi') {
        // Show multi-nation alliances
        let multiAlliances;
        try {
          multiAlliances = dbManager.getAllMultiAlliances();
          logger.info(`Successfully fetched ${multiAlliances.length} multi-alliances`);
        } catch (dbError) {
          logger.error('Database error fetching multi-alliances:', { error: dbError as Error });
          throw new Error(`Database error: ${(dbError as Error).message}`);
        }

        embed = new EmbedBuilder()
          .setColor(0x9932cc)
          .setTitle('🤝 Multi-Nation Alliances')
          .setTimestamp();

        if (multiAlliances.length === 0) {
          embed.setDescription('No multi-nation alliances exist yet.');
        } else {
          // Limit to prevent embed description from being too long
          const displayMulti = multiAlliances.slice(0, 15);
          const allianceList = displayMulti.map((alliance: any, index: number) => {
            const memberCount = alliance.memberCount || 0;
            const leaderName = alliance.leader_nation || alliance.leaderNation || 'Unknown';
            return `${index + 1}. **${alliance.name}** - ${memberCount} member${memberCount === 1 ? '' : 's'} (Leader: ${leaderName})`;
          }).join('\n');

          let description = `**Active Multi-Alliances (${multiAlliances.length}):**\n${allianceList}`;
          
          if (multiAlliances.length > 15) {
            description += `\n\n*... and ${multiAlliances.length - 15} more alliances*`;
          }

          // Ensure description doesn't exceed Discord's limit
          if (description.length > 4000) {
            description = description.substring(0, 3900) + '\n\n*... (truncated)*';
          }

          embed.setDescription(description);
        }

      } else {
        // Show all active alliances
        let allAlliances;
        try {
          const allAlliancesStmt = (dbManager as any).db.prepare(`
            SELECT 
              n1.name as nation1_proper,
              n2.name as nation2_proper,
              a.approved_at 
            FROM alliances a
            JOIN nations n1 ON a.nation1 = n1.name COLLATE NOCASE
            JOIN nations n2 ON a.nation2 = n2.name COLLATE NOCASE
            WHERE a.status = 'active'
            ORDER BY a.approved_at DESC
          `);
          allAlliances = allAlliancesStmt.all();
          logger.info(`Successfully fetched ${allAlliances.length} active alliances`);
        } catch (dbError) {
          logger.error('Database error fetching all alliances:', { error: dbError as Error });
          throw new Error(`Database error: ${(dbError as Error).message}`);
        }

        embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🌍 All Active Alliances')
          .setTimestamp();

        if (allAlliances.length === 0) {
          embed.setDescription('There are no active alliances.');
        } else {
          // Limit to prevent embed description from being too long
          const displayAlliances = allAlliances.slice(0, 15);
          const allianceList = displayAlliances.map((alliance: any, index: number) => {
            const approvedTimestamp = formatDatabaseTimestamp(alliance.approved_at);
            return `${index + 1}. **${alliance.nation1_proper}** ↔️ **${alliance.nation2_proper}** - ${approvedTimestamp}`;
          }).join('\n');

          let description = `**Active Alliances (${allAlliances.length}):**\n${allianceList}`;
          
          if (allAlliances.length > 15) {
            description += `\n\n*... and ${allAlliances.length - 15} more alliances*`;
          }

          // Ensure description doesn't exceed Discord's limit
          if (description.length > 4000) {
            description = description.substring(0, 3900) + '\n\n*... (truncated)*';
          }

          embed.setDescription(description);
        }
      }

      await safeReply(interaction, { embeds: [embed] });

    } catch (error) {
      await handleCommandError(interaction, error as Error, logger, 'alliances');
    }
  }
}
