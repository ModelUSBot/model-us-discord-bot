import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';

export class AdminNationAddCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-nation-add')
    .setDescription('Add a new nation to the database')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the nation')
        .setRequired(true)
    )
    .addNumberOption(option =>
      option.setName('gdp')
        .setDescription('GDP in billions')
        .setRequired(true)
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option.setName('population')
        .setDescription('Population (e.g., 330000000)')
        .setRequired(true)
        .setMinValue(0)
    )
    .addNumberOption(option =>
      option.setName('stability')
        .setDescription('Stability percentage (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    )
    .addNumberOption(option =>
      option.setName('tax-rate')
        .setDescription('Tax rate percentage (default: 20)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100)
    )
    .addNumberOption(option =>
      option.setName('military-readiness')
        .setDescription('Military readiness level (0-10, default: 5)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(10)
    )
    .addStringOption(option =>
      option.setName('capital')
        .setDescription('Capital city name')
        .setRequired(false)
        .setMaxLength(50)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const name = interaction.options.getString('name', true);
    const gdp = interaction.options.getNumber('gdp', true);
    const population = interaction.options.getInteger('population', true);
    const stability = interaction.options.getNumber('stability', true);
    const taxRate = interaction.options.getNumber('tax-rate') ?? 20.0;
    const militaryReadiness = interaction.options.getNumber('military-readiness') ?? 5.0;
    const capital = interaction.options.getString('capital');

    try {
      // Check if nation already exists
      const existingNation = dbManager.getNationByName(name);
      if (existingNation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Already Exists')
          .setDescription(`A nation named "${name}" already exists in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      // Create the nation
      const nation = dbManager.createOrUpdateNation({
        name,
        gdp,
        population,
        stability,
        taxRate,
        capital: capital || ''
      });

      // Set military readiness if provided
      if (militaryReadiness !== 5.0) {
        dbManager.setMilitaryReadiness(name, militaryReadiness, interaction.user.id);
      }

      // Log admin action
      const actionDetails = `Added nation: ${name} (GDP: ${gdp}B, Population: ${population.toLocaleString()}, Stability: ${stability}%, Tax Rate: ${taxRate}%${militaryReadiness !== 5.0 ? `, Military Readiness: ${militaryReadiness}/10` : ''}${capital ? `, Capital: ${capital}` : ''})`;
      dbManager.logAdminAction(
        interaction.user.id,
        'NATION_ADD',
        actionDetails
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Nation Added Successfully')
        .addFields(
          { name: '🏛️ Nation', value: nation.name, inline: true },
          { name: '💰 GDP', value: formatGDP(nation.gdp), inline: true },
          { name: '👥 Population', value: nation.population.toLocaleString(), inline: true },
          { name: '📊 Stability', value: `${nation.stability.toFixed(1)}%`, inline: true },
          { name: '💸 Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
          { name: '🏦 Budget', value: formatGDP(nation.budget), inline: true },
          { name: '💵 GDP per Capita', value: `$${nation.gdpPerCapita.toFixed(2)}`, inline: true }
        )
        .setFooter({ text: `Added by ${interaction.user.tag}` })
        .setTimestamp();

      // Add military readiness if set
      if (militaryReadiness !== 5.0) {
        const readinessDescriptions = [
          '🕊️ Peaceful', '🟢 Minimal', '🟡 Low', '🟠 Moderate', '🔴 Elevated',
          '⚠️ High', '🚨 Critical', '💥 Maximum', '⚔️ War Footing', '🔥 Total War', '☢️ Nuclear Ready'
        ];
        const readinessDesc = readinessDescriptions[Math.floor(militaryReadiness)] || `Level ${militaryReadiness}`;
        embed.addFields({
          name: '🎖️ Military Readiness',
          value: `${militaryReadiness}/10 - ${readinessDesc}`,
          inline: true
        });
      }

      // Add capital if set
      if (capital) {
        embed.addFields({
          name: '🏛️ Capital',
          value: capital,
          inline: true
        });
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.tag} added nation: ${name}`);

    } catch (error) {
      logger.error('Error adding nation:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Adding Nation')
        .setDescription('An error occurred while adding the nation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }

}
