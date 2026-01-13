import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class MultiAllianceCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('multi-alliance')
    .setDescription('Manage multi-nation alliances')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new multi-nation alliance')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the alliance')
            .setRequired(true)
            .setMaxLength(50))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the alliance')
            .setRequired(false)
            .setMaxLength(500)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all multi-nation alliances'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get information about a specific alliance')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to get info for')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Join a multi-nation alliance')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to join')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('Leave a multi-nation alliance')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to leave (optional if you\'re only in one)')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('invite')
        .setDescription('Invite a nation to your alliance (leaders only)')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to invite')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Remove a nation from your alliance (leaders only)')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to remove')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('transfer')
        .setDescription('Transfer alliance leadership (leaders only)')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to transfer leadership to')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disband')
        .setDescription('Disband your alliance (leaders only)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit alliance description (leaders only)')
        .addStringOption(option =>
          option.setName('description')
            .setDescription('New description for the alliance')
            .setRequired(true)
            .setMaxLength(500)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('rename')
        .setDescription('Rename your alliance (leaders only)')
        .addStringOption(option =>
          option.setName('new_name')
            .setDescription('New name for the alliance')
            .setRequired(true)
            .setMaxLength(50)));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this.handleCreate(interaction, dbManager, logger);
        break;
      case 'list':
        await this.handleList(interaction, dbManager, logger);
        break;
      case 'info':
        await this.handleInfo(interaction, dbManager, logger);
        break;
      case 'join':
        await this.handleJoin(interaction, dbManager, logger);
        break;
      case 'leave':
        await this.handleLeave(interaction, dbManager, logger);
        break;
      case 'invite':
        await this.handleInvite(interaction, dbManager, logger);
        break;
      case 'kick':
        await this.handleKick(interaction, dbManager, logger);
        break;
      case 'transfer':
        await this.handleTransfer(interaction, dbManager, logger);
        break;
      case 'disband':
        await this.handleDisband(interaction, dbManager, logger);
        break;
      case 'edit':
        await this.handleEdit(interaction, dbManager, logger);
        break;
      case 'rename':
        await this.handleRename(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to create alliances.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description') || '';

    try {
      // Check if alliance name already exists
      const existingAlliance = dbManager.getMultiAllianceByName(name);
      if (existingAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Already Exists')
          .setDescription(`An alliance named "${name}" already exists.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if nation is already in maximum alliances
      const currentAlliances = dbManager.getNationMultiAlliances(userLink.nationName);
      if (currentAlliances.length >= 2) {
        const allianceNames = currentAlliances.map(a => a.name).join('", "');
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Maximum Alliances Reached')
          .setDescription(`${userLink.nationName} is already in the maximum number of alliances (2): "${allianceNames}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create the alliance
      const allianceId = dbManager.createMultiAlliance(name, description, userLink.nationName, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🤝 Multi-Alliance Created')
        .setDescription(`Successfully created alliance "${name}"`)
        .addFields(
          { name: '👑 Leader Nation', value: userLink.nationName, inline: true },
          { name: '📋 Description', value: description || 'No description provided', inline: false }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Send admin notification
      try {
        const adminChannelId = '1457229969481531463';
        const adminRoleId = '1456867369111519335';
        const adminChannel = await interaction.client.channels.fetch(adminChannelId);
        
        if (adminChannel && adminChannel.isTextBased() && 'send' in adminChannel) {
          const guildName = interaction.guild?.name || 'Unknown Server';
          const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
          const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
          
          const adminEmbed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle('🤝 New Multi-Alliance Created')
            .setDescription(`A new multi-nation alliance has been created.`)
            .addFields(
              { name: '🏷️ Alliance Name', value: name, inline: true },
              { name: '👑 Leader Nation', value: userLink.nationName, inline: true },
              { name: '👤 Created By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '📋 Description', value: description || 'No description provided', inline: false },
              { name: '🌍 Server', value: guildName, inline: true },
              { name: '📍 Channel', value: channelName, inline: true },
              { name: '⏰ Time (EST)', value: timestamp, inline: true },
              { name: '🆔 Creator ID', value: interaction.user.id, inline: true },
              { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
              { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true },
              { name: '👥 Initial Members', value: '1 (Leader only)', inline: true },
              { name: '📊 Alliance Capacity', value: 'Unlimited members', inline: true }
            )
            .setFooter({ text: 'Alliance is now available for other nations to join' })
            .setTimestamp();

          await adminChannel.send({ 
            content: `<@&${adminRoleId}> New multi-alliance created!`,
            embeds: [adminEmbed] 
          });
        }
      } catch (error) {
        logger.warn('Failed to send admin notification for multi-alliance creation:', { error: error as Error });
      }

    } catch (error) {
      logger.error('Error creating multi-alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Alliance')
        .setDescription('An error occurred while creating the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    try {
      const alliances = dbManager.getAllMultiAlliances();

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🤝 Multi-Nation Alliances')
        .setTimestamp();

      if (alliances.length === 0) {
        embed.setDescription('No multi-nation alliances exist yet.');
      } else {
        const allianceList = alliances.map((alliance: any) => {
          const memberCount = alliance.memberCount || 0;
          const leaderName = alliance.leader_nation || alliance.leaderNation || 'Unknown';
          return `**${alliance.name}** - ${memberCount} member${memberCount === 1 ? '' : 's'} (Leader: ${leaderName})`;
        }).join('\n');

        embed.setDescription(`**Active Alliances (${alliances.length}):**\n${allianceList}`);
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing multi-alliances:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Listing Alliances')
        .setDescription('An error occurred while listing alliances. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleInfo(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const allianceName = interaction.options.getString('alliance', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const members = dbManager.getMultiAllianceMembers(alliance.id);
      const leaderName = alliance.leader_nation || alliance.leaderNation || 'Unknown';
      const memberList = members.map((member: any) => {
        const memberName = member.nation_name || member.nationName;
        const isLeader = memberName === leaderName;
        return `${isLeader ? '👑' : '🏛️'} **${memberName}**${isLeader ? ' (Leader)' : ''}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🤝 ${alliance.name}`)
        .setDescription(alliance.description || 'No description provided')
        .addFields(
          { name: '👑 Leader', value: leaderName, inline: true },
          { name: '👥 Members', value: `${members.length}`, inline: true },
          { name: '📅 Created', value: new Date(alliance.created_at || alliance.createdAt).toLocaleDateString(), inline: true },
          { name: '🏛️ Member Nations', value: memberList || 'No members', inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error getting alliance info:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Getting Alliance Info')
        .setDescription('An error occurred while getting alliance information. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleJoin(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to join alliances.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const allianceName = interaction.options.getString('alliance', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if nation is already in this specific alliance or at max capacity
      const currentAlliances = dbManager.getNationMultiAlliances(userLink.nationName);
      
      // Check if already in this specific alliance
      const alreadyInThisAlliance = currentAlliances.some(alliance => 
        (alliance.name || '').toLowerCase() === allianceName.toLowerCase()
      );
      
      if (alreadyInThisAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Already in This Alliance')
          .setDescription(`${userLink.nationName} is already a member of "${allianceName}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if at maximum capacity (2 alliances)
      if (currentAlliances.length >= 2) {
        const allianceNames = currentAlliances.map(a => a.name).join('", "');
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Maximum Alliances Reached')
          .setDescription(`${userLink.nationName} is already in the maximum number of alliances (2): "${allianceNames}". Leave an alliance first to join a new one.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Join the alliance
      try {
        dbManager.joinMultiAlliance(alliance.id, userLink.nationName, interaction.user.id);
      } catch (error) {
        // If the database method throws an error about alliance limits
        if (error instanceof Error) {
          if (error.message.includes('maximum number of alliances')) {
            const embed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('❌ Maximum Alliances Reached')
              .setDescription(error.message.replace(`Nation ${userLink.nationName} is already in the maximum number of alliances (2): `, `${userLink.nationName} is already in the maximum number of alliances (2): `))
              .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
          } else if (error.message.includes('already a member of')) {
            const embed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('❌ Already in This Alliance')
              .setDescription(error.message.replace(`Nation ${userLink.nationName} is already a member of`, `${userLink.nationName} is already a member of`))
              .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
          }
        }
        throw error; // Re-throw if it's a different error
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🤝 Joined Alliance')
        .setDescription(`**${userLink.nationName}** has successfully joined "${alliance.name}"`)
        .addFields(
          { name: '👑 Alliance Leader', value: alliance.leader_nation || alliance.leaderNation, inline: true }
        )
        .setFooter({ text: `Joined by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Send admin notification
      try {
        const adminChannelId = '1457229969481531463';
        const adminRoleId = '1456867369111519335';
        const adminChannel = await interaction.client.channels.fetch(adminChannelId);
        
        if (adminChannel && adminChannel.isTextBased() && 'send' in adminChannel) {
          const guildName = interaction.guild?.name || 'Unknown Server';
          const channelName = interaction.channel?.type === 0 ? `#${(interaction.channel as any).name}` : 'DM';
          const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
          
          // Get current member count
          const members = dbManager.getMultiAllianceMembers(alliance.id);
          const currentMemberCount = members.length;
          
          const adminEmbed = new EmbedBuilder()
            .setColor(0x9932cc)
            .setTitle('🤝 Nation Joined Multi-Alliance')
            .setDescription(`A nation has joined a multi-alliance.`)
            .addFields(
              { name: '🏛️ Nation', value: userLink.nationName, inline: true },
              { name: '🏷️ Alliance', value: alliance.name, inline: true },
              { name: '👤 Joined By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '👑 Alliance Leader', value: alliance.leader_nation || alliance.leaderNation, inline: true },
              { name: '👥 New Member Count', value: `${currentMemberCount + 1} members`, inline: true },
              { name: '🌍 Server', value: guildName, inline: true },
              { name: '📍 Channel', value: channelName, inline: true },
              { name: '⏰ Time (EST)', value: timestamp, inline: true },
              { name: '🆔 User ID', value: interaction.user.id, inline: true },
              { name: '🆔 Guild ID', value: interaction.guild?.id || 'N/A', inline: true },
              { name: '🆔 Channel ID', value: interaction.channel?.id || 'N/A', inline: true },
              { name: '📊 Nation Alliance Status', value: 'Now member of multi-alliance', inline: true }
            )
            .setFooter({ text: 'Nation successfully added to alliance roster' })
            .setTimestamp();

          await adminChannel.send({ 
            content: `<@&${adminRoleId}> Nation joined multi-alliance!`,
            embeds: [adminEmbed] 
          });
        }
      } catch (error) {
        logger.warn('Failed to send admin notification for multi-alliance join:', { error: error as Error });
      }

    } catch (error) {
      logger.error('Error joining alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Joining Alliance')
        .setDescription('An error occurred while joining the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleLeave(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to leave alliances.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    try {
      const currentAlliances = dbManager.getNationMultiAlliances(userLink.nationName);
      if (currentAlliances.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Any Alliance')
          .setDescription(`${userLink.nationName} is not a member of any multi-nation alliance.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const specifiedAlliance = interaction.options.getString('alliance');
      let allianceToLeave;
      
      if (specifiedAlliance) {
        // Find the specified alliance
        allianceToLeave = currentAlliances.find(alliance => 
          alliance.name.toLowerCase() === specifiedAlliance.toLowerCase()
        );
        
        if (!allianceToLeave) {
          const allianceNames = currentAlliances.map(a => a.name).join('", "');
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Not in Specified Alliance')
            .setDescription(`${userLink.nationName} is not a member of "${specifiedAlliance}". You are in: "${allianceNames}".`)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
      } else {
        // If no alliance specified and user is in multiple alliances, ask them to specify
        if (currentAlliances.length > 1) {
          const allianceNames = currentAlliances.map(a => a.name).join('", "');
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Multiple Alliances')
            .setDescription(`${userLink.nationName} is in multiple alliances: "${allianceNames}". Please specify which alliance to leave.`)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        
        // Only in one alliance, use that one
        allianceToLeave = currentAlliances[0];
      }

      // Check if user is the leader
      if ((allianceToLeave.leader_nation || allianceToLeave.leaderNation) === userLink.nationName) {
        const members = dbManager.getMultiAllianceMembers(allianceToLeave.id);
        if (members.length > 1) {
          // Transfer leadership to the member who joined earliest (excluding the leader)
          const otherMembers = members.filter(m => (m.nation_name || m.nationName) !== userLink.nationName);
          if (otherMembers.length > 0) {
            const newLeader = otherMembers.sort((a, b) => 
              new Date(a.joined_at || a.joinedAt).getTime() - new Date(b.joined_at || b.joinedAt).getTime()
            )[0];
            const newLeaderName = newLeader.nation_name || newLeader.nationName;
            
            // Transfer leadership first
            dbManager.transferMultiAllianceLeadership(allianceToLeave.id, newLeaderName);
            
            // Then remove the former leader
            dbManager.leaveMultiAlliance(userLink.nationName);

            const embed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('👑 Left Alliance & Leadership Transferred')
              .setDescription(`**${userLink.nationName}** has left "${allianceToLeave.name}" and leadership has been transferred`)
              .addFields(
                { name: '👑 New Leader', value: newLeaderName, inline: true }
              )
              .setFooter({ text: `Left by ${interaction.user.tag}` })
              .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
          }
        }
        
        // If we get here, the leader is the only member, so disband the alliance
        dbManager.disbandMultiAlliance(allianceToLeave.id);

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('💥 Alliance Disbanded')
          .setDescription(`**${userLink.nationName}** was the last member of "${allianceToLeave.name}", so the alliance has been disbanded`)
          .setFooter({ text: `Disbanded by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      // Leave the alliance
      dbManager.leaveMultiAlliance(userLink.nationName);
      
      // Clean up empty alliances
      dbManager.cleanupEmptyMultiAlliances();

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('👋 Left Alliance')
        .setDescription(`**${userLink.nationName}** has left "${allianceToLeave.name}"`)
        .setFooter({ text: `Left by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error leaving alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Leaving Alliance')
        .setDescription('An error occurred while leaving the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleInvite(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to invite others.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const targetNation = interaction.options.getString('nation', true);

    try {
      // Check if user's nation is in an alliance and is the leader
      const currentAlliance = dbManager.getNationMultiAlliance(userLink.nationName);
      if (!currentAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription('You must be in a multi-nation alliance to invite others.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const leaderName = currentAlliance.leader_nation || currentAlliance.leaderNation;
      if (leaderName !== userLink.nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Alliance Leader')
          .setDescription('Only the alliance leader can invite new members.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if target nation exists
      const targetNationData = dbManager.getNationByName(targetNation);
      if (!targetNationData) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${targetNation}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if target nation is already in maximum alliances
      const targetAlliances = dbManager.getNationMultiAlliances(targetNation);
      if (targetAlliances.length >= 2) {
        const allianceNames = targetAlliances.map(a => a.name).join('", "');
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Maximum Alliances Reached')
          .setDescription(`${targetNation} is already in the maximum number of alliances (2): "${allianceNames}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Add the nation to the alliance
      dbManager.joinMultiAlliance(currentAlliance.id, targetNation, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📨 Nation Invited')
        .setDescription(`**${targetNation}** has been added to "${currentAlliance.name}"`)
        .addFields(
          { name: '👑 Alliance Leader', value: leaderName, inline: true }
        )
        .setFooter({ text: `Invited by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error inviting to alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Inviting Nation')
        .setDescription('An error occurred while inviting the nation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleKick(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to kick members.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const targetNation = interaction.options.getString('nation', true);

    try {
      // Check if user's nation is in an alliance and is the leader
      const currentAlliance = dbManager.getNationMultiAlliance(userLink.nationName);
      if (!currentAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription('You must be in a multi-nation alliance to kick members.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const leaderName = currentAlliance.leader_nation || currentAlliance.leaderNation;
      const isAdmin = process.env.ADMIN_USER_IDS?.split(',').includes(interaction.user.id);
      
      if (leaderName !== userLink.nationName && !isAdmin) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Alliance Leader')
          .setDescription('Only the alliance leader or admins can kick members.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if target nation is in the same alliance
      const targetAlliance = dbManager.getNationMultiAlliance(targetNation);
      if (!targetAlliance || targetAlliance.id !== currentAlliance.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Same Alliance')
          .setDescription(`${targetNation} is not a member of "${currentAlliance.name}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Can't kick the leader
      if (targetNation === leaderName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Cannot Kick Leader')
          .setDescription('The alliance leader cannot be kicked. Transfer leadership first.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Remove the nation from the alliance
      dbManager.leaveMultiAlliance(targetNation);
      
      // Clean up empty alliances
      dbManager.cleanupEmptyMultiAlliances();

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('👢 Nation Kicked')
        .setDescription(`**${targetNation}** has been removed from "${currentAlliance.name}"`)
        .setFooter({ text: `Kicked by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error kicking from alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Kicking Nation')
        .setDescription('An error occurred while kicking the nation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleTransfer(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to transfer leadership.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const targetNation = interaction.options.getString('nation', true);

    try {
      // Check if user's nation is in an alliance and is the leader
      const currentAlliance = dbManager.getNationMultiAlliance(userLink.nationName);
      if (!currentAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription('You must be in a multi-nation alliance to transfer leadership.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const leaderName = currentAlliance.leader_nation || currentAlliance.leaderNation;
      const isAdmin = process.env.ADMIN_USER_IDS?.split(',').includes(interaction.user.id);
      
      if (leaderName !== userLink.nationName && !isAdmin) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Alliance Leader')
          .setDescription('Only the alliance leader or admins can transfer leadership.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if target nation is in the same alliance
      const targetAlliance = dbManager.getNationMultiAlliance(targetNation);
      if (!targetAlliance || targetAlliance.id !== currentAlliance.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Same Alliance')
          .setDescription(`${targetNation} is not a member of "${currentAlliance.name}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Transfer leadership
      dbManager.transferMultiAllianceLeadership(currentAlliance.id, targetNation);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('👑 Leadership Transferred')
        .setDescription(`Leadership of "${currentAlliance.name}" has been transferred`)
        .addFields(
          { name: '📤 From', value: leaderName, inline: true },
          { name: '📥 To', value: targetNation, inline: true }
        )
        .setFooter({ text: `Transferred by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error transferring alliance leadership:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Transferring Leadership')
        .setDescription('An error occurred while transferring leadership. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleDisband(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to disband alliances.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    try {
      // Check if user's nation is in an alliance and is the leader
      const currentAlliance = dbManager.getNationMultiAlliance(userLink.nationName);
      if (!currentAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription('You must be in a multi-nation alliance to disband it.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const leaderName = currentAlliance.leader_nation || currentAlliance.leaderNation;
      const isAdmin = process.env.ADMIN_USER_IDS?.split(',').includes(interaction.user.id);
      
      if (leaderName !== userLink.nationName && !isAdmin) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Alliance Leader')
          .setDescription('Only the alliance leader or admins can disband the alliance.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get member count for confirmation
      const members = dbManager.getMultiAllianceMembers(currentAlliance.id);

      // Disband the alliance
      dbManager.disbandMultiAlliance(currentAlliance.id);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💥 Alliance Disbanded')
        .setDescription(`"${currentAlliance.name}" has been disbanded`)
        .addFields(
          { name: '👥 Former Members', value: `${members.length}`, inline: true },
          { name: '👑 Former Leader', value: leaderName, inline: true }
        )
        .setFooter({ text: `Disbanded by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error disbanding alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Disbanding Alliance')
        .setDescription('An error occurred while disbanding the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleEdit(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to edit alliances.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const newDescription = interaction.options.getString('description', true);

    try {
      // Check if user's nation is in an alliance and is the leader
      const currentAlliance = dbManager.getNationMultiAlliance(userLink.nationName);
      if (!currentAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription('You must be in a multi-nation alliance to edit it.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const leaderName = currentAlliance.leader_nation || currentAlliance.leaderNation;
      const isAdmin = process.env.ADMIN_USER_IDS?.split(',').includes(interaction.user.id);
      
      if (leaderName !== userLink.nationName && !isAdmin) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Alliance Leader')
          .setDescription('Only the alliance leader or admins can edit the alliance.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Update the alliance description
      dbManager.updateMultiAllianceDescription(currentAlliance.id, newDescription);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✏️ Alliance Updated')
        .setDescription(`Successfully updated "${currentAlliance.name}"`)
        .addFields(
          { name: '📝 New Description', value: newDescription, inline: false }
        )
        .setFooter({ text: `Updated by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error editing alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Editing Alliance')
        .setDescription('An error occurred while editing the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleRename(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to rename alliances.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const newName = interaction.options.getString('new_name', true);

    try {
      // Check if user's nation is in an alliance and is the leader
      const currentAlliance = dbManager.getNationMultiAlliance(userLink.nationName);
      if (!currentAlliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription('You must be in a multi-nation alliance to rename it.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const leaderName = currentAlliance.leader_nation || currentAlliance.leaderNation;
      const isAdmin = process.env.ADMIN_USER_IDS?.split(',').includes(interaction.user.id);
      
      if (leaderName !== userLink.nationName && !isAdmin) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Alliance Leader')
          .setDescription('Only the alliance leader or admins can rename the alliance.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if new name already exists
      const existingAlliance = dbManager.getMultiAllianceByName(newName);
      if (existingAlliance && existingAlliance.id !== currentAlliance.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Name Already Taken')
          .setDescription(`An alliance named "${newName}" already exists.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Rename the alliance
      const stmt = (dbManager as any).db.prepare(`
        UPDATE multi_alliances 
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(newName, currentAlliance.id);

      dbManager.logAdminAction(interaction.user.id, 'RENAME_MULTI_ALLIANCE', `Renamed alliance "${currentAlliance.name}" to "${newName}"`);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✏️ Alliance Renamed')
        .setDescription(`Successfully renamed alliance`)
        .addFields(
          { name: '📤 Old Name', value: currentAlliance.name, inline: true },
          { name: '📥 New Name', value: newName, inline: true }
        )
        .setFooter({ text: `Renamed by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error renaming alliance:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Renaming Alliance')
        .setDescription('An error occurred while renaming the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // Additional methods would continue here...
  // I'll implement the rest in the next part due to length

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'alliance') {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'leave') {
        // For leave command, only show alliances the user is actually in
        const userLink = dbManager.getUserLink(interaction.user.id);
        if (userLink) {
          const userAlliances = dbManager.getNationMultiAlliances(userLink.nationName);
          const choices = userAlliances.slice(0, 25).map((alliance: any) => ({
            name: alliance.name,
            value: alliance.name
          }));
          await interaction.respond(choices);
        } else {
          await interaction.respond([]);
        }
      } else {
        // For other commands, show all alliances
        const alliances = dbManager.searchMultiAlliancesForAutocomplete(focusedOption.value);
        const choices = alliances.slice(0, 25).map((alliance: any) => ({
          name: alliance.name,
          value: alliance.name
        }));
        await interaction.respond(choices);
      }
    } else if (focusedOption.name === 'nation') {
      const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
      const choices = nations.slice(0, 25).map(nation => ({
        name: nation.name,
        value: nation.name
      }));
      
      await interaction.respond(choices);
    }
  }
}