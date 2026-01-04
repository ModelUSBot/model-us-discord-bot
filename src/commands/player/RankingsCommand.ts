import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command, RankingCategory } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP, extractBaseName } from '../../utils/FormatUtils';

export class RankingsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('rankings')
    .setDescription('View nation rankings by category')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Ranking category')
        .setRequired(true)
        .addChoices(
          { name: 'GDP', value: 'gdp' },
          { name: 'Population', value: 'population' },
          { name: 'Stability', value: 'stability' },
          { name: 'Tax Rate', value: 'tax_rate' },
          { name: 'GDP per Capita', value: 'gdp_per_capita' },
          { name: 'Military Readiness', value: 'military_readiness' }
        )
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of nations to show (default: 10)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const category = interaction.options.getString('category', true) as RankingCategory;
    const limit = interaction.options.getInteger('limit') ?? 10;

    try {
      const rankedNations = dbManager.getNationsByRanking(category, limit);

      if (rankedNations.length === 0) {
        await interaction.reply({
          content: '❌ No nations found in the database.'
        });
        return;
      }

      const categoryNames = {
        gdp: 'GDP (Billions)',
        population: 'Population',
        stability: 'Stability (%)',
        tax_rate: 'Tax Rate (%)',
        gdp_per_capita: 'GDP per Capita',
        military_readiness: 'Military Readiness'
      };

      const categoryEmojis = {
        gdp: '💰',
        population: '👥',
        stability: '📊',
        tax_rate: '💸',
        gdp_per_capita: '💵',
        military_readiness: '🎖️'
      };

      const formatValue = (nation: any, cat: string) => {
        switch (cat) {
          case 'gdp':
            // Debug logging for GDP values
            logger.debug(`GDP Debug: ${nation.name} has GDP value: ${nation.gdp} (type: ${typeof nation.gdp})`);
            return formatGDP(nation.gdp);
          case 'population':
            return nation.population.toLocaleString();
          case 'stability':
            return `${nation.stability.toFixed(1)}%`;
          case 'tax_rate':
            return `${nation.taxRate.toFixed(1)}%`;
          case 'gdp_per_capita':
            return `$${nation.gdpPerCapita.toFixed(2)}`;
          case 'military_readiness':
            const readiness = nation.militaryReadiness || 5.0;
            const readinessDescriptions = [
              '🕊️ Peaceful', '🟢 Minimal', '🟡 Low', '🟠 Moderate', '🔴 Elevated',
              '⚠️ High', '🚨 Critical', '💥 Maximum', '⚔️ War Footing', '🔥 Total War', '☢️ DEFCON 1'
            ];
            const desc = readinessDescriptions[Math.floor(readiness)] || `Level ${readiness}`;
            return `${readiness}/10 - ${desc}`;
          default:
            return 'N/A';
        }
      };

      const rankingText = rankedNations.map((nation, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const baseName = extractBaseName(nation.name); // Remove prefixes for cleaner display
        return `${medal} **${baseName}** - ${formatValue(nation, category)}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`${categoryEmojis[category]} ${categoryNames[category]} Rankings`)
        .setDescription(rankingText)
        .setColor(0x0099ff)
        .setFooter({ text: `Showing top ${rankedNations.length} nations` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error retrieving rankings:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while retrieving rankings. Please try again.'
      });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    await interaction.respond([]);
  }
}