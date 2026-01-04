import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminAllianceAddCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-alliance-add')
    .setDescription('Create an alliance between two nations (admin override)')
    .addStringOption(option =>
      option.setName('nation1')
        .setDescription('First nation in the alliance')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('nation2')
        .setDescription('Second nation in the alliance')
        .setRequired(true)
        .setAutocomplete(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nation1 = interaction.options.getString('nation1', true);
    const nation2 = interaction.options.getString('nation2', true);

    try {
      // Check if both nations exist
      const nation1Data = dbManager.getNationByName(nation1);
      const nation2Data = dbManager.getNationByName(nation2);

      if (!nation1Data) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${nation1}" was not found in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (!nation2Data) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${nation2}" was not found in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if nations are the same
      if (nation1.toLowerCase() === nation2.toLowerCase()) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid Alliance')
          .setDescription('A nation cannot form an alliance with itself.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if alliance already exists (in either direction)
      const existingAllianceStmt = (dbManager as any).db.prepare(`
        SELECT * FROM alliances 
        WHERE (nation1 = ? AND nation2 = ?) OR (nation1 = ? AND nation2 = ?)
        AND status = 'active'
      `);
      const existingAlliance = existingAllianceStmt.get(nation1, nation2, nation2, nation1);

      if (existingAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Already Exists')
          .setDescription(`An active alliance already exists between "${nation1}" and "${nation2}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create the alliance
      const createAllianceStmt = (dbManager as any).db.prepare(`
        INSERT INTO alliances (nation1, nation2, status, requested_by, approved_at, created_by)
        VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP, ?)
      `);
      createAllianceStmt.run(nation1, nation2, interaction.user.id, interaction.user.id);

      // Log admin action
      dbManager.logAdminAction(
        interaction.user.id,
        'ALLIANCE_ADD',
        `Created alliance between "${nation1}" and "${nation2}"`
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Alliance Created Successfully')
        .setDescription(`An alliance has been formed between **${nation1}** and **${nation2}**.`)
        .addFields(
          { name: '🤝 Alliance Partners', value: `${nation1} ↔️ ${nation2}`, inline: false },
          { name: '👑 Created By', value: `Admin Override`, inline: true },
          { name: '📅 Status', value: 'Active', inline: true }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.tag} created alliance between "${nation1}" and "${nation2}"`);

    } catch (error) {
      logger.error('Error creating alliance:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Alliance')
        .setDescription('An error occurred while creating the alliance. Please try again.')
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
      async () => dbManager.searchNationsForAutocomplete(focusedValue, 25),
      logger
    );
  }
}
