import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class SetPrefixCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('set-prefix')
    .setDescription('Add a prefix to your nation name (e.g., Republic of, Empire of)')
    .addStringOption(option =>
      option.setName('prefix')
        .setDescription('Prefix to add to your nation name (type to search available options)')
        .setRequired(true)
        .setAutocomplete(true));

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const prefix = interaction.options.getString('prefix', true);

    // Validate prefix
    const allPrefixes = [
      'Republic of', 'Empire of', 'Kingdom of', 'Federation of', 'Commonwealth of',
      'United States of', 'Principality of', 'Duchy of', 'State of', 'Province of',
      'Territory of', 'Confederation of', 'Union of', 'Alliance of', 'League of',
      'Free State of', 'Democratic Republic of', 'Socialist Republic of', 
      'People\'s Republic of', 'Islamic Republic of', 'Sultanate of', 'Emirate of',
      'Grand Duchy of', 'Dominion of', 'Archduchy of', 'Margraviate of', 'Electorate of',
      'Palatinate of', 'County of', 'Barony of', 'Viscountcy of', 'Earldom of',
      'Marquisate of', 'Dukedom of', 'Viceroyalty of', 'Protectorate of', 'Mandate of',
      'Governorate of', 'Autonomous Region of', 'Crown Colony of', 'Associated State of',
      'City-State of', 'Sacred Kingdom of', 'Holy Empire of', 'Theocracy of',
      'Revolutionary Republic of', 'Military Junta of', 'Technocracy of', 'Meritocracy of',
      'Trade Federation of', 'Commercial Republic of', 'Corporate State of', 'Commune of',
      'Collective of', 'Cooperative of', 'Hegemony of', 'Suzerainty of', 'REMOVE'
    ];

    if (prefix !== 'REMOVE' && !allPrefixes.includes(prefix)) {
      await interaction.reply({
        content: '❌ Invalid prefix. Please select from the autocomplete options.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to set a prefix.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const currentNation = dbManager.getNationByName(userLink.nationName);
      if (!currentNation) {
        await interaction.reply({
          content: '❌ Your linked nation was not found in the database.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      let newName: string;
      let actionDescription: string;

      if (prefix === 'REMOVE') {
        // Remove prefix - extract the base name
        const baseName = this.extractBaseName(currentNation.name);
        newName = baseName;
        actionDescription = `Removed prefix from "${currentNation.name}" → "${newName}"`;
      } else {
        // Add prefix
        const baseName = this.extractBaseName(currentNation.name);
        newName = `${prefix} ${baseName}`;
        actionDescription = `Added prefix to "${currentNation.name}" → "${newName}"`;
      }

      // Check if the new name already exists
      if (newName !== currentNation.name) {
        const existingNation = dbManager.getNationByName(newName);
        if (existingNation) {
          await interaction.reply({
            content: `❌ A nation named "${newName}" already exists. Please choose a different prefix or contact an admin.`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      // Perform the rename if the name actually changed
      if (newName !== currentNation.name) {
        dbManager.transaction(() => {
          // Update nation name
          const updateNationStmt = (dbManager as any).db.prepare(`
            UPDATE nations 
            SET name = ?
            WHERE name = ? COLLATE NOCASE
          `);
          updateNationStmt.run(newName, currentNation.name);

          // Update user links
          const updateUserLinksStmt = (dbManager as any).db.prepare(`
            UPDATE user_links 
            SET nation_name = ? 
            WHERE nation_name = ? COLLATE NOCASE
          `);
          updateUserLinksStmt.run(newName, currentNation.name);

          // Update alliances
          const updateAlliancesStmt1 = (dbManager as any).db.prepare(`
            UPDATE alliances 
            SET nation1 = ? 
            WHERE nation1 = ? COLLATE NOCASE
          `);
          updateAlliancesStmt1.run(newName, currentNation.name);

          const updateAlliancesStmt2 = (dbManager as any).db.prepare(`
            UPDATE alliances 
            SET nation2 = ? 
            WHERE nation2 = ? COLLATE NOCASE
          `);
          updateAlliancesStmt2.run(newName, currentNation.name);

          // Update laws
          const updateLawsStmt = (dbManager as any).db.prepare(`
            UPDATE laws 
            SET nation_name = ? 
            WHERE nation_name = ? COLLATE NOCASE
          `);
          updateLawsStmt.run(newName, currentNation.name);

          // Record the rename
          const recordRenameStmt = (dbManager as any).db.prepare(`
            INSERT INTO nation_renames (old_name, new_name, renamed_by, is_admin_rename)
            VALUES (?, ?, ?, FALSE)
          `);
          recordRenameStmt.run(currentNation.name, newName, interaction.user.id);
        });

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Nation Prefix Updated')
          .setDescription(actionDescription)
          .addFields(
            { name: '📝 Previous Name', value: currentNation.name, inline: true },
            { name: '📝 New Name', value: newName, inline: true },
            { name: '⏰ No Cooldown', value: 'Prefix changes have no cooldown', inline: true }
          )
          .setFooter({ text: `Updated by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        logger.info(`User ${interaction.user.tag} updated nation prefix from "${currentNation.name}" to "${newName}"`);
      } else {
        await interaction.reply({
          content: '❌ No changes were made to your nation name.',
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error) {
      logger.error('Error setting nation prefix:', { error: error as Error });

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred while setting the prefix. Please try again.',
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
    
    // Comprehensive list of prefixes
    const allPrefixes = [
      'Republic of',
      'Empire of',
      'Kingdom of',
      'Federation of',
      'Commonwealth of',
      'United States of',
      'Principality of',
      'Duchy of',
      'State of',
      'Province of',
      'Territory of',
      'Confederation of',
      'Union of',
      'Alliance of',
      'League of',
      'Free State of',
      'Democratic Republic of',
      'Socialist Republic of',
      'People\'s Republic of',
      'Islamic Republic of',
      'Sultanate of',
      'Emirate of',
      'Grand Duchy of',
      'Dominion of',
      'Archduchy of',
      'Margraviate of',
      'Electorate of',
      'Palatinate of',
      'Landgraviate of',
      'Burgraviate of',
      'County of',
      'Barony of',
      'Viscountcy of',
      'Earldom of',
      'Marquisate of',
      'Dukedom of',
      'Viceroyalty of',
      'Protectorate of',
      'Mandate of',
      'Governorate of',
      'Autonomous Region of',
      'Special Administrative Region of',
      'Crown Colony of',
      'Overseas Territory of',
      'Associated State of',
      'Client State of',
      'Puppet State of',
      'Satellite State of',
      'Buffer State of',
      'City-State of',
      'Nation-State of',
      'Tribal Federation of',
      'Tribal Council of',
      'Chiefdom of',
      'Clan Territory of',
      'Sacred Kingdom of',
      'Holy Empire of',
      'Blessed Republic of',
      'Divine Monarchy of',
      'Theocracy of',
      'Papal State of',
      'Ecclesiastical State of',
      'Monastic Republic of',
      'Revolutionary Republic of',
      'Provisional Government of',
      'Transitional Authority of',
      'Military Junta of',
      'Occupied Territory of',
      'Liberated Zone of',
      'Autonomous Community of',
      'Federal District of',
      'Capital Territory of',
      'Metropolitan Area of',
      'Urban Agglomeration of',
      'Megalopolis of',
      'Conurbation of',
      'Economic Zone of',
      'Trade Federation of',
      'Commercial Republic of',
      'Merchant State of',
      'Banking Republic of',
      'Corporate State of',
      'Technocracy of',
      'Meritocracy of',
      'Plutocracy of',
      'Oligarchy of',
      'Aristocracy of',
      'Gerontocracy of',
      'Stratocracy of',
      'Kritarchy of',
      'Nomocracy of',
      'Timocracy of',
      'Kleptocracy of',
      'Kakistocracy of',
      'Mobocracy of',
      'Ochlocracy of',
      'Polyarchy of',
      'Synarchy of',
      'Anarchy of',
      'Commune of',
      'Collective of',
      'Cooperative of',
      'Syndicate of',
      'Consortium of',
      'Cartel of',
      'Monopoly of',
      'Hegemony of',
      'Suzerainty of',
      'Overlordship of',
      'Remove Prefix'
    ];

    try {
      const filtered = allPrefixes
        .filter(prefix => prefix.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(prefix => ({
          name: prefix,
          value: prefix === 'Remove Prefix' ? 'REMOVE' : prefix
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('Error in prefix autocomplete:', {
        command: 'set-prefix',
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

  /**
   * Extract the base name from a nation name by removing common prefixes
   */
  private extractBaseName(nationName: string): string {
    const prefixes = [
      'Republic of ',
      'Empire of ',
      'Kingdom of ',
      'Federation of ',
      'Commonwealth of ',
      'United States of ',
      'Principality of ',
      'Duchy of '
    ];

    for (const prefix of prefixes) {
      if (nationName.startsWith(prefix)) {
        return nationName.substring(prefix.length);
      }
    }

    return nationName;
  }
}