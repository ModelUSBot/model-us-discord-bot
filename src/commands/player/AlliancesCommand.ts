import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { getProperNationName } from '../../utils/FormatUtils';

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
          { name: 'Pending Requests', value: 'pending' }
        )
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
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

          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        const myNation = userLink.nationName;
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
        const myAlliances = myAlliancesStmt.all(myNation, myNation);

        embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`🤝 ${myNation}'s Alliances`)
          .setTimestamp();

        if (myAlliances.length === 0) {
          embed.setDescription('Your nation has no active alliances.');
        } else {
          const allianceList = myAlliances.map((alliance: any) => {
            const partner = alliance.nation1_proper.toLowerCase() === myNation.toLowerCase() ? alliance.nation2_proper : alliance.nation1_proper;
            const approvedDate = new Date(alliance.approved_at);
            return `• **${partner}** - <t:${Math.floor(approvedDate.getTime() / 1000)}:R>`;
          }).join('\n');

          embed.setDescription(`**Active Alliances (${myAlliances.length}):**\n${allianceList}`);
        }

      } else if (type === 'pending') {
        // Show pending alliance requests
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
        const pendingAlliances = pendingStmt.all();

        embed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('⏳ Pending Alliance Requests')
          .setTimestamp();

        if (pendingAlliances.length === 0) {
          embed.setDescription('There are no pending alliance requests.');
        } else {
          const pendingList = pendingAlliances.map((alliance: any) => {
            const requestedDate = new Date(alliance.requested_at);
            return `• **${alliance.nation1_proper}** → **${alliance.nation2_proper}** - <t:${Math.floor(requestedDate.getTime() / 1000)}:R>`;
          }).join('\n');

          embed.setDescription(`**Pending Requests (${pendingAlliances.length}):**\n${pendingList}`);
        }

      } else {
        // Show all active alliances
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
        const allAlliances = allAlliancesStmt.all();

        embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🌍 All Active Alliances')
          .setTimestamp();

        if (allAlliances.length === 0) {
          embed.setDescription('There are no active alliances.');
        } else {
          const allianceList = allAlliances.map((alliance: any) => {
            const approvedDate = new Date(alliance.approved_at);
            return `• **${alliance.nation1_proper}** ↔️ **${alliance.nation2_proper}** - <t:${Math.floor(approvedDate.getTime() / 1000)}:R>`;
          }).join('\n');

          embed.setDescription(`**Active Alliances (${allAlliances.length}):**\n${allianceList}`);
        }
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error fetching alliance information:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Fetching Alliances')
        .setDescription('An error occurred while fetching alliance information. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
