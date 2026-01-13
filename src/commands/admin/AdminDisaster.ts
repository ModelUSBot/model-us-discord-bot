import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command, DisasterSeverity, USRegion } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { DisasterGenerator } from '../../utils/DisasterGenerator';

export class AdminDisasterCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-disaster')
    .setDescription('Generate advanced disaster events with comprehensive controls (Admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('generate')
        .setDescription('Generate a disaster with advanced filtering options')
        .addStringOption(option =>
          option.setName('severity')
            .setDescription('Disaster severity level')
            .setRequired(false)
            .addChoices(
              { name: '🎲 Random', value: 'random' },
              { name: '🟢 Very Small', value: 'very_small' },
              { name: '🟡 Small', value: 'small' },
              { name: '🟠 Medium', value: 'medium' },
              { name: '🔴 Large', value: 'large' },
              { name: '🟣 Major', value: 'major' },
              { name: '⚫ Catastrophic', value: 'catastrophic' }
            ))
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Type of disaster')
            .setRequired(false)
            .addChoices(
              { name: '🎲 Random', value: 'random' },
              { name: '🌪️ Natural Disaster', value: 'natural' },
              { name: '🏙️ Artificial/City Disaster', value: 'artificial' }
            ))
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Affected region/nation')
            .setRequired(false)
            .setAutocomplete(true))
        .addIntegerOption(option =>
          option.setName('min_casualties')
            .setDescription('Minimum casualty count (overrides severity defaults)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(10000000))
        .addIntegerOption(option =>
          option.setName('max_casualties')
            .setDescription('Maximum casualty count (overrides severity defaults)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(10000000))
        .addNumberOption(option =>
          option.setName('min_cost')
            .setDescription('Minimum economic cost in billions (overrides severity defaults)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(1000000))
        .addNumberOption(option =>
          option.setName('max_cost')
            .setDescription('Maximum economic cost in billions (overrides severity defaults)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(1000000))
        .addBooleanOption(option =>
          option.setName('multi_region')
            .setDescription('Allow disaster to spread to multiple regions')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('test_mode')
            .setDescription('Test mode - generate without affecting probability odds')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('custom_title')
            .setDescription('Custom disaster title (optional)')
            .setRequired(false)
            .setMaxLength(200))
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Disaster duration/timeline')
            .setRequired(false)
            .addChoices(
              { name: '⚡ Instant (minutes to hours)', value: 'instant' },
              { name: '🕐 Short (hours to days)', value: 'short' },
              { name: '📅 Medium (days to weeks)', value: 'medium' },
              { name: '📆 Long (weeks to months)', value: 'long' },
              { name: '🗓️ Extended (months to years)', value: 'extended' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('preview')
        .setDescription('Preview disaster templates for a specific category and severity')
        .addStringOption(option =>
          option.setName('severity')
            .setDescription('Disaster severity level')
            .setRequired(true)
            .addChoices(
              { name: '🟢 Very Small', value: 'very_small' },
              { name: '🟡 Small', value: 'small' },
              { name: '🟠 Medium', value: 'medium' },
              { name: '🔴 Large', value: 'large' },
              { name: '🟣 Major', value: 'major' },
              { name: '⚫ Catastrophic', value: 'catastrophic' }
            ))
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Type of disaster')
            .setRequired(true)
            .addChoices(
              { name: '🌪️ Natural Disaster', value: 'natural' },
              { name: '🦠 Pandemic/Health Crisis', value: 'pandemic' },
              { name: '⚔️ War/Military Conflict', value: 'war' },
              { name: '💰 Economic Crisis', value: 'economic' },
              { name: '🌾 Famine/Food Crisis', value: 'famine' },
              { name: '💻 Cyber Attack', value: 'cyber' },
              { name: '🏗️ Infrastructure Failure', value: 'infrastructure' },
              { name: '💀 Mass Casualty Event', value: 'death' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View recent disaster generation history')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of recent disasters to show')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View disaster generation statistics and probabilities'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('odds')
        .setDescription('View or manage Kappa\'s dynamic probability system')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to perform')
            .setRequired(false)
            .addChoices(
              { name: '📊 View Current Odds', value: 'view' },
              { name: '🔄 Reset to Base Odds', value: 'reset' },
              { name: '📈 View Odds History', value: 'history' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('simulate')
        .setDescription('Simulate multiple disasters to test probability distributions')
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('Number of disasters to simulate')
            .setRequired(false)
            .setMinValue(10)
            .setMaxValue(1000))
        .addBooleanOption(option =>
          option.setName('test_mode')
            .setDescription('Run simulation in test mode (no odds changes)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('category_filter')
            .setDescription('Filter simulation by category')
            .setRequired(false)
            .addChoices(
              { name: '🌪️ Natural Disaster', value: 'natural' },
              { name: '🦠 Pandemic/Health Crisis', value: 'pandemic' },
              { name: '⚔️ War/Military Conflict', value: 'war' },
              { name: '💰 Economic Crisis', value: 'economic' },
              { name: '🌾 Famine/Food Crisis', value: 'famine' },
              { name: '💻 Cyber Attack', value: 'cyber' },
              { name: '🏗️ Infrastructure Failure', value: 'infrastructure' },
              { name: '💀 Mass Casualty Event', value: 'death' }
            )));

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'generate':
          await this.handleGenerate(interaction, dbManager, logger);
          break;
        case 'preview':
          await this.handlePreview(interaction, dbManager, logger);
          break;
        case 'stats':
          await this.handleStats(interaction, dbManager, logger);
          break;
        case 'odds':
          await this.handleOdds(interaction, dbManager, logger);
          break;
        case 'history':
          await this.handleHistory(interaction, dbManager, logger);
          break;
        case 'simulate':
          await this.handleSimulate(interaction, dbManager, logger);
          break;
        default:
          await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
      }
    } catch (error) {
      logger.error('Error in admin disaster command:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Processing Disaster Command')
        .setDescription('An error occurred while processing the disaster command. Please try again.')
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    }
  }

  private async handleGenerate(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    let severity = interaction.options.getString('severity') as DisasterSeverity | 'random' | null;
    let category = interaction.options.getString('category') as any;
    const region = interaction.options.getString('region') as USRegion | null;
    const minCasualties = interaction.options.getInteger('min_casualties');
    const maxCasualties = interaction.options.getInteger('max_casualties');
    const minCost = interaction.options.getNumber('min_cost');
    const maxCost = interaction.options.getNumber('max_cost');
    const multiRegion = interaction.options.getBoolean('multi_region');
    const testMode = interaction.options.getBoolean('test_mode') || false;
    const customTitle = interaction.options.getString('custom_title');
    const duration = interaction.options.getString('duration');

    // Validate casualty range
    if (minCasualties !== null && maxCasualties !== null && minCasualties > maxCasualties) {
      await interaction.reply({
        content: '❌ Minimum casualties cannot be greater than maximum casualties.',
        ephemeral: true
      });
      return;
    }

    // Validate cost range
    if (minCost !== null && maxCost !== null && minCost > maxCost) {
      await interaction.reply({
        content: '❌ Minimum cost cannot be greater than maximum cost.',
        ephemeral: true
      });
      return;
    }

    const disasterGenerator = new DisasterGenerator(logger, dbManager);

    // Handle random selections
    if (!severity || severity === 'random') {
      severity = disasterGenerator.selectDisasterSeverity(testMode);
    }

    if (!category || category === 'random') {
      category = undefined; // Let the generator pick
    }

    // Generate the disaster with enhanced options
    const disaster = disasterGenerator.generateAdvancedDisaster(
      severity as DisasterSeverity,
      (!region || region === 'random') ? 'random' : region as USRegion,
      {
        category,
        ...(minCasualties !== null && { minCasualties }),
        ...(maxCasualties !== null && { maxCasualties }),
        ...(minCost !== null && { minCost }),
        ...(maxCost !== null && { maxCost }),
        ...(multiRegion !== null && { multiRegion }),
        ...(customTitle !== null && { customTitle }),
        ...(duration !== null && { duration }),
        generatedBy: interaction.user.id
      }
    );

    // Log the admin action
    dbManager.logAdminAction(
      interaction.user.id,
      'GENERATE_ADVANCED_DISASTER',
      `Generated ${severity} ${category || 'random'} disaster: ${disaster.title}${testMode ? ' (TEST MODE)' : ''}`
    );

    // Create enhanced embed
    const embed = new EmbedBuilder()
      .setColor(this.getSeverityColor(disaster.type))
      .setTitle(`${this.getSeverityEmoji(disaster.type)} ${disaster.title}`)
      .setDescription(disaster.description)
      .addFields(
        { name: '📊 Severity', value: `${this.getSeverityEmoji(disaster.type)} ${disaster.type.replace('_', ' ').toUpperCase()}`, inline: true },
        { name: '🏷️ Category', value: `${this.getCategoryEmoji(disaster.category)} ${disaster.category.toUpperCase()}`, inline: true },
        { name: '⏱️ Timeline', value: disaster.timeline, inline: true },
        { name: '💀 Casualties', value: disaster.estimatedCasualties.toLocaleString(), inline: true },
        { name: '💰 Economic Cost', value: `$${disaster.economicCost.toFixed(1)}B`, inline: true },
        { name: '📈 Severity Score', value: `${disaster.severity}/6`, inline: true },
        { name: '🗺️ Affected Regions', value: disaster.affectedRegions.join(', '), inline: false }
      )
      .setFooter({ text: `Generated by ${interaction.user.tag} • Advanced Disaster System v2.0${testMode ? ' • TEST MODE' : ''}` })
      .setTimestamp();

    // Add test mode indicator
    if (testMode) {
      embed.addFields({
        name: '🧪 Test Mode',
        value: 'This disaster was generated in test mode and did not affect probability odds.',
        inline: false
      });
    }

    // Add proximity factor for war disasters
    if (disaster.proximityFactor) {
      embed.addFields({
        name: '🎯 Proximity Factor',
        value: `${disaster.proximityFactor.toFixed(2)}x (${disaster.proximityFactor > 1 ? 'Near conflict zone' : 'Far from conflict'})`,
        inline: true
      });
    }

    await interaction.reply({ embeds: [embed] });

    logger.info(`Admin ${interaction.user.tag} generated advanced disaster: ${disaster.title}`, {
      metadata: {
        severity: disaster.type,
        category: disaster.category,
        casualties: disaster.estimatedCasualties,
        cost: disaster.economicCost,
        regions: disaster.affectedRegions.length
      }
    });
  }

  private async handlePreview(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const severity = interaction.options.getString('severity', true) as DisasterSeverity;
    const category = interaction.options.getString('category', true) as any;

    const disasterGenerator = new DisasterGenerator(logger, dbManager);
    const templates = disasterGenerator.getTemplatesForPreview(severity, category);

    if (!templates || templates.length === 0) {
      await interaction.reply({
        content: `❌ No templates found for ${severity} ${category} disasters.`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(this.getSeverityColor(severity))
      .setTitle(`📋 Disaster Templates Preview`)
      .setDescription(`**${this.getSeverityEmoji(severity)} ${severity.replace('_', ' ').toUpperCase()} ${this.getCategoryEmoji(category)} ${category.toUpperCase()} DISASTERS**`)
      .addFields(
        { name: '📊 Available Templates', value: templates.length.toString(), inline: true },
        { name: '💀 Casualty Range', value: `${templates[0].casualtyRanges.min.toLocaleString()} - ${templates[0].casualtyRanges.max.toLocaleString()}`, inline: true },
        { name: '💰 Cost Range', value: `$${templates[0].costRanges.min}B - $${templates[0].costRanges.max}B`, inline: true }
      )
      .setTimestamp();

    // Show sample titles (first 10)
    const sampleTitles = templates[0].titles.slice(0, 10).map((title: string, index: number) => 
      `${index + 1}. ${title.replace('{region}', '[Region]')}`
    ).join('\n');

    embed.addFields({
      name: '📝 Sample Titles',
      value: sampleTitles + (templates[0].titles.length > 10 ? `\n... and ${templates[0].titles.length - 10} more` : ''),
      inline: false
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleStats(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const disasterGenerator = new DisasterGenerator(logger, dbManager);
    const stats = disasterGenerator.getSystemStats();
    const probabilities = disasterGenerator.getDisasterProbabilities();
    
    // Get disaster history statistics from database
    let dbStats = null;
    try {
      dbStats = dbManager.getDisasterStatistics();
    } catch (error) {
      logger.error('Failed to get disaster statistics from database', { error: error as Error });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Disaster System Statistics')
      .setDescription('Comprehensive overview of the disaster generation system')
      .addFields(
        { name: '🎲 Total Templates', value: stats.totalTemplates.toString(), inline: true },
        { name: '🏷️ Categories', value: stats.categories.toString(), inline: true },
        { name: '📊 Severity Levels', value: stats.severityLevels.toString(), inline: true },
        { name: '🗺️ Available Regions', value: stats.regions.toString(), inline: true },
        { 
          name: '🎯 Current Kappa\'s Odds', 
          value: `Small: ${((probabilities.small || 0.67) * 100).toFixed(1)}%\nMedium: ${((probabilities.medium || 0.20) * 100).toFixed(1)}%\nLarge: ${((probabilities.large || 0.10) * 100).toFixed(1)}%\nMajor: ${((probabilities.major || 0.025) * 100).toFixed(1)}%\nCatastrophic: ${((probabilities.catastrophic || 0.005) * 100).toFixed(1)}%`, 
          inline: true 
        },
        { name: '⚙️ System Version', value: 'Kappa\'s System v3.0', inline: true }
      );

    // Add database statistics if available
    if (dbStats) {
      embed.addFields({
        name: '📈 Historical Data',
        value: `Total Generated: ${dbStats.totalDisasters}\nTotal Casualties: ${dbStats.totalCasualties.toLocaleString()}\nTotal Economic Cost: $${dbStats.totalEconomicCost.toFixed(1)}B`,
        inline: true
      });
    }

    embed.setTimestamp();

    // Add category breakdown
    const categoryBreakdown = Object.entries(stats.templatesByCategory)
      .map(([category, count]) => `${this.getCategoryEmoji(category as any)} ${category}: ${count}`)
      .join('\n');

    embed.addFields({
      name: '📋 Templates by Category',
      value: categoryBreakdown,
      inline: false
    });

    // Add severity breakdown
    const severityBreakdown = Object.entries(stats.templatesBySeverity)
      .map(([severity, count]) => `${this.getSeverityEmoji(severity as DisasterSeverity)} ${severity.replace('_', ' ')}: ${count}`)
      .join('\n');

    embed.addFields({
      name: '📈 Templates by Severity',
      value: severityBreakdown,
      inline: false
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleOdds(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const action = interaction.options.getString('action') || 'view';
    const disasterGenerator = new DisasterGenerator(logger, dbManager);

    switch (action) {
      case 'view':
        const currentOdds = disasterGenerator.getDisasterProbabilities();
        const baseOdds = disasterGenerator.getDisasterProbabilities(true); // Test mode = base odds

        const embed = new EmbedBuilder()
          .setColor(0x9932cc)
          .setTitle('🎯 Kappa\'s Dynamic Probability System')
          .setDescription('Current disaster generation odds vs base odds')
          .addFields(
            { 
              name: '📊 Current Active Odds', 
              value: `🟡 Small: ${((currentOdds.small || 0.67) * 100).toFixed(1)}%\n🟠 Medium: ${((currentOdds.medium || 0.20) * 100).toFixed(1)}%\n🔴 Large: ${((currentOdds.large || 0.10) * 100).toFixed(1)}%\n🟣 Major: ${((currentOdds.major || 0.025) * 100).toFixed(1)}%\n⚫ Catastrophic: ${((currentOdds.catastrophic || 0.005) * 100).toFixed(1)}%`,
              inline: true 
            },
            { 
              name: '📈 Base Odds (Reference)', 
              value: `🟡 Small: ${((baseOdds.small || 0.67) * 100).toFixed(1)}%\n🟠 Medium: ${((baseOdds.medium || 0.20) * 100).toFixed(1)}%\n🔴 Large: ${((baseOdds.large || 0.10) * 100).toFixed(1)}%\n🟣 Major: ${((baseOdds.major || 0.025) * 100).toFixed(1)}%\n⚫ Catastrophic: ${((baseOdds.catastrophic || 0.005) * 100).toFixed(1)}%`,
              inline: true 
            },
            {
              name: '📋 System Rules',
              value: '• **Small rolled**: -20% Small, +10% Medium, +10% Large\n• **Medium/Large rolled**: Reset to base, restore Small losses\n• **Catastrophic**: Always fixed at 3% (never changes)',
              inline: false
            }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;

      case 'reset':
        try {
          dbManager.resetDisasterOdds(interaction.user.id);
          
          const resetEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Odds Reset Successfully')
            .setDescription('Disaster odds have been reset to base values according to Kappa\'s system.')
            .addFields({
              name: '📊 Reset Odds',
              value: '🟡 Small: 67.0%\n🟠 Medium: 20.0%\n🔴 Large: 10.0%\n🟣 Major: 2.5%\n⚫ Catastrophic: 0.5%',
              inline: false
            })
            .setFooter({ text: `Reset by ${interaction.user.tag}` })
            .setTimestamp();

          // Log the admin action
          dbManager.logAdminAction(
            interaction.user.id,
            'RESET_DISASTER_ODDS',
            'Reset disaster odds to base values'
          );

          await interaction.reply({ embeds: [resetEmbed], ephemeral: true });
          
          logger.info(`Admin ${interaction.user.tag} reset disaster odds to base values`);
        } catch (error) {
          logger.error('Failed to reset disaster odds', { error: error as Error });
          await interaction.reply({
            content: '❌ Failed to reset disaster odds. Please try again.',
            ephemeral: true
          });
        }
        break;

      default:
        await interaction.reply({
          content: '❌ Unknown odds action.',
          ephemeral: true
        });
    }
  }

  private async handleHistory(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const limit = interaction.options.getInteger('limit') || 20;

    try {
      const history = dbManager.getDisasterHistory(limit);
      
      if (history.length === 0) {
        await interaction.reply({
          content: '📋 No disaster history found. Generate some disasters first!',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x8b4513)
        .setTitle('📜 Recent Disaster History')
        .setDescription(`Showing the last ${history.length} generated disasters`)
        .setTimestamp();

      // Group disasters by date for better organization
      const groupedByDate: Record<string, typeof history> = {};
      history.forEach(disaster => {
        const date = new Date(disaster.createdAt).toDateString();
        if (!groupedByDate[date]) {
          groupedByDate[date] = [];
        }
        groupedByDate[date].push(disaster);
      });

      // Add fields for each date (limit to prevent embed size issues)
      let fieldCount = 0;
      for (const [date, disasters] of Object.entries(groupedByDate)) {
        if (fieldCount >= 10) break; // Discord embed field limit
        
        const disasterList = disasters.slice(0, 5).map(disaster => {
          const severityEmoji = this.getSeverityEmoji(disaster.severity as DisasterSeverity);
          const categoryEmoji = this.getCategoryEmoji(disaster.category as any);
          return `${severityEmoji}${categoryEmoji} ${disaster.title}\n💀 ${disaster.estimatedCasualties.toLocaleString()} casualties | 💰 $${disaster.economicCost.toFixed(1)}B`;
        }).join('\n\n');

        embed.addFields({
          name: `📅 ${date} (${disasters.length} disasters)`,
          value: disasterList + (disasters.length > 5 ? `\n... and ${disasters.length - 5} more` : ''),
          inline: false
        });
        
        fieldCount++;
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Failed to get disaster history', { error: error as Error });
      await interaction.reply({
        content: '❌ Failed to retrieve disaster history from database.',
        ephemeral: true
      });
    }
  }

  private async handleSimulate(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const count = interaction.options.getInteger('count') || 100;
    const categoryFilter = interaction.options.getString('category_filter') as any;
    const testMode = interaction.options.getBoolean('test_mode') || false;

    await interaction.deferReply({ ephemeral: true });

    const disasterGenerator = new DisasterGenerator(logger, dbManager);
    const results = disasterGenerator.simulateDisasters(count, categoryFilter, testMode);

    const embed = new EmbedBuilder()
      .setColor(0x9932cc)
      .setTitle('🧪 Disaster Simulation Results')
      .setDescription(`Simulated ${count} disasters${categoryFilter ? ` (${categoryFilter} only)` : ''}${testMode ? ' in TEST MODE' : ''}`)
      .addFields(
        { name: '📊 Total Simulated', value: count.toString(), inline: true },
        { name: '💀 Avg Casualties', value: Math.round(results.avgCasualties).toLocaleString(), inline: true },
        { name: '💰 Avg Cost', value: `$${results.avgCost.toFixed(1)}B`, inline: true },
        { name: '📈 Most Common Severity', value: `${this.getSeverityEmoji(results.mostCommonSeverity)} ${results.mostCommonSeverity.replace('_', ' ')}`, inline: true },
        { name: '🏷️ Most Common Category', value: `${this.getCategoryEmoji(results.mostCommonCategory)} ${results.mostCommonCategory}`, inline: true },
        { name: '🗺️ Most Affected Region', value: results.mostAffectedRegion, inline: true }
      )
      .setTimestamp();

    // Add distribution breakdown
    const severityDist = Object.entries(results.severityDistribution)
      .map(([severity, count]) => `${this.getSeverityEmoji(severity as DisasterSeverity)} ${severity.replace('_', ' ')}: ${count} (${((count / results.total) * 100).toFixed(1)}%)`)
      .join('\n');

    embed.addFields({
      name: '📊 Severity Distribution',
      value: severityDist,
      inline: false
    });

    if (!categoryFilter) {
      const categoryDist = Object.entries(results.categoryDistribution)
        .map(([category, count]) => `${this.getCategoryEmoji(category as any)} ${category}: ${count} (${((count / results.total) * 100).toFixed(1)}%)`)
        .join('\n');

      embed.addFields({
        name: '🏷️ Category Distribution',
        value: categoryDist,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  private getSeverityColor(severity: DisasterSeverity): number {
    const colors = {
      'very_small': 0x90EE90,  // Light green
      'small': 0xFFFF00,      // Yellow
      'medium': 0xFFA500,     // Orange
      'large': 0xFF4500,      // Red-orange
      'major': 0x8B0000,      // Dark red
      'catastrophic': 0x000000 // Black
    };
    return colors[severity];
  }

  private getSeverityEmoji(severity: DisasterSeverity): string {
    const emojis: Record<DisasterSeverity, string> = {
      'very_small': '🟢',
      'small': '🟡',
      'medium': '🟠',
      'large': '🔴',
      'major': '🟣',
      'catastrophic': '⚫'
    };
    return emojis[severity] || '❓';
  }

  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      'natural': '🌪️',
      'pandemic': '🦠',
      'war': '⚔️',
      'economic': '💰',
      'famine': '🌾',
      'cyber': '💻',
      'infrastructure': '🏗️',
      'death': '💀'
    };
    return emojis[category] || '❓';
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'region') {
      const regions = [
        { name: '🎲 Random Region', value: 'random' },
        { name: '🗽 New York', value: 'new_york' },
        { name: '🤠 Texas', value: 'texas' },
        { name: '🌴 Southern California', value: 'southern_california' },
        { name: '🌉 Northern California', value: 'northern_california' },
        { name: '🏖️ Florida', value: 'florida' },
        { name: '🦞 New England', value: 'new_england' },
        { name: '🏔️ Cascadia', value: 'cascadia' },
        { name: '🏛️ Carolina', value: 'carolina' },
        { name: '🌆 Illinois', value: 'illinois' },
        { name: '🔔 Pennsylvania', value: 'pennsylvania' },
        { name: '🎺 Dixieland', value: 'dixieland' },
        { name: '🏭 Ohio', value: 'ohio' },
        { name: '🍑 Georgia', value: 'georgia' },
        { name: '🏛️ Virginia', value: 'virginia' },
        { name: '🏙️ New Jersey', value: 'new_jersey' },
        { name: '🦀 Maryland', value: 'maryland' },
        { name: '🛢️ Oklahoma', value: 'oklahoma' },
        { name: '🚗 Michigan', value: 'michigan' },
        { name: '🌾 Dakota', value: 'dakota' },
        { name: '🌵 Nuevo Arizona', value: 'nuevo_arizona' },
        { name: '🎸 Tennessee', value: 'tennessee' },
        { name: '⛰️ Colorado', value: 'colorado' },
        { name: '🏁 Indiana', value: 'indiana' },
        { name: '🧀 Wisconsin', value: 'wisconsin' },
        { name: '🌍 Multiple Nations', value: 'multiple_nations' }
      ];

      const filtered = regions.filter(region => 
        region.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      ).slice(0, 25);

      await interaction.respond(filtered);
    }
  }
}