import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { handleCommandError, handleAutocomplete, checkCooldown, safeReply } from '../../utils/CommandUtils';

export class AdminDiplomacyCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-diplomacy')
    .setDescription('Admin tools for managing international diplomatic requests')
    .addSubcommand(subcommand =>
      subcommand
        .setName('review')
        .setDescription('Review and approve/reject a diplomatic request')
        .addStringOption(option =>
          option.setName('request_code')
            .setDescription('Diplomatic request code to review')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('decision')
            .setDescription('Approve or reject the request')
            .setRequired(true)
            .addChoices(
              { name: '✅ Approve', value: 'approved' },
              { name: '❌ Reject', value: 'rejected' }
            ))
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Admin notes explaining the decision')
            .setRequired(false)
            .setMaxLength(500)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('accept-all')
        .setDescription('Accept all pending diplomatic requests')
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Admin notes for all approvals')
            .setRequired(false)
            .setMaxLength(500)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('deny-all')
        .setDescription('Deny all pending diplomatic requests')
        .addStringOption(option =>
          option.setName('notes')
            .setDescription('Admin notes for all rejections')
            .setRequired(false)
            .setMaxLength(500)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pending')
        .setDescription('View all pending diplomatic requests')
        .addStringOption(option =>
          option.setName('priority')
            .setDescription('Filter by priority level')
            .setRequired(false)
            .addChoices(
              { name: '🔴 Urgent', value: 'urgent' },
              { name: '🟠 High', value: 'high' },
              { name: '🟡 Normal', value: 'normal' },
              { name: '🟢 Low', value: 'low' }
            ))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of requests to show (default: 10, max: 25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-country')
        .setDescription('Add a new country for diplomatic engagement')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Full country name')
            .setRequired(true)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('code')
            .setDescription('ISO country code (e.g., US, CA, GB)')
            .setRequired(true)
            .setMaxLength(3))
        .addStringOption(option =>
          option.setName('continent')
            .setDescription('Continent')
            .setRequired(true)
            .addChoices(
              { name: '🌍 Africa', value: 'Africa' },
              { name: '🌏 Asia', value: 'Asia' },
              { name: '🌎 Europe', value: 'Europe' },
              { name: '🌎 North America', value: 'North America' },
              { name: '🌎 South America', value: 'South America' },
              { name: '🌏 Oceania', value: 'Oceania' }
            ))
        .addStringOption(option =>
          option.setName('capital')
            .setDescription('Capital city')
            .setRequired(true)
            .setMaxLength(100))
        .addIntegerOption(option =>
          option.setName('population')
            .setDescription('Population (in millions)')
            .setRequired(false)
            .setMinValue(1))
        .addNumberOption(option =>
          option.setName('gdp')
            .setDescription('GDP in USD billions')
            .setRequired(false)
            .setMinValue(0.1))
        .addStringOption(option =>
          option.setName('government')
            .setDescription('Government type')
            .setRequired(false)
            .setMaxLength(50))
        .addStringOption(option =>
          option.setName('leader')
            .setDescription('Head of state/government')
            .setRequired(false)
            .setMaxLength(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('relations')
        .setDescription('View all active diplomatic relations')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Filter by US nation')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('country')
            .setDescription('Filter by international country')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View diplomatic system statistics'));

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Check cooldown
    if (!(await checkCooldown(interaction, 2000))) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'review':
          await this.handleReview(interaction, dbManager, logger);
          break;
        case 'accept-all':
          await this.handleAcceptAll(interaction, dbManager, logger);
          break;
        case 'deny-all':
          await this.handleDenyAll(interaction, dbManager, logger);
          break;
        case 'pending':
          await this.handlePending(interaction, dbManager, logger);
          break;
        case 'add-country':
          await this.handleAddCountry(interaction, dbManager, logger);
          break;
        case 'relations':
          await this.handleRelations(interaction, dbManager, logger);
          break;
        case 'stats':
          await this.handleStats(interaction, dbManager, logger);
          break;
        default:
          await safeReply(interaction, { content: '❌ Unknown subcommand.' }, true);
      }
    } catch (error) {
      await handleCommandError(interaction, error as Error, logger, 'admin-diplomacy');
    }
  }

  private async handleReview(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const requestCode = interaction.options.getString('request_code', true);
    const decision = interaction.options.getString('decision', true) as 'approved' | 'rejected';
    const notes = interaction.options.getString('notes') || '';

    const request = dbManager.getDiplomaticRequestByCode(requestCode);
    if (!request) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Request Not Found')
        .setDescription(`Diplomatic request "${requestCode}" not found.`)
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    if (request.status !== 'pending') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Request Already Processed')
        .setDescription(`This request has already been ${request.status}.`)
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const success = dbManager.reviewDiplomaticRequest(requestCode, interaction.user.id, decision, notes);

    if (!success) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Review Failed')
        .setDescription('Failed to process the diplomatic request. Please try again.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(decision === 'approved' ? 0x00ff00 : 0xff0000)
      .setTitle(`${decision === 'approved' ? '✅' : '❌'} Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`)
      .setDescription(`Diplomatic request **${requestCode}** has been ${decision}.`)
      .addFields(
        { name: '🏛️ Requesting Nation', value: request.requesting_nation, inline: true },
        { name: '🌍 Target Country', value: request.target_country, inline: true },
        { name: '📋 Request Type', value: request.request_type.replace('_', ' ').toUpperCase(), inline: true },
        { name: '📝 Title', value: request.title, inline: false }
      )
      .setFooter({ text: `Reviewed by ${interaction.user.tag}` })
      .setTimestamp();

    if (notes) {
      embed.addFields({ name: '📝 Admin Notes', value: notes, inline: false });
    }

    await safeReply(interaction, { embeds: [embed] });

    // Notify the requesting user via DM
    try {
      const requestingUser = await interaction.client.users.fetch(request.requested_by);
      if (requestingUser) {
        const userEmbed = new EmbedBuilder()
          .setColor(decision === 'approved' ? 0x00ff00 : 0xff0000)
          .setTitle(`${decision === 'approved' ? '🎉' : '💔'} Diplomatic Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`)
          .setDescription(`Your diplomatic request **${requestCode}** has been ${decision} by an administrator.`)
          .addFields(
            { name: '🏛️ Your Nation', value: request.requesting_nation, inline: true },
            { name: '🌍 Target Country', value: request.target_country, inline: true },
            { name: '📋 Request Type', value: request.request_type.replace('_', ' ').toUpperCase(), inline: true },
            { name: '⚡ Priority Level', value: `${request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}`, inline: true },
            { name: '📅 Decision Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            { name: '👤 Reviewed By', value: `Admin: ${interaction.user.tag}`, inline: true },
            { name: '📝 Original Title', value: request.title, inline: false }
          )
          .setTimestamp();

        if (request.description && request.description.length > 0) {
          userEmbed.addFields({ 
            name: '📄 Your Original Request', 
            value: request.description.length > 300 ? request.description.substring(0, 300) + '...' : request.description, 
            inline: false 
          });
        }

        if (notes) {
          userEmbed.addFields({ name: '📝 Admin Notes', value: notes, inline: false });
        }

        if (decision === 'approved') {
          userEmbed.addFields({
            name: '🎉 Congratulations!',
            value: `Your diplomatic relation with **${request.target_country}** has been established! This opens up new opportunities for your nation.`,
            inline: false
          });
          userEmbed.addFields({
            name: '📋 What\'s Next?',
            value: '• Use `/international-relations status` to view your active relations\n• Consider establishing trade agreements or cultural exchanges\n• Monitor your diplomatic standing with other nations\n• Explore additional diplomatic opportunities',
            inline: false
          });
        } else {
          userEmbed.addFields({
            name: '💡 Moving Forward',
            value: 'Don\'t be discouraged! You can:\n• Review the admin notes for guidance\n• Consider revising your approach\n• Submit new requests with different countries\n• Focus on building your nation\'s reputation',
            inline: false
          });
        }

        userEmbed.setFooter({ 
          text: decision === 'approved' 
            ? 'Welcome to international diplomacy!' 
            : 'Keep building your diplomatic relationships!' 
        });

        await requestingUser.send({ embeds: [userEmbed] });
        
        logger.info(`DM notification sent to user for diplomatic request ${decision}`, {
          metadata: {
            userId: request.requested_by,
            requestCode,
            decision,
            targetCountry: request.target_country
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to notify user about diplomatic request decision:', { 
        error: error as Error,
        metadata: {
          userId: request.requested_by,
          requestCode,
          decision
        }
      });
      
      // Try to notify in the channel if DM fails
      try {
        const fallbackEmbed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('⚠️ DM Notification Failed')
          .setDescription(`Could not send DM to <@${request.requested_by}> about request **${requestCode}**. Please check your DM settings.`)
          .setTimestamp();
        
        await interaction.followUp({ embeds: [fallbackEmbed], ephemeral: true });
      } catch (followUpError) {
        logger.error('Failed to send fallback notification:', { error: followUpError as Error });
      }
    }

    logger.info(`Diplomatic request ${decision}: ${requestCode}`, {
      user: interaction.user.id,
      metadata: {
        requestCode,
        decision,
        requestingNation: request.requesting_nation,
        targetCountry: request.target_country
      }
    });
  }

  private async handleAcceptAll(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const notes = interaction.options.getString('notes') || 'Bulk approval by admin';

    const pendingRequests = dbManager.getDiplomaticRequestsByStatus('pending', 100);

    if (pendingRequests.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ No Pending Requests')
        .setDescription('There are no pending diplomatic requests to approve.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const request of pendingRequests) {
      const success = dbManager.reviewDiplomaticRequest(request.request_code, interaction.user.id, 'approved', notes);
      if (success) {
        successCount++;
        
        // Try to notify the requesting user
        try {
          const requestingUser = await interaction.client.users.fetch(request.requested_by);
          if (requestingUser) {
            const userEmbed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('🎉 Diplomatic Request Approved')
              .setDescription(`Your diplomatic request **${request.request_code}** has been approved by an administrator.`)
              .addFields(
                { name: '🏛️ Your Nation', value: request.requesting_nation, inline: true },
                { name: '🌍 Target Country', value: request.target_country, inline: true },
                { name: '📋 Request Type', value: request.request_type.replace('_', ' ').toUpperCase(), inline: true },
                { name: '📝 Title', value: request.title, inline: false }
              )
              .setFooter({ text: 'Bulk approval by admin' })
              .setTimestamp();

            if (notes && notes !== 'Bulk approval by admin') {
              userEmbed.addFields({ name: '📝 Admin Notes', value: notes, inline: false });
            }

            await requestingUser.send({ embeds: [userEmbed] });
          }
        } catch (error) {
          logger.warn(`Failed to notify user about bulk approval: ${request.requested_by}`, { error: error as Error });
        }
      } else {
        failCount++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(successCount > 0 ? 0x00ff00 : 0xff0000)
      .setTitle('📋 Bulk Approval Results')
      .setDescription(`Processed ${pendingRequests.length} pending diplomatic requests`)
      .addFields(
        { name: '✅ Approved', value: successCount.toString(), inline: true },
        { name: '❌ Failed', value: failCount.toString(), inline: true },
        { name: '📊 Total', value: pendingRequests.length.toString(), inline: true }
      )
      .setFooter({ text: `Bulk approval by ${interaction.user.tag}` })
      .setTimestamp();

    if (notes && notes !== 'Bulk approval by admin') {
      embed.addFields({ name: '📝 Admin Notes', value: notes, inline: false });
    }

    await safeReply(interaction, { embeds: [embed] });

    logger.info(`Bulk diplomatic approval completed`, {
      user: interaction.user.id,
      metadata: {
        totalRequests: pendingRequests.length,
        successCount,
        failCount
      }
    });
  }

  private async handleDenyAll(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const notes = interaction.options.getString('notes') || 'Bulk rejection by admin';

    const pendingRequests = dbManager.getDiplomaticRequestsByStatus('pending', 100);

    if (pendingRequests.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ No Pending Requests')
        .setDescription('There are no pending diplomatic requests to reject.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const request of pendingRequests) {
      const success = dbManager.reviewDiplomaticRequest(request.request_code, interaction.user.id, 'rejected', notes);
      if (success) {
        successCount++;
        
        // Try to notify the requesting user
        try {
          const requestingUser = await interaction.client.users.fetch(request.requested_by);
          if (requestingUser) {
            const userEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('💔 Diplomatic Request Rejected')
              .setDescription(`Your diplomatic request **${request.request_code}** has been rejected by an administrator.`)
              .addFields(
                { name: '🏛️ Your Nation', value: request.requesting_nation, inline: true },
                { name: '🌍 Target Country', value: request.target_country, inline: true },
                { name: '📋 Request Type', value: request.request_type.replace('_', ' ').toUpperCase(), inline: true },
                { name: '📝 Title', value: request.title, inline: false }
              )
              .setFooter({ text: 'Bulk rejection by admin' })
              .setTimestamp();

            if (notes && notes !== 'Bulk rejection by admin') {
              userEmbed.addFields({ name: '📝 Admin Notes', value: notes, inline: false });
            }

            await requestingUser.send({ embeds: [userEmbed] });
          }
        } catch (error) {
          logger.warn(`Failed to notify user about bulk rejection: ${request.requested_by}`, { error: error as Error });
        }
      } else {
        failCount++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(successCount > 0 ? 0xff0000 : 0x666666)
      .setTitle('📋 Bulk Rejection Results')
      .setDescription(`Processed ${pendingRequests.length} pending diplomatic requests`)
      .addFields(
        { name: '❌ Rejected', value: successCount.toString(), inline: true },
        { name: '⚠️ Failed', value: failCount.toString(), inline: true },
        { name: '📊 Total', value: pendingRequests.length.toString(), inline: true }
      )
      .setFooter({ text: `Bulk rejection by ${interaction.user.tag}` })
      .setTimestamp();

    if (notes && notes !== 'Bulk rejection by admin') {
      embed.addFields({ name: '📝 Admin Notes', value: notes, inline: false });
    }

    await safeReply(interaction, { embeds: [embed] });

    logger.info(`Bulk diplomatic rejection completed`, {
      user: interaction.user.id,
      metadata: {
        totalRequests: pendingRequests.length,
        successCount,
        failCount
      }
    });
  }

  private async handlePending(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const priority = interaction.options.getString('priority');
    const limit = interaction.options.getInteger('limit') || 10;

    const requests = dbManager.getDiplomaticRequestsByStatus('pending', limit);

    let filteredRequests = requests;
    if (priority) {
      filteredRequests = requests.filter(request => request.priority === priority);
    }

    if (filteredRequests.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ No Pending Requests')
        .setDescription(priority ? `No pending ${priority} priority requests found.` : 'No pending diplomatic requests found.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle('📋 Pending Diplomatic Requests')
      .setDescription(`${filteredRequests.length} pending request${filteredRequests.length === 1 ? '' : 's'} requiring admin review`)
      .setTimestamp();

    const priorityIcons: Record<string, string> = {
      'urgent': '🔴',
      'high': '🟠',
      'normal': '🟡',
      'low': '🟢'
    };

    filteredRequests.forEach((request, index) => {
      const createdAt = new Date(request.created_at);
      const expiresAt = new Date(request.expires_at);
      const icon = priorityIcons[request.priority] || '🟡';
      
      embed.addFields({
        name: `${index + 1}. ${request.request_code} - ${icon} ${request.priority.toUpperCase()}`,
        value: `**${request.title}**\n🏛️ ${request.requesting_nation} → 🌍 ${request.target_country}\n📋 ${request.request_type.replace('_', ' ').toUpperCase()}\n📅 <t:${Math.floor(createdAt.getTime() / 1000)}:R> • ⏳ Expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
        inline: false
      });
    });

    embed.setFooter({ text: 'Use /admin-diplomacy review <request_code> to process requests' });

    await safeReply(interaction, { embeds: [embed] });
  }

  private async handleAddCountry(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const name = interaction.options.getString('name', true);
    const code = interaction.options.getString('code', true).toUpperCase();
    const continent = interaction.options.getString('continent', true);
    const capital = interaction.options.getString('capital', true);
    const population = interaction.options.getInteger('population') || 0;
    const gdp = interaction.options.getNumber('gdp') || 0;
    const government = interaction.options.getString('government') || 'Unknown';
    const leader = interaction.options.getString('leader') || 'Unknown';

    const success = dbManager.createInternationalCountry(
      name, code, continent, '', capital, population * 1000000, gdp, government, leader
    );

    if (!success) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Failed to Add Country')
        .setDescription('Failed to add the country. It may already exist or there was a database error.')
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] }, true);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Country Added Successfully')
      .setDescription(`**${name}** has been added to the diplomatic system.`)
      .addFields(
        { name: '🌍 Country', value: `${name} (${code})`, inline: true },
        { name: '🌎 Continent', value: continent, inline: true },
        { name: '🏛️ Capital', value: capital, inline: true },
        { name: '👥 Population', value: population > 0 ? `${population} million` : 'Unknown', inline: true },
        { name: '💰 GDP', value: gdp > 0 ? `$${gdp}B USD` : 'Unknown', inline: true },
        { name: '🏛️ Government', value: government, inline: true },
        { name: '👤 Leader', value: leader, inline: false }
      )
      .setFooter({ text: `Added by ${interaction.user.tag}` })
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });

    logger.info(`International country added: ${name} (${code})`, {
      user: interaction.user.id,
      metadata: {
        name,
        code,
        continent,
        capital
      }
    });
  }

  private async handleRelations(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // This would require additional database methods to get all relations
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🌍 Diplomatic Relations Overview')
      .setDescription('This feature is under development. Use individual nation commands to view specific relations.')
      .setTimestamp();

    await safeReply(interaction, { embeds: [embed] });
  }

  private async handleStats(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    // Get statistics from the database
    const countries = dbManager.getAllInternationalCountries();
    const pendingRequests = dbManager.getDiplomaticRequestsByStatus('pending', 100);
    const approvedRequests = dbManager.getDiplomaticRequestsByStatus('approved', 100);
    const rejectedRequests = dbManager.getDiplomaticRequestsByStatus('rejected', 100);

    // Group countries by continent
    const continentCounts: Record<string, number> = {};
    countries.forEach(country => {
      continentCounts[country.continent] = (continentCounts[country.continent] || 0) + 1;
    });

    // Group requests by type
    const requestTypeCounts: Record<string, number> = {};
    [...pendingRequests, ...approvedRequests, ...rejectedRequests].forEach(request => {
      requestTypeCounts[request.request_type] = (requestTypeCounts[request.request_type] || 0) + 1;
    });

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Diplomatic System Statistics')
      .setDescription('Overview of the international relations system')
      .addFields(
        { name: '🌍 Total Countries', value: countries.length.toString(), inline: true },
        { name: '📋 Pending Requests', value: pendingRequests.length.toString(), inline: true },
        { name: '✅ Approved Requests', value: approvedRequests.length.toString(), inline: true },
        { name: '❌ Rejected Requests', value: rejectedRequests.length.toString(), inline: true },
        { name: '📈 Total Requests', value: (pendingRequests.length + approvedRequests.length + rejectedRequests.length).toString(), inline: true },
        { name: '📊 Approval Rate', value: approvedRequests.length > 0 ? `${Math.round((approvedRequests.length / (approvedRequests.length + rejectedRequests.length)) * 100)}%` : '0%', inline: true }
      )
      .setTimestamp();

    // Add continent breakdown
    if (Object.keys(continentCounts).length > 0) {
      const continentList = Object.entries(continentCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([continent, count]) => `• ${continent}: ${count}`)
        .join('\n');
      
      embed.addFields({
        name: '🌎 Countries by Continent',
        value: continentList,
        inline: true
      });
    }

    // Add top request types
    if (Object.keys(requestTypeCounts).length > 0) {
      const typeList = Object.entries(requestTypeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => `• ${type.replace('_', ' ')}: ${count}`)
        .join('\n');
      
      embed.addFields({
        name: '📋 Top Request Types',
        value: typeList,
        inline: true
      });
    }

    await safeReply(interaction, { embeds: [embed] });
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'request_code') {
      await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
        const requests = dbManager.getDiplomaticRequestsByStatus('pending', 25);
        return requests
          .filter(request => 
            request.request_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.requesting_nation.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(request => ({
            name: `${request.request_code} - ${request.title} (${request.requesting_nation})`,
            value: request.request_code
          }));
      });
    } else if (focusedOption.name === 'nation') {
      await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
        const nations = dbManager.getAllNations();
        return nations
          .filter(nation => nation.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .slice(0, 25)
          .map(nation => ({
            name: nation.name,
            value: nation.name
          }));
      });
    } else if (focusedOption.name === 'country') {
      await handleAutocomplete(interaction, dbManager, logger, (searchTerm) => {
        const countries = dbManager.searchInternationalCountries(searchTerm, 25);
        return countries.map(country => ({
          name: `${country.name} (${country.code})`,
          value: country.name
        }));
      });
    }
  }
}