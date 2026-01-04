import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP, calculatePercentageChange, formatPercentageChange } from '../../utils/FormatUtils';
import { safeAutocomplete } from '../../utils/AutocompleteUtils';

export class AdminNationEditCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-nation-edit')
    .setDescription('Edit nation statistics (Admin only)')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Name of the nation to edit')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('stat')
        .setDescription('Which statistic to modify')
        .setRequired(true)
        .addChoices(
          { name: 'GDP (billions)', value: 'gdp' },
          { name: 'Stability (0-100%)', value: 'stability' },
          { name: 'Population', value: 'population' },
          { name: 'Tax Rate (0-100%)', value: 'tax_rate' },
          { name: 'Military Readiness (0-10)', value: 'military_readiness' },
          { name: 'Capital City', value: 'capital' }
        )
    )
    .addNumberOption(option =>
      option.setName('value')
        .setDescription('Numeric value to set/add/subtract (for GDP, Stability, Population, Tax Rate, Military Readiness)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('text_value')
        .setDescription('Text value to set (for Capital City)')
        .setRequired(false)
        .setMaxLength(50)
    )
    .addBooleanOption(option =>
      option.setName('set_absolute')
        .setDescription('Set to absolute value instead of adding/subtracting')
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction, 
    dbManager: DatabaseManager, 
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const stat = interaction.options.getString('stat', true) as 'gdp' | 'stability' | 'population' | 'tax_rate' | 'military_readiness' | 'capital';
    const value = interaction.options.getNumber('value');
    const textValue = interaction.options.getString('text_value');
    const setAbsolute = interaction.options.getBoolean('set_absolute') ?? false;

    // Validate that appropriate value type is provided
    if (stat === 'capital') {
      if (!textValue) {
        await interaction.reply({
          content: '❌ Please provide a text_value for the capital city.'
        });
        return;
      }
    } else {
      if (value === null) {
        await interaction.reply({
          content: '❌ Please provide a numeric value for this statistic.'
        });
        return;
      }
    }

    try {
      // Get existing nation data
      const existingNation = dbManager.getNationByName(nationName);
      
      if (!existingNation) {
        await interaction.reply({
          content: `❌ Nation "${nationName}" not found. Please create the nation first using /admin-nation-add.`
        });
        return;
      }

      // Handle capital city (string value)
      if (stat === 'capital') {
        const success = dbManager.setNationCapital(nationName, textValue!, interaction.user.id);
        if (!success) {
          await interaction.reply({
            content: `❌ Failed to update capital for "${nationName}".`
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`🏛️ Nation Capital Updated`)
          .setDescription(`Successfully set capital for **${nationName}**`)
          .addFields(
            { name: '🏛️ New Capital', value: textValue!, inline: true },
            { name: '👤 Set By', value: 'System Administrator', inline: true }
          )
          .setColor(0x3498db)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      // Calculate new value based on operation (for numeric stats)
      let newValue: number;
      let operation: string;
      const currentValue = (() => {
        switch (stat) {
          case 'tax_rate': return existingNation.taxRate;
          case 'military_readiness': return existingNation.militaryReadiness || 5.0;
          default: return existingNation[stat] as number;
        }
      })();

      if (setAbsolute) {
        newValue = value!;
        operation = 'set';
      } else {
        newValue = currentValue + value!;
        operation = value! >= 0 ? 'add' : 'subtract';
      }

      // Validate ranges
      if (stat === 'stability' || stat === 'tax_rate') {
        if (newValue < 0 || newValue > 100) {
          await interaction.reply({
            content: `❌ ${stat === 'stability' ? 'Stability' : 'Tax Rate'} must be between 0 and 100. Calculated value: ${newValue.toFixed(2)}`
          });
          return;
        }
      } else if (stat === 'military_readiness') {
        if (newValue < 0 || newValue > 10) {
          await interaction.reply({
            content: `❌ Military Readiness must be between 0 and 10. Calculated value: ${newValue.toFixed(2)}`
          });
          return;
        }
      } else if (newValue < 0) {
        await interaction.reply({
          content: `❌ ${stat.toUpperCase()} cannot be negative. Calculated value: ${newValue.toFixed(2)}`
        });
        return;
      }

      // Update the nation statistics
      if (stat === 'military_readiness') {
        // Use dedicated method for military readiness
        const success = dbManager.setMilitaryReadiness(nationName, newValue, interaction.user.id);
        if (!success) {
          await interaction.reply({
            content: `❌ Failed to update military readiness for "${nationName}".`
          });
          return;
        }
        // Get updated nation data
        const nation = dbManager.getNationByName(nationName)!;
      } else {
        // Update the nation's stat directly (no conversion needed since we store in billions now)
        let storageValue = newValue;

        // Update the nation statistics
        const updatedStats = {
          name: nationName,
          gdp: stat === 'gdp' ? storageValue : existingNation.gdp,
          stability: stat === 'stability' ? newValue : existingNation.stability,
          population: stat === 'population' ? Math.floor(newValue) : existingNation.population,
          taxRate: stat === 'tax_rate' ? newValue : existingNation.taxRate,
        };

        dbManager.createOrUpdateNation(updatedStats);
      }

      // Get the updated nation for display
      const nation = dbManager.getNationByName(nationName)!;

      // Calculate percentage change
      const percentageChange = calculatePercentageChange(currentValue, newValue);

      // Log the admin action (only if not military readiness, as setMilitaryReadiness logs automatically)
      if (stat !== 'military_readiness') {
        const operationText = operation.charAt(0).toUpperCase() + operation.slice(1);
        const statName = stat === 'tax_rate' ? 'Tax Rate' : stat.charAt(0).toUpperCase() + stat.slice(1);
        const actionDetails = `${operationText} ${statName} for ${nationName}: ${currentValue.toFixed(2)} → ${newValue.toFixed(2)} (${formatPercentageChange(percentageChange)})`;
        dbManager.logAdminAction(interaction.user.id, 'UPDATE_STATS', actionDetails);
      }

      // Create response embed
      const statDisplayName = (() => {
        switch (stat) {
          case 'tax_rate': return 'Tax Rate';
          case 'military_readiness': return 'Military Readiness';
          default: return stat.charAt(0).toUpperCase() + stat.slice(1);
        }
      })();

      const embed = new EmbedBuilder()
        .setTitle(`📊 Nation Statistics Updated`)
        .setDescription(`Successfully **${operation}** ${statDisplayName.toLowerCase()} for **${nation.name}**`)
        .addFields(
          { name: '🔄 Operation', value: setAbsolute ? `Set to ${value!.toLocaleString()}` : `${value! >= 0 ? 'Added' : 'Subtracted'} ${Math.abs(value!).toLocaleString()}`, inline: true },
          { name: '📈 Previous Value', value: currentValue.toLocaleString(), inline: true },
          { name: '✅ New Value', value: newValue.toLocaleString(), inline: true },
          { name: '📊 Change', value: formatPercentageChange(percentageChange), inline: true }
        )
        .setColor(percentageChange > 0 ? 0x00ff00 : percentageChange < 0 ? 0xff6b6b : 0x3498db)
        .setTimestamp();

      // Add current nation stats
      embed.addFields(
        { name: '\u200B', value: '**Current Nation Statistics**', inline: false },
        { name: '💰 GDP', value: formatGDP(nation.gdp), inline: true },
        { name: '📈 Stability', value: `${nation.stability.toFixed(1)}%`, inline: true },
        { name: '👥 Population', value: nation.population.toLocaleString(), inline: true },
        { name: '💸 Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
        { name: '🏛️ Budget', value: `${nation.budget.toFixed(2)} Billion`, inline: true },
        { name: '💵 GDP per Capita', value: `$${nation.gdpPerCapita.toFixed(2)}`, inline: true }
      );

      // Add military readiness if it exists
      if (nation.militaryReadiness !== null && nation.militaryReadiness !== undefined) {
        const readinessDescriptions = [
          '🕊️ Peaceful',
          '🟢 Minimal',
          '🟡 Low',
          '🟠 Moderate',
          '🔴 Elevated',
          '⚠️ High',
          '🚨 Critical',
          '💥 Maximum',
          '⚔️ War Footing',
          '🔥 Total War',
          '☢️ DEFCON 1'
        ];
        
        const readinessDesc = readinessDescriptions[Math.floor(nation.militaryReadiness)] || `Level ${nation.militaryReadiness}`;
        embed.addFields({
          name: '🎖️ Military Readiness',
          value: `${nation.militaryReadiness}/10 - ${readinessDesc}`,
          inline: true
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error updating nation statistics:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while updating the nation statistics. Please try again.'
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
      async () => dbManager.searchNationsForAutocomplete(focusedValue, 25),
      logger
    );
  }
}