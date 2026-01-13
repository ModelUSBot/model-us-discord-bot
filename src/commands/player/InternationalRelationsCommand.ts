import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { handleCommandError, getNationWithSuggestions, handleAutocomplete, checkCooldown, safeReply } from '../../utils/CommandUtils';

export class InternationalRelationsCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('diplomacy')
    .setDescription('Manage international relations with foreign countries')
    .addSubcommand(subcommand =>
      subcommand
        .setName('request')
        .setDescription('Submit a diplomatic request to a foreign country')
        .addStringOption(option =>
          option.setName('country')
            .setDescription('Foreign country to engage with')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of diplomatic action')
            .setRequired(true)
            .addChoices(
              { name: '🤝 Trade Agreement', value: 'trade_agreement' },
              { name: '🏛️ Diplomatic Recognition', value: 'diplomatic_recognition' },
              { name: '🏢 Embassy Establishment', value: 'embassy_establishment' },
              { name: '⚔️ Military Cooperation', value: 'military_cooperation' },
              { name: '🎭 Cultural Exchange', value: 'cultural_exchange' },
              { name: '💰 Economic Aid Request', value: 'economic_aid' },
              { name: '🚫 Sanctions Request', value: 'sanctions_request' },
              { name: '☮️ Peace Treaty', value: 'peace_treaty' },
              { name: '🛡️ Alliance Proposal', value: 'alliance_proposal' },
              { name: '👥 Immigration Agreement', value: 'immigration_agreement' },
              { name: '⚖️ Extradition Treaty', value: 'extradition_treaty' },
              { name: '🌍 Climate Accord', value: 'climate_accord' }
            ))
        .addStringOption(option =>
          option.setName('priority')
            .setDescription('Priority level of this request')
            .setRequired(true)
            .addChoices(
              { name: '🔴 Urgent', value: 'urgent' },
              { name: '🟠 High', value: 'high' },
              { name: '🟡 Normal', value: 'normal' },
              { name: '🟢 Low', value: 'low' }
            ))
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Brief title for this diplomatic request')
            .setRequired(true)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Detailed description of the request')
            .setRequired(true)
            .setMaxLength(1000))
        .addStringOption(option =>
          option.setName('terms')
            .setDescription('Proposed terms and conditions')
            .setRequired(false)
            .setMaxLength(500))
        .addStringOption(option =>
          option.setName('economic_impact')
            .setDescription('Expected economic impact and benefits')
            .setRequired(false)
            .setMaxLength(300))
        .addStringOption(option =>
          option.setName('justification')
            .setDescription('Political justification for this request')
            .setRequired(false)
            .setMaxLength(300))
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Expected duration or timeline')
            .setRequired(false)
            .setMaxLength(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check status of your diplomatic requests')
        .addStringOption(option =>
          option.setName('request_code')
            .setDescription('Specific request code to check (optional)')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('relations')
        .setDescription('View your current international relations')
        .addStringOption(option =>
          option.setName('country')
            .setDescription('Specific country to view relations with (optional)')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View diplomatic history and events')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of events to show (default: 10, max: 25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('countries')
        .setDescription('List available countries for diplomatic engagement')
        .addStringOption(option =>
          option.setName('continent')
            .setDescription('Filter by continent')
            .setRequired(false)
            .addChoices(
              { name: '🌍 Africa', value: 'Africa' },
              { name: '🌏 Asia', value: 'Asia' },
              { name: '🌎 Europe', value: 'Europe' },
              { name: '🌎 North America', value: 'North America' },
              { name: '🌎 South America', value: 'South America' },
              { name: '🌏 Oceania', value: 'Oceania' }
            )));

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Check cooldown
    if (!(await checkCooldown(interaction, 3000))) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'request':
          await this.handleRequest(interaction, dbManager, logger);
          break;
        case 'status':
          await this.handleStatus(interaction, dbManager, logger);
          break;
        case 'relations':
          await this.handleRelations(interaction, dbManager, logger);
          break;
        case 'history':
          await this.handleHistory(interaction, dbManager, logger);
          break;
        case 'countries':
          await this.handleCountries(interaction, dbManager, logger);
          break;
        default:
          await safeReply(interaction, { content: '❌ Unknown subcommand.' }, true);
      }
    } catch (error) {
      await handleCommandError(interaction, error as Error, logger, 'diplomacy');
    }
  }

  private async handleRequest(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to submit diplomatic requests.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const country = interaction.options.getString('country', true);
    const type = interaction.options.getString('type', true);
    const priority = interaction.options.getString('priority', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const terms = interaction.options.getString('terms') || 'To be negotiated';
    const economicImpact = interaction.options.getString('economic_impact') || 'Under evaluation';
    const justification = interaction.options.getString('justification') || 'In the interest of both nations';
    const duration = interaction.options.getString('duration') || 'Long-term';

    // Verify the country exists
    const targetCountry = dbManager.getInternationalCountryByName(country);
    if (!targetCountry) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Country Not Found')
        .setDescription(`The country "${country}" is not available for diplomatic engagement.`)
        .addFields({
          name: '💡 Tip',
          value: 'Use `/diplomacy countries` to see available countries.',
          inline: false
        })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    // Create the diplomatic request
    const result = dbManager.createDiplomaticRequest(
      userLink.nationName,
      country,
      type,
      priority,
      title,
      description,
      terms,
      economicImpact,
      justification,
      duration,
      interaction.user.id
    );

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Request Failed')
        .setDescription('Failed to submit diplomatic request. Please try again.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    // Get type display name
    const typeNames: Record<string, string> = {
      'trade_agreement': '🤝 Trade Agreement',
      'diplomatic_recognition': '🏛️ Diplomatic Recognition',
      'embassy_establishment': '🏢 Embassy Establishment',
      'military_cooperation': '⚔️ Military Cooperation',
      'cultural_exchange': '🎭 Cultural Exchange',
      'economic_aid': '💰 Economic Aid Request',
      'sanctions_request': '🚫 Sanctions Request',
      'peace_treaty': '☮️ Peace Treaty',
      'alliance_proposal': '🛡️ Alliance Proposal',
      'immigration_agreement': '👥 Immigration Agreement',
      'extradition_treaty': '⚖️ Extradition Treaty',
      'climate_accord': '🌍 Climate Accord'
    };

    const priorityIcons: Record<string, string> = {
      'urgent': '🔴',
      'high': '🟠',
      'normal': '🟡',
      'low': '🟢'
    };

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📋 Diplomatic Request Submitted')
      .setDescription(`Your diplomatic request has been submitted and is pending admin review.`)
      .addFields(
        { name: '🆔 Request Code', value: `**${result.code}**`, inline: true },
        { name: '🌍 Target Country', value: `${targetCountry.name} (${targetCountry.code})`, inline: true },
        { name: '📋 Request Type', value: typeNames[type] || type, inline: true },
        { name: '⚡ Priority', value: `${priorityIcons[priority]} ${priority.toUpperCase()}`, inline: true },
        { name: '📝 Title', value: title, inline: false },
        { name: '📄 Description', value: description.length > 200 ? description.substring(0, 200) + '...' : description, inline: false },
        { name: '⏰ Status', value: '🟡 Pending Review', inline: true },
        { name: '📅 Expires', value: '<t:' + Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000) + ':R>', inline: true }
      )
      .setFooter({ text: `Submitted by ${interaction.user.tag} • Use /diplomacy status to track progress` })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });

    // Send confirmation DM to the user
    try {
      const confirmationEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📋 Diplomatic Request Confirmation')
        .setDescription(`Your diplomatic request has been successfully submitted and is now under admin review.`)
        .addFields(
          { name: '🆔 Request Code', value: `**${result.code}**`, inline: true },
          { name: '🌍 Target Country', value: `${targetCountry.name} (${targetCountry.code})`, inline: true },
          { name: '📋 Request Type', value: typeNames[type] || type, inline: true },
          { name: '⚡ Priority Level', value: `${priorityIcons[priority]} ${priority.toUpperCase()}`, inline: true },
          { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: '⏳ Review Deadline', value: '<t:' + Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000) + ':R>', inline: true },
          { name: '📝 Your Request Title', value: title, inline: false }
        )
        .addFields({
          name: '📋 What Happens Next?',
          value: '• Admins will review your request within 30 days\n• You\'ll receive a DM when a decision is made\n• Use `/international-relations status` to track progress\n• Check your DMs for updates',
          inline: false
        })
        .addFields({
          name: '💡 Tips While You Wait',
          value: '• Build your nation\'s reputation and stability\n• Consider submitting requests to other countries\n• Engage with the community to show diplomatic maturity\n• Review successful diplomatic strategies',
          inline: false
        })
        .setFooter({ text: 'Keep this request code for reference: ' + result.code })
        .setTimestamp();

      await interaction.user.send({ embeds: [confirmationEmbed] });
      
      logger.info(`Confirmation DM sent for diplomatic request submission`, {
        metadata: {
          userId: interaction.user.id,
          requestCode: result.code,
          targetCountry: country
        }
      });
    } catch (dmError) {
      logger.warn('Failed to send confirmation DM for diplomatic request:', { 
        error: dmError as Error,
        metadata: {
          userId: interaction.user.id,
          requestCode: result.code
        }
      });
      
      // Send a follow-up message in the channel if DM fails
      try {
        const fallbackEmbed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('⚠️ DM Notification')
          .setDescription(`I couldn't send you a confirmation DM. Please check your DM settings to receive updates about your diplomatic request **${result.code}**.`)
          .setTimestamp();
        
        await interaction.followUp({ embeds: [fallbackEmbed], ephemeral: true });
      } catch (followUpError) {
        logger.error('Failed to send DM fallback notification:', { error: followUpError as Error });
      }
    }

    // Notify admins
    try {
      const adminChannelId = '1457229969481531463';
      const adminRoleId = '1456867369111519335';
      const adminChannel = await interaction.client.channels.fetch(adminChannelId);
      
      if (adminChannel && adminChannel.isTextBased() && 'send' in adminChannel) {
        const adminEmbed = new EmbedBuilder()
          .setColor(priority === 'urgent' ? 0xff0000 : priority === 'high' ? 0xff6600 : 0x0099ff)
          .setTitle('🌍 New Diplomatic Request')
          .setDescription(`A new diplomatic request requires admin review.`)
          .addFields(
            { name: '🆔 Request Code', value: `**${result.code}**`, inline: true },
            { name: '🏛️ Requesting Nation', value: userLink.nationName, inline: true },
            { name: '🌍 Target Country', value: `${targetCountry.name} (${targetCountry.code})`, inline: true },
            { name: '📋 Type', value: typeNames[type] || type, inline: true },
            { name: '⚡ Priority', value: `${priorityIcons[priority]} ${priority.toUpperCase()}`, inline: true },
            { name: '👤 Requested By', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📝 Title', value: title, inline: false },
            { name: '📄 Description', value: description.length > 300 ? description.substring(0, 300) + '...' : description, inline: false }
          )
          .setFooter({ text: `Use /admin-diplomacy review ${result.code} to process this request` })
          .setTimestamp();

        await adminChannel.send({ 
          content: `<@&${adminRoleId}> New ${priority} priority diplomatic request!`,
          embeds: [adminEmbed] 
        });
      }
    } catch (error) {
      logger.warn('Failed to send admin notification for diplomatic request:', { error: error as Error });
    }

    logger.info(`Diplomatic request submitted: ${result.code}`, {
      user: interaction.user.id,
      metadata: {
        nation: userLink.nationName,
        country: country,
        type: type,
        priority: priority
      }
    });
  }

  private async handleStatus(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to check diplomatic requests.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const requestCode = interaction.options.getString('request_code');

    if (requestCode) {
      // Show specific request
      const request = dbManager.getDiplomaticRequestByCode(requestCode);
      if (!request || request.requesting_nation !== userLink.nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Request Not Found')
          .setDescription(`Diplomatic request "${requestCode}" not found or not accessible.`)
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      const statusColors: Record<string, number> = {
        'pending': 0xffff00,
        'under_review': 0xff6600,
        'approved': 0x00ff00,
        'rejected': 0xff0000,
        'expired': 0x808080
      };

      const statusIcons: Record<string, string> = {
        'pending': '🟡',
        'under_review': '🟠',
        'approved': '✅',
        'rejected': '❌',
        'expired': '⏰'
      };

      const embed = new EmbedBuilder()
        .setColor(statusColors[request.status] || 0x0099ff)
        .setTitle(`📋 Diplomatic Request: ${request.request_code}`)
        .setDescription(`**${request.title}**`)
        .addFields(
          { name: '🌍 Target Country', value: `${request.target_country} (${request.country_full_name || 'Unknown'})`, inline: true },
          { name: '📋 Type', value: request.request_type.replace('_', ' ').toUpperCase(), inline: true },
          { name: '⚡ Priority', value: request.priority.toUpperCase(), inline: true },
          { name: '⏰ Status', value: `${statusIcons[request.status]} ${request.status.replace('_', ' ').toUpperCase()}`, inline: true },
          { name: '📅 Submitted', value: `<t:${Math.floor(new Date(request.created_at).getTime() / 1000)}:R>`, inline: true },
          { name: '⏳ Expires', value: `<t:${Math.floor(new Date(request.expires_at).getTime() / 1000)}:R>`, inline: true },
          { name: '📄 Description', value: request.description, inline: false }
        )
        .setTimestamp();

      if (request.reviewed_at) {
        embed.addFields({
          name: '📝 Admin Review',
          value: `Reviewed <t:${Math.floor(new Date(request.reviewed_at).getTime() / 1000)}:R>\n${request.admin_notes || 'No additional notes'}`,
          inline: false
        });
      }

      await safeReply(interaction, { embeds: [embed] });
    } else {
      // Show all requests for this nation
      const requests = dbManager.getDiplomaticRequestsByNation(userLink.nationName, 10);

      if (requests.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('📋 No Diplomatic Requests')
          .setDescription('You have not submitted any diplomatic requests yet.')
          .addFields({
            name: '💡 Get Started',
            value: 'Use `/diplomacy request` to submit your first diplomatic request.',
            inline: false
          })
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📋 Diplomatic Requests - ${userLink.nationName}`)
        .setDescription(`Showing your ${requests.length} most recent diplomatic requests`)
        .setTimestamp();

      requests.forEach((request, index) => {
        const statusIcons: Record<string, string> = {
          'pending': '🟡',
          'under_review': '🟠',
          'approved': '✅',
          'rejected': '❌',
          'expired': '⏰'
        };

        const createdAt = new Date(request.created_at);
        embed.addFields({
          name: `${index + 1}. ${request.request_code} - ${statusIcons[request.status]} ${request.status.toUpperCase()}`,
          value: `**${request.title}**\n🌍 ${request.target_country} • 📅 <t:${Math.floor(createdAt.getTime() / 1000)}:R>`,
          inline: false
        });
      });

      embed.setFooter({ text: 'Use /diplomacy status <request_code> for detailed information' });

      await safeReply(interaction, { embeds: [embed] });
    }
  }

  private async handleRelations(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to view diplomatic relations.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const relations = dbManager.getDiplomaticRelationsByNation(userLink.nationName);

    if (relations.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('🌍 No International Relations')
        .setDescription('Your nation has not established any international relations yet.')
        .addFields({
          name: '💡 Get Started',
          value: 'Submit diplomatic requests using `/diplomacy request` to establish relations with foreign countries.',
          inline: false
        })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`🌍 International Relations - ${userLink.nationName}`)
      .setDescription(`Your nation has established ${relations.length} international relationship${relations.length === 1 ? '' : 's'}`)
      .setTimestamp();

    const relationIcons: Record<string, string> = {
      'trade_agreement': '🤝',
      'embassy': '🏢',
      'military_cooperation': '⚔️',
      'cultural_exchange': '🎭',
      'economic_aid': '💰',
      'alliance': '🛡️',
      'immigration_pact': '👥',
      'climate_accord': '🌍'
    };

    relations.forEach((relation, index) => {
      const establishedAt = new Date(relation.established_at);
      const icon = relationIcons[relation.relation_type] || '📋';
      
      embed.addFields({
        name: `${index + 1}. ${icon} ${relation.relation_type.replace('_', ' ').toUpperCase()}`,
        value: `🌍 **${relation.country_full_name}** (${relation.international_country})\n📅 Established <t:${Math.floor(establishedAt.getTime() / 1000)}:R>\n${relation.terms ? `📝 ${relation.terms.substring(0, 100)}${relation.terms.length > 100 ? '...' : ''}` : ''}`,
        inline: false
      });
    });

    await safeReply(interaction, { embeds: [embed] });
  }

  private async handleHistory(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to view diplomatic history.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const limit = interaction.options.getInteger('limit') || 10;
    const events = dbManager.getDiplomaticEventsByNation(userLink.nationName, limit);

    if (events.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('📚 No Diplomatic History')
        .setDescription('Your nation has no recorded diplomatic events yet.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📚 Diplomatic History - ${userLink.nationName}`)
      .setDescription(`Showing ${events.length} most recent diplomatic events`)
      .setTimestamp();

    const eventIcons: Record<string, string> = {
      'request_submitted': '📤',
      'request_approved': '✅',
      'request_rejected': '❌',
      'relation_established': '🤝',
      'relation_terminated': '💔',
      'crisis_event': '⚠️',
      'trade_dispute': '⚖️',
      'diplomatic_incident': '🚨',
      'summit_meeting': '🏛️'
    };

    events.forEach((event, index) => {
      const createdAt = new Date(event.created_at);
      const icon = eventIcons[event.event_type] || '📋';
      const impactColor = event.impact_score > 0 ? '🟢' : event.impact_score < 0 ? '🔴' : '⚪';
      
      embed.addFields({
        name: `${index + 1}. ${icon} ${event.title}`,
        value: `🌍 ${event.country_full_name || event.international_country}\n📅 <t:${Math.floor(createdAt.getTime() / 1000)}:R> • ${impactColor} Impact: ${event.impact_score}\n${event.description}`,
        inline: false
      });
    });

    await safeReply(interaction, { embeds: [embed] });
  }

  private async handleCountries(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const continent = interaction.options.getString('continent');
    const countries = dbManager.getAllInternationalCountries();

    let filteredCountries = countries;
    if (continent) {
      filteredCountries = countries.filter(country => country.continent === continent);
    }

    if (filteredCountries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('🌍 No Countries Found')
        .setDescription(continent ? `No countries found in ${continent}.` : 'No countries available for diplomatic engagement.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    // Group by continent
    const continentGroups: Record<string, any[]> = {};
    filteredCountries.forEach(country => {
      if (!continentGroups[country.continent]) {
        continentGroups[country.continent] = [];
      }
      continentGroups[country.continent]!.push(country);
    });

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🌍 Available Countries for Diplomatic Engagement')
      .setDescription(continent ? `Countries in ${continent}` : `${filteredCountries.length} countries available across ${Object.keys(continentGroups).length} continents`)
      .setTimestamp();

    const continentEmojis: Record<string, string> = {
      'Africa': '🌍',
      'Asia': '🌏',
      'Europe': '🌎',
      'North America': '🌎',
      'South America': '🌎',
      'Oceania': '🌏'
    };

    for (const [continentName, continentCountries] of Object.entries(continentGroups)) {
      const emoji = continentEmojis[continentName] || '🌍';
      const countryList = continentCountries
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 10) // Limit to prevent embed size issues
        .map(country => `• **${country.name}** (${country.code}) - ${country.capital}`)
        .join('\n');

      embed.addFields({
        name: `${emoji} ${continentName} (${continentCountries.length})`,
        value: countryList + (continentCountries.length > 10 ? `\n... and ${continentCountries.length - 10} more` : ''),
        inline: false
      });
    }

    embed.setFooter({ text: 'Use /diplomacy request to engage with any of these countries' });

    await safeReply(interaction, { embeds: [embed] });
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'country') {
      await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
        const countries = dbManager.searchInternationalCountries(searchTerm, 25);
        return countries.map(country => ({
          name: `${country.name} (${country.code}) - ${country.capital}`,
          value: country.name
        }));
      });
    } else if (focusedOption.name === 'request_code') {
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.respond([]);
        return;
      }

      await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
        const requests = dbManager.getDiplomaticRequestsByNation(userLink.nationName, 25);
        return requests
          .filter(request => 
            request.request_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.target_country.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(request => ({
            name: `${request.request_code} - ${request.title} (${request.target_country})`,
            value: request.request_code
          }));
      });
    }
  }
}