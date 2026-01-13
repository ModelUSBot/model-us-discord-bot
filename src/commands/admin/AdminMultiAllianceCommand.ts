import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class AdminMultiAllianceCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('admin-multi-alliance')
    .setDescription('Admin management for multi-nation alliances')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a multi-alliance for any nation')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the alliance')
            .setRequired(true)
            .setMaxLength(50))
        .addStringOption(option =>
          option.setName('leader_nation')
            .setDescription('Nation to be the leader')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the alliance')
            .setRequired(false)
            .setMaxLength(500)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disband')
        .setDescription('Disband any multi-alliance')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to disband')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('transfer')
        .setDescription('Transfer alliance leadership')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to modify')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('new_leader')
            .setDescription('New leader nation')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add_member')
        .setDescription('Add a nation to an alliance')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to add to')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to add')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove_member')
        .setDescription('Remove a nation from an alliance')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to remove from')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to remove')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit alliance details')
        .addStringOption(option =>
          option.setName('alliance')
            .setDescription('Alliance to edit')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('New description')
            .setRequired(true)
            .setMaxLength(500)));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check admin permissions
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
    const permissions = new PermissionManager(adminUserIds, logger);
    const isAdmin = await permissions.isAdmin(interaction);

    if (!isAdmin) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Permission Denied')
        .setDescription('This command is only available to administrators.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this.handleCreate(interaction, dbManager, logger);
        break;
      case 'disband':
        await this.handleDisband(interaction, dbManager, logger);
        break;
      case 'transfer':
        await this.handleTransfer(interaction, dbManager, logger);
        break;
      case 'add_member':
        await this.handleAddMember(interaction, dbManager, logger);
        break;
      case 'remove_member':
        await this.handleRemoveMember(interaction, dbManager, logger);
        break;
      case 'edit':
        await this.handleEdit(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const name = interaction.options.getString('name', true);
    const leaderNation = interaction.options.getString('leader_nation', true);
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

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if nation exists
      const nation = dbManager.getNationByName(leaderNation);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${leaderNation}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if nation is already in maximum alliances
      const currentAlliances = dbManager.getNationMultiAlliances(leaderNation);
      if (currentAlliances.length >= 2) {
        const allianceNames = currentAlliances.map(a => a.name).join('", "');
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Maximum Alliances Reached')
          .setDescription(`${leaderNation} is already in the maximum number of alliances (2): "${allianceNames}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Create the alliance
      const allianceId = dbManager.createMultiAlliance(name, description, leaderNation, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🤝 Multi-Alliance Created (Admin)')
        .setDescription(`Successfully created alliance "${name}"`)
        .addFields(
          { name: '👑 Leader Nation', value: leaderNation, inline: true },
          { name: '📋 Description', value: description || 'No description provided', inline: false }
        )
        .setFooter({ text: `Created by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating multi-alliance (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Alliance')
        .setDescription('An error occurred while creating the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleDisband(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const allianceName = interaction.options.getString('alliance', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Get member count for confirmation
      const members = dbManager.getMultiAllianceMembers(alliance.id);
      const leaderName = alliance.leader_nation || alliance.leaderNation;

      // Disband the alliance
      dbManager.disbandMultiAlliance(alliance.id);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💥 Alliance Disbanded (Admin)')
        .setDescription(`"${alliance.name}" has been disbanded`)
        .addFields(
          { name: '👥 Former Members', value: `${members.length}`, inline: true },
          { name: '👑 Former Leader', value: leaderName, inline: true }
        )
        .setFooter({ text: `Disbanded by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error disbanding alliance (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Disbanding Alliance')
        .setDescription('An error occurred while disbanding the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleTransfer(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const allianceName = interaction.options.getString('alliance', true);
    const newLeader = interaction.options.getString('new_leader', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if new leader nation exists
      const targetNation = dbManager.getNationByName(newLeader);
      if (!targetNation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${newLeader}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if target nation is in the alliance
      const targetAlliance = dbManager.getNationMultiAlliance(newLeader);
      if (!targetAlliance || targetAlliance.id !== alliance.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription(`${newLeader} is not a member of "${alliance.name}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      const oldLeader = alliance.leader_nation || alliance.leaderNation;

      // Transfer leadership
      dbManager.transferMultiAllianceLeadership(alliance.id, newLeader);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('👑 Leadership Transferred (Admin)')
        .setDescription(`Leadership of "${alliance.name}" has been transferred`)
        .addFields(
          { name: '📤 From', value: oldLeader, inline: true },
          { name: '📥 To', value: newLeader, inline: true }
        )
        .setFooter({ text: `Transferred by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error transferring alliance leadership (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Transferring Leadership')
        .setDescription('An error occurred while transferring leadership. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleAddMember(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const allianceName = interaction.options.getString('alliance', true);
    const nationName = interaction.options.getString('nation', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if nation exists
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${nationName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if nation is already in maximum alliances
      const currentAlliances = dbManager.getNationMultiAlliances(nationName);
      if (currentAlliances.length >= 2) {
        const allianceNames = currentAlliances.map(a => a.name).join('", "');
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Maximum Alliances Reached')
          .setDescription(`${nationName} is already in the maximum number of alliances (2): "${allianceNames}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Add the nation to the alliance
      dbManager.joinMultiAlliance(alliance.id, nationName, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📨 Nation Added (Admin)')
        .setDescription(`**${nationName}** has been added to "${alliance.name}"`)
        .addFields(
          { name: '👑 Alliance Leader', value: alliance.leader_nation || alliance.leaderNation, inline: true }
        )
        .setFooter({ text: `Added by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error adding member to alliance (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Adding Member')
        .setDescription('An error occurred while adding the member. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRemoveMember(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const allianceName = interaction.options.getString('alliance', true);
    const nationName = interaction.options.getString('nation', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if nation is in the alliance
      const targetAlliance = dbManager.getNationMultiAlliance(nationName);
      if (!targetAlliance || targetAlliance.id !== alliance.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not in Alliance')
          .setDescription(`${nationName} is not a member of "${alliance.name}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      const leaderName = alliance.leader_nation || alliance.leaderNation;

      // If removing the leader, handle leadership transfer or disbanding
      if (nationName === leaderName) {
        const members = dbManager.getMultiAllianceMembers(alliance.id);
        const otherMembers = members.filter(m => (m.nation_name || m.nationName) !== nationName);
        
        if (otherMembers.length > 0) {
          // Transfer leadership to the member who joined earliest
          const newLeader = otherMembers.sort((a, b) => 
            new Date(a.joined_at || a.joinedAt).getTime() - new Date(b.joined_at || b.joinedAt).getTime()
          )[0];
          const newLeaderName = newLeader.nation_name || newLeader.nationName;
          
          dbManager.transferMultiAllianceLeadership(alliance.id, newLeaderName);
          dbManager.leaveMultiAlliance(nationName);

          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('👑 Leader Removed & Transferred (Admin)')
            .setDescription(`**${nationName}** has been removed from "${alliance.name}" and leadership transferred`)
            .addFields(
              { name: '📤 Former Leader', value: nationName, inline: true },
              { name: '👑 New Leader', value: newLeaderName, inline: true }
            )
            .setFooter({ text: `Removed by Admin: ${interaction.user.tag}` })
            .setTimestamp();

          await interaction.reply({ embeds: [embed] });
        } else {
          // No other members, disband the alliance
          dbManager.disbandMultiAlliance(alliance.id);

          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('💥 Alliance Disbanded (Admin)')
            .setDescription(`**${nationName}** was the last member of "${alliance.name}", so the alliance has been disbanded`)
            .setFooter({ text: `Disbanded by Admin: ${interaction.user.tag}` })
            .setTimestamp();

          await interaction.reply({ embeds: [embed] });
        }
      } else {
        // Remove regular member
        dbManager.leaveMultiAlliance(nationName);
        
        // Clean up empty alliances
        dbManager.cleanupEmptyMultiAlliances();

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('👢 Member Removed (Admin)')
          .setDescription(`**${nationName}** has been removed from "${alliance.name}"`)
          .setFooter({ text: `Removed by Admin: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error('Error removing member from alliance (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Removing Member')
        .setDescription('An error occurred while removing the member. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleEdit(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const allianceName = interaction.options.getString('alliance', true);
    const newDescription = interaction.options.getString('description', true);

    try {
      const alliance = dbManager.getMultiAllianceByName(allianceName);
      if (!alliance) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Alliance Not Found')
          .setDescription(`Alliance "${allianceName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Update the alliance description
      dbManager.updateMultiAllianceDescription(alliance.id, newDescription);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✏️ Alliance Updated (Admin)')
        .setDescription(`Successfully updated "${alliance.name}"`)
        .addFields(
          { name: '📝 New Description', value: newDescription, inline: false }
        )
        .setFooter({ text: `Updated by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error editing alliance (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Editing Alliance')
        .setDescription('An error occurred while editing the alliance. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'alliance') {
      const alliances = dbManager.searchMultiAlliancesForAutocomplete(focusedOption.value);
      const choices = alliances.slice(0, 25).map((alliance: any) => ({
        name: alliance.name,
        value: alliance.name
      }));
      
      await interaction.respond(choices);
    } else if (focusedOption.name === 'leader_nation' || focusedOption.name === 'new_leader' || focusedOption.name === 'nation') {
      const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
      const choices = nations.slice(0, 25).map(nation => ({
        name: nation.name,
        value: nation.name
      }));
      
      await interaction.respond(choices);
    }
  }
}