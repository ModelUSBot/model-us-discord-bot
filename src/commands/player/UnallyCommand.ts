import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { handleCommandError, safeReply, checkCooldown, handleAutocomplete } from '../../utils/CommandUtils';

export class UnallyCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('unally')
    .setDescription('Break an alliance with another nation')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation to break alliance with')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Check cooldown
    if (!(await checkCooldown(interaction, 5000))) {
      return;
    }

    const targetNationName = interaction.options.getString('nation', true);

    try {
      // Get user's nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Linked Nation')
          .setDescription('You are not linked to any nation. Please contact an admin to link your account.')
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Check if target nation exists
      const targetNation = dbManager.getNationByName(targetNationName);
      if (!targetNation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${targetNationName}" not found.`)
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Check if trying to unally with self
      if (userLink.nationName.toLowerCase() === targetNationName.toLowerCase()) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid Target')
          .setDescription('You cannot break an alliance with yourself.')
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Check if alliance exists
      const checkAllianceStmt = (dbManager as any).db.prepare(`
        SELECT * FROM alliances 
        WHERE ((nation1 = ? AND nation2 = ?) OR (nation1 = ? AND nation2 = ?))
        AND status = 'active'
      `);
      const existingAlliance = checkAllianceStmt.get(
        userLink.nationName, targetNationName,
        targetNationName, userLink.nationName
      );

      if (!existingAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Alliance Found')
          .setDescription(`No active alliance exists between **${userLink.nationName}** and **${targetNationName}**.`)
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Break the alliance
      const breakAllianceStmt = (dbManager as any).db.prepare(`
        UPDATE alliances 
        SET status = 'broken'
        WHERE id = ?
      `);
      breakAllianceStmt.run(existingAlliance.id);

      // Calculate alliance duration
      const createdDate = new Date(existingAlliance.approved_at || existingAlliance.created_at);
      const now = new Date();
      const durationMs = now.getTime() - createdDate.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      const embed = new EmbedBuilder()
        .setTitle('💔 Alliance Broken')
        .setDescription(`The alliance between **${userLink.nationName}** and **${targetNationName}** has been dissolved.`)
        .addFields(
          { name: '🏛️ Your Nation', value: userLink.nationName, inline: true },
          { name: '🤝 Former Ally', value: targetNationName, inline: true },
          { name: '📅 Alliance Duration', value: `${durationDays} day${durationDays === 1 ? '' : 's'}`, inline: true }
        )
        .setColor(0xff6b6b)
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });

      logger.info(`Alliance broken: ${userLink.nationName} and ${targetNationName}`, {
        user: interaction.user.id,
        metadata: {
          userNation: userLink.nationName,
          targetNation: targetNationName,
          allianceId: existingAlliance.id
        }
      });

    } catch (error) {
      await handleCommandError(interaction, error as Error, logger, 'unally');
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
      // Get user's nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        return [];
      }

      // Get current allies
      const getAlliesStmt = (dbManager as any).db.prepare(`
        SELECT 
          CASE 
            WHEN nation1 = ? THEN nation2 
            ELSE nation1 
          END as ally_name
        FROM alliances 
        WHERE (nation1 = ? OR nation2 = ?) AND status = 'active'
        ORDER BY ally_name
        LIMIT 25
      `);
      
      const allies = getAlliesStmt.all(
        userLink.nationName, userLink.nationName, userLink.nationName
      ) as any[];
      
      // Filter by search term
      const filteredAllies = allies.filter((ally: any) => 
        ally.ally_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      return filteredAllies.map((ally: any) => ({
        name: ally.ally_name,
        value: ally.ally_name
      }));
    });
  }
}