import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AllianceRequestCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('alliance-request')
    .setDescription('Send an alliance request to another nation')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation you want to form an alliance with')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const targetNation = interaction.options.getString('nation', true);

    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Linked Nation')
          .setDescription('You must have a linked nation to send alliance requests. Ask an admin to link your nation first.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const myNation = userLink.nationName;

      // Check if target nation exists
      const targetNationData = dbManager.getNationByName(targetNation);
      if (!targetNationData) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${targetNation}" was not found in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if trying to ally with self
      if (myNation.toLowerCase() === targetNation.toLowerCase()) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid Alliance Request')
          .setDescription('You cannot form an alliance with your own nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if alliance already exists or is pending
      const existingAllianceStmt = (dbManager as any).db.prepare(`
        SELECT * FROM alliances 
        WHERE ((nation1 = ? AND nation2 = ?) OR (nation1 = ? AND nation2 = ?))
        AND status IN ('active', 'pending')
      `);
      const existingAlliance = existingAllianceStmt.get(myNation, targetNation, targetNation, myNation);

      if (existingAlliance) {
        let statusText = existingAlliance.status === 'active' ? 'active alliance' : 'pending alliance request';
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Already Exists')
          .setDescription(`There is already an ${statusText} between "${myNation}" and "${targetNation}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create the alliance request
      const createRequestStmt = (dbManager as any).db.prepare(`
        INSERT INTO alliances (nation1, nation2, status, requested_by)
        VALUES (?, ?, 'pending', ?)
      `);
      createRequestStmt.run(myNation, targetNation, interaction.user.id);

      // Try to notify the target nation's player
      const targetUserLink = dbManager.getUserByNation(targetNation);
      let notificationText = '';
      if (targetUserLink) {
        notificationText = `\n\n<@${targetUserLink.discordId}> has been notified of your alliance request.`;
      } else {
        notificationText = `\n\nThe target nation is not linked to a Discord user. An admin will need to approve this request.`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Alliance Request Sent')
        .setDescription(`Your alliance request has been sent to **${targetNation}**.${notificationText}`)
        .addFields(
          { name: '🤝 Requesting Nation', value: myNation, inline: true },
          { name: '🎯 Target Nation', value: targetNation, inline: true },
          { name: '📅 Status', value: 'Pending Approval', inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Send notification to target user if they exist
      if (targetUserLink) {
        try {
          const targetUser = await interaction.client.users.fetch(targetUserLink.discordId);
          const notificationEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🤝 Alliance Request Received')
            .setDescription(`**${myNation}** has sent you an alliance request!`)
            .addFields(
              { name: '🏛️ From Nation', value: myNation, inline: true },
              { name: '🏛️ To Nation', value: targetNation, inline: true },
              { name: '👤 Requested By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .addFields(
              { name: '📋 How to Respond', value: 'Use `/alliance-respond` to accept or decline this request.', inline: false }
            )
            .setTimestamp();

          await targetUser.send({ embeds: [notificationEmbed] });
        } catch (error) {
          logger.warn(`Could not send DM notification to user ${targetUserLink.discordId}:`, { error: error as Error });
        }
      }

      logger.info(`User ${interaction.user.tag} (${myNation}) sent alliance request to ${targetNation}`);

    } catch (error) {
      logger.error('Error sending alliance request:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Sending Alliance Request')
        .setDescription('An error occurred while sending the alliance request. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
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
      async () => {
        // Get user's nation to exclude it from results
        const userLink = dbManager.getUserLink(interaction.user.id);
        if (!userLink) {
          return [];
        }

        // Get nations excluding user's own nation
        const results = dbManager.searchNationsForAutocomplete(focusedValue, 25);
        return results.filter(nation => 
          nation.value.toLowerCase() !== userLink.nationName.toLowerCase()
        );
      },
      logger
    );
  }
}
