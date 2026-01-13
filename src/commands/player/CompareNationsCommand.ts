import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';

export class CompareNationsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('compare-nations')
    .setDescription('Compare statistics between two nations')
    .addStringOption(option =>
      option.setName('nation1')
        .setDescription('First nation to compare')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('nation2')
        .setDescription('Second nation to compare')
        .setRequired(true)
        .setAutocomplete(true));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const nation1Name = interaction.options.getString('nation1', true);
    const nation2Name = interaction.options.getString('nation2', true);

    try {
      // Get both nations
      const nation1 = dbManager.getNationByName(nation1Name);
      const nation2 = dbManager.getNationByName(nation2Name);

      if (!nation1) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${nation1Name}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (!nation2) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${nation2Name}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (nation1Name.toLowerCase() === nation2Name.toLowerCase()) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Same Nation')
          .setDescription('Please select two different nations to compare.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Calculate comparison metrics
      const gdpDiff = ((nation1.gdp - nation2.gdp) / nation2.gdp) * 100;
      const popDiff = ((nation1.population - nation2.population) / nation2.population) * 100;
      const stabilityDiff = nation1.stability - nation2.stability;
      const taxDiff = nation1.taxRate - nation2.taxRate;
      const gdpPerCapitaDiff = ((nation1.gdpPerCapita - nation2.gdpPerCapita) / nation2.gdpPerCapita) * 100;
      const budgetDiff = ((nation1.budget - nation2.budget) / nation2.budget) * 100;

      const formatDifference = (diff: number, isPercentage: boolean = true, suffix: string = '%'): string => {
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? '🟢' : diff < 0 ? '🔴' : '⚪';
        if (isPercentage) {
          return `${color} ${sign}${diff.toFixed(1)}${suffix}`;
        } else {
          return `${color} ${sign}${diff.toFixed(1)} ${suffix}`;
        }
      };

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`⚖️ Nation Comparison`)
        .setDescription(`**${nation1.name}** vs **${nation2.name}**`)
        .addFields(
          { name: '\u200B', value: '**Economic Statistics**', inline: false },
          { 
            name: '💰 GDP', 
            value: `${formatGDP(nation1.gdp)} vs ${formatGDP(nation2.gdp)}\n${formatDifference(gdpDiff)}`, 
            inline: true 
          },
          { 
            name: '👥 Population', 
            value: `${nation1.population.toLocaleString()} vs ${nation2.population.toLocaleString()}\n${formatDifference(popDiff)}`, 
            inline: true 
          },
          { 
            name: '💵 GDP per Capita', 
            value: `$${nation1.gdpPerCapita.toFixed(2)} vs $${nation2.gdpPerCapita.toFixed(2)}\n${formatDifference(gdpPerCapitaDiff)}`, 
            inline: true 
          },
          { 
            name: '🏛️ Budget', 
            value: `${formatGDP(nation1.budget)} vs ${formatGDP(nation2.budget)}\n${formatDifference(budgetDiff)}`, 
            inline: true 
          },
          { 
            name: '💸 Tax Rate', 
            value: `${nation1.taxRate.toFixed(1)}% vs ${nation2.taxRate.toFixed(1)}%\n${formatDifference(taxDiff, false, 'pp')}`, 
            inline: true 
          },
          { 
            name: '📈 Stability', 
            value: `${nation1.stability.toFixed(1)}% vs ${nation2.stability.toFixed(1)}%\n${formatDifference(stabilityDiff, false, 'pp')}`, 
            inline: true 
          }
        )
        .setTimestamp();

      // Add individual military stats comparison if available
      if (nation1.groundStrength !== null || nation2.groundStrength !== null) {
        const ground1 = nation1.groundStrength || 0;
        const ground2 = nation2.groundStrength || 0;
        const groundDiff = ground1 - ground2;

        const naval1 = nation1.navalStrength || 0;
        const naval2 = nation2.navalStrength || 0;
        const navalDiff = naval1 - naval2;

        const air1 = nation1.airStrength || 0;
        const air2 = nation2.airStrength || 0;
        const airDiff = air1 - air2;

        embed.addFields(
          { name: '\u200B', value: '**Military Statistics**', inline: false },
          { 
            name: '🪖 Ground Forces', 
            value: `${ground1.toFixed(1)}/10 vs ${ground2.toFixed(1)}/10\n${formatDifference(groundDiff, false, ' pts')}`, 
            inline: true 
          },
          { 
            name: '⚓ Naval Forces', 
            value: `${naval1.toFixed(1)}/10 vs ${naval2.toFixed(1)}/10\n${formatDifference(navalDiff, false, ' pts')}`, 
            inline: true 
          },
          { 
            name: '✈️ Air Forces', 
            value: `${air1.toFixed(1)}/10 vs ${air2.toFixed(1)}/10\n${formatDifference(airDiff, false, ' pts')}`, 
            inline: true 
          }
        );
      }

      // Add government and debt comparison if available
      if (nation1.governmentType || nation2.governmentType || 
          (nation1.nationalDebt && nation1.nationalDebt > 0) || 
          (nation2.nationalDebt && nation2.nationalDebt > 0)) {
        
        embed.addFields({ name: '\u200B', value: '**Additional Information**', inline: false });

        if (nation1.governmentType || nation2.governmentType) {
          embed.addFields({
            name: '🏛️ Government Type',
            value: `${nation1.governmentType || 'Unknown'} vs ${nation2.governmentType || 'Unknown'}`,
            inline: true
          });
        }

        if ((nation1.nationalDebt && nation1.nationalDebt > 0) || (nation2.nationalDebt && nation2.nationalDebt > 0)) {
          const debt1 = nation1.nationalDebt || 0;
          const debt2 = nation2.nationalDebt || 0;
          const debtDiff = debt2 > 0 ? ((debt1 - debt2) / debt2) * 100 : (debt1 > 0 ? 100 : 0);

          embed.addFields({
            name: '💳 National Debt',
            value: `$${debt1.toFixed(2)}B vs $${debt2.toFixed(2)}B\n${formatDifference(debtDiff)}`,
            inline: true
          });
        }
      }

      // Add summary
      let winner = '';
      let winnerCount = 0;
      let nation1Wins = 0;
      let nation2Wins = 0;

      if (nation1.gdp > nation2.gdp) nation1Wins++; else if (nation2.gdp > nation1.gdp) nation2Wins++;
      if (nation1.population > nation2.population) nation1Wins++; else if (nation2.population > nation1.population) nation2Wins++;
      if (nation1.gdpPerCapita > nation2.gdpPerCapita) nation1Wins++; else if (nation2.gdpPerCapita > nation1.gdpPerCapita) nation2Wins++;
      if (nation1.stability > nation2.stability) nation1Wins++; else if (nation2.stability > nation1.stability) nation2Wins++;
      if (nation1.budget > nation2.budget) nation1Wins++; else if (nation2.budget > nation1.budget) nation2Wins++;

      if (nation1Wins > nation2Wins) {
        winner = `🏆 **${nation1.name}** leads in ${nation1Wins} out of 5 key metrics`;
      } else if (nation2Wins > nation1Wins) {
        winner = `🏆 **${nation2.name}** leads in ${nation2Wins} out of 5 key metrics`;
      } else {
        winner = `🤝 **Tied** - Both nations are closely matched`;
      }

      embed.addFields({
        name: '🏆 Overall Comparison',
        value: winner,
        inline: false
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error comparing nations:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Comparing Nations')
        .setDescription('An error occurred while comparing nations. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'nation1' || focusedOption.name === 'nation2') {
      const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
      const choices = nations.slice(0, 25).map(nation => ({
        name: nation.name,
        value: nation.name
      }));
      
      await interaction.respond(choices);
    }
  }
}