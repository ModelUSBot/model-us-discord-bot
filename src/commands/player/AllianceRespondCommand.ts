import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AllianceRespondCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('alliance-respond')
    .setDescription('Respond to an alliance request sent to your nation')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation that sent the alliance request')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('response')
        .setDescription('Accept or decline the alliance request')
        .setRequired(true)
        .addChoices(
          { name: 'Accept', value: 'accept' },
          { name: 'Decline', value: 'decline' }
        )
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const requestingNation = interaction.options.getString('nation', true);
    const response = interaction.options.getString('response', true) as 'accept' | 'decline';

    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Linked Nation')
          .setDescription('You must have a linked nation to respond to alliance requests. Ask an admin to link your nation first.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const myNation = userLink.nationName;

      // Find the pending alliance request
      const findRequestStmt = (dbManager as any).db.prepare(`
        SELECT * FROM alliances 
        WHERE nation1 = ? AND nation2 = ? AND status = 'pending'
      `);
      const allianceRequest = findRequestStmt.get(requestingNation, myNation);

      if (!allianceRequest) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Request Not Found')
          .setDescription(`No pending alliance request from "${requestingNation}" to "${myNation}" was found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Update the alliance status
      const newStatus = response === 'accept' ? 'active' : 'declined';
      const updateStmt = (dbManager as any).db.prepare(`
        UPDATE alliances 
        SET status = ?, approved_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      updateStmt.run(newStatus, allianceRequest.id);

      // Create response embed
      const isAccepted = response === 'accept';
      const embed = new EmbedBuilder()
        .setColor(isAccepted ? 0x00ff00 : 0xff0000)
        .setTitle(isAccepted ? '✅ Alliance Request Accepted' : '❌ Alliance Request Declined')
        .setDescription(
          isAccepted 
            ? `You have accepted the alliance request from **${requestingNation}**. Your nations are now allied!`
            : `You have declined the alliance request from **${requestingNation}**.`
        )
        .addFields(
          { name: '🤝 Requesting Nation', value: requestingNation, inline: true },
          { name: '🏛️ Your Nation', value: myNation, inline: true },
          { name: '📅 Status', value: isAccepted ? 'Active Alliance' : 'Declined', inline: true }
        )
        .setFooter({ text: `Responded by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Send admin notification
      try {
        const adminChannelId = '1457229969481531463';
        const adminRoleId = '1456867369111519335';
        const adminChannel = await interaction.client.channels.fetch(adminChannelId);
        
        if (adminChannel && adminChannel.isTextBased() && 'send' in adminChannel) {
          const guildName = interaction.guild?.name || 'Unknown Server';
          const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
          const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
          
          const adminEmbed = new EmbedBuilder()
            .setColor(isAccepted ? 0x00ff00 : 0xff0000)
            .setTitle(isAccepted ? '✅ Alliance Request Accepted' : '❌ Alliance Request Declined')
            .setDescription(`An alliance request has been ${response}ed.`)
            .addFields(
              { name: '🏛️ Requesting Nation', value: requestingNation, inline: true },
              { name: '🏛️ Responding Nation', value: myNation, inline: true },
              { name: '👤 Responded By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '👤 Original Requester', value: `<@${allianceRequest.requested_by}>`, inline: true },
              { name: '📅 Final Status', value: isAccepted ? 'Active Alliance' : 'Declined', inline: true },
              { name: '🌍 Server', value: guildName, inline: true },
              { name: '📍 Channel', value: channelName, inline: true },
              { name: '⏰ Time (EST)', value: timestamp, inline: true },
              { name: '🆔 Responder ID', value: interaction.user.id, inline: true },
              { name: '🆔 Requester ID', value: allianceRequest.requested_by, inline: true },
              { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
              { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true }
            )
            .setFooter({ 
              text: isAccepted 
                ? 'Alliance is now active - both parties have been notified' 
                : 'Alliance request declined - requester has been notified' 
            })
            .setTimestamp();

          await adminChannel.send({ 
            content: `<@&${adminRoleId}> Alliance request ${response}ed!`,
            embeds: [adminEmbed] 
          });
        }
      } catch (error) {
        logger.warn('Failed to send admin notification for alliance response:', { error: error as Error });
      }

      // Notify the requesting user
      try {
        const requestingUser = await interaction.client.users.fetch(allianceRequest.requested_by);
        const notificationEmbed = new EmbedBuilder()
          .setColor(isAccepted ? 0x00ff00 : 0xff0000)
          .setTitle(isAccepted ? '🎉 Alliance Request Accepted!' : '💔 Alliance Request Declined')
          .setDescription(
            isAccepted
              ? `**${myNation}** has accepted your alliance request! Your nations are now allied.`
              : `**${myNation}** has declined your alliance request.`
          )
          .addFields(
            { name: '🏛️ Your Nation', value: requestingNation, inline: true },
            { name: '🏛️ Their Nation', value: myNation, inline: true },
            { name: '👤 Responded By', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        await requestingUser.send({ embeds: [notificationEmbed] });
      } catch (error) {
        logger.warn(`Could not send DM notification to requesting user ${allianceRequest.requested_by}:`, { error: error as Error });
      }

      logger.info(`User ${interaction.user.tag} (${myNation}) ${response}ed alliance request from ${requestingNation}`);

    } catch (error) {
      logger.error('Error responding to alliance request:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Responding to Alliance Request')
        .setDescription('An error occurred while responding to the alliance request. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    try {
      const focusedValue = interaction.options.getFocused();
      
      // Get user's nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.respond([]);
        return;
      }

      // Get nations that sent requests to this user's nation
      if (focusedValue.length === 0) {
        const stmt = (dbManager as any).db.prepare(`
          SELECT nation1 as name FROM alliances 
          WHERE nation2 = ? AND status = 'pending'
          ORDER BY nation1
          LIMIT 10
        `);
        const rows = stmt.all(userLink.nationName) as any[];
        const results = rows.map(row => ({ name: row.name, value: row.name }));
        await interaction.respond(results);
        return;
      }

      const stmt = (dbManager as any).db.prepare(`
        SELECT nation1 as name FROM alliances 
        WHERE nation2 = ? AND status = 'pending'
        AND nation1 LIKE ? COLLATE NOCASE
        ORDER BY nation1
        LIMIT 10
      `);
      
      const searchPattern = `%${focusedValue}%`;
      const rows = stmt.all(userLink.nationName, searchPattern) as any[];
      const results = rows.map(row => ({ name: row.name, value: row.name }));
      
      await interaction.respond(results);
    } catch (error) {
      logger.error('AllianceRespond autocomplete error:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}
