import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

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
    const targetNationName = interaction.options.getString('nation', true);

    try {
      // Get user's nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You are not linked to any nation. Please contact an admin to link your account.'
        });
        return;
      }

      // Check if target nation exists
      const targetNation = dbManager.getNationByName(targetNationName);
      if (!targetNation) {
        await interaction.reply({
          content: `❌ Nation "${targetNationName}" not found.`
        });
        return;
      }

      // Check if alliance exists
      const checkAllianceStmt = (dbManager as any).db.prepare(`
        SELECT * FROM alliances 
        WHERE (nation1 = ? AND nation2 = ?) OR (nation1 = ? AND nation2 = ?)
        AND status = 'active'
      `);
      const existingAlliance = checkAllianceStmt.get(
        userLink.nationName, targetNationName,
        targetNationName, userLink.nationName
      );

      if (!existingAlliance) {
        await interaction.reply({
          content: `❌ No active alliance exists between ${userLink.nationName} and ${targetNationName}.`
        });
        return;
      }

      // Break the alliance
      const breakAllianceStmt = (dbManager as any).db.prepare(`
        UPDATE alliances 
        SET status = 'broken'
        WHERE id = ?
      `);
      breakAllianceStmt.run(existingAlliance.id);

      const embed = new EmbedBuilder()
        .setTitle('💔 Alliance Broken')
        .setDescription(`The alliance between **${userLink.nationName}** and **${targetNationName}** has been dissolved.`)
        .addFields(
          { name: '🏛️ Your Nation', value: userLink.nationName, inline: true },
          { name: '🤝 Former Ally', value: targetNationName, inline: true },
          { name: '📅 Alliance Duration', value: `Since ${new Date(existingAlliance.created_at).toLocaleDateString()}`, inline: true }
        )
        .setColor(0xff6b6b)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`${interaction.user.tag} (${userLink.nationName}) broke alliance with ${targetNationName}`);

    } catch (error) {
      logger.error('Error breaking alliance:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while breaking the alliance. Please try again.'
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
      async () => {
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
          AND (
            CASE 
              WHEN nation1 = ? THEN nation2 
              ELSE nation1 
            END
          ) LIKE ? COLLATE NOCASE
          ORDER BY ally_name
          LIMIT 25
        `);
        
        const searchPattern = `%${focusedValue}%`;
        const allies = getAlliesStmt.all(
          userLink.nationName, userLink.nationName, userLink.nationName, 
          userLink.nationName, searchPattern
        ) as any[];
        
        return allies.map((ally: any) => ({
          name: ally.ally_name,
          value: ally.ally_name
        }));
      },
      logger
    );
  }
}