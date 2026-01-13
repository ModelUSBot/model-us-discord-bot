import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class LawCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('law')
    .setDescription('Manage laws for your nation')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Create a new law')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the law')
            .setRequired(true)
            .setMaxLength(100))
        .addStringOption(option =>
          option.setName('text')
            .setDescription('Text content of the law')
            .setRequired(true)
            .setMaxLength(2000))
        .addStringOption(option =>
          option.setName('tags')
            .setDescription('Tags for the law (comma-separated, at least one required)')
            .setRequired(true)
            .setAutocomplete(true))
        .addBooleanOption(option =>
          option.setName('public')
            .setDescription('Whether this law is public (default: true)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List laws (shows all public laws, or all laws for admins)')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Filter by nation (optional)')
            .setRequired(false)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Filter by tag (optional)')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('read')
        .setDescription('Read a specific law')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to read')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit one of your laws')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to edit')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('new_text')
            .setDescription('New text for the law')
            .setRequired(true)
            .setMaxLength(2000))
        .addStringOption(option =>
          option.setName('tags')
            .setDescription('New tags for the law (comma-separated, optional)')
            .setRequired(false)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('rename')
        .setDescription('Rename one of your laws')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to rename')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('new_name')
            .setDescription('New name for the law')
            .setRequired(true)
            .setMaxLength(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete one of your laws')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to delete')
            .setRequired(true)
            .setAutocomplete(true)));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await this.handleAdd(interaction, dbManager, logger);
        break;
      case 'list':
        await this.handleList(interaction, dbManager, logger);
        break;
      case 'read':
        await this.handleRead(interaction, dbManager, logger);
        break;
      case 'edit':
        await this.handleEdit(interaction, dbManager, logger);
        break;
      case 'rename':
        await this.handleRename(interaction, dbManager, logger);
        break;
      case 'delete':
        await this.handleDelete(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleAdd(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to create laws. Ask an admin to link your nation first.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const name = interaction.options.getString('name', true);
    const text = interaction.options.getString('text', true);
    const tagsString = interaction.options.getString('tags', true);
    const isPublic = interaction.options.getBoolean('public') ?? true;

    // Parse tags
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    if (tags.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Tags Required')
        .setDescription('You must provide at least one tag for the law.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      // Check if law name already exists for this nation
      const existingLaw = dbManager.getLawByName(name, userLink.nationName);
      if (existingLaw) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Already Exists')
          .setDescription(`A law named "${name}" already exists for ${userLink.nationName}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Create the law with tags
      const law = dbManager.createLaw(name, text, isPublic, userLink.nationName, interaction.user.id, tags);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Create Law')
          .setDescription('An error occurred while creating the law. Please try again.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📜 Law Created')
        .setDescription(`Successfully created ${isPublic ? 'public' : 'private'} law for **${userLink.nationName}**`)
        .addFields(
          { name: '📋 Law Name', value: name, inline: true },
          { name: '👁️ Visibility', value: isPublic ? 'Public' : 'Private', inline: true },
          { name: '🏷️ Tags', value: tags.join(', '), inline: true },
          { name: '📝 Text Preview', value: text.length > 100 ? text.substring(0, 100) + '...' : text, inline: false }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating law:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Law')
        .setDescription('An error occurred while creating the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const nationFilter = interaction.options.getString('nation');
    const tagFilter = interaction.options.getString('tag');

    try {
      // Check if user is admin
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);

      // Get laws based on filters
      const searchOptions: any = {
        requestingUser: interaction.user.id
      };
      
      if (nationFilter) searchOptions.nationName = nationFilter;
      if (tagFilter) searchOptions.tagName = tagFilter;
      if (!isAdmin) searchOptions.isPublic = true; // Non-admins see only public laws
      
      const laws = dbManager.searchLaws(searchOptions);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📜 Laws Database')
        .setTimestamp();

      if (laws.length === 0) {
        let description = 'No laws found';
        if (nationFilter) description += ` for nation "${nationFilter}"`;
        if (tagFilter) description += ` with tag "${tagFilter}"`;
        embed.setDescription(description + '.');
      } else {
        // Group laws by nation for better organization
        const lawsByNation: { [key: string]: any[] } = {};
        laws.forEach((law: any) => {
          const nationName = law.nationName || law.nation_name;
          if (!lawsByNation[nationName]) {
            lawsByNation[nationName] = [];
          }
          lawsByNation[nationName].push(law);
        });

        // Sort nations alphabetically
        const sortedNations = Object.keys(lawsByNation).sort();
        
        let description = '';
        let totalLaws = 0;
        
        for (const nationName of sortedNations.slice(0, 10)) { // Limit to 10 nations for readability
          const nationLaws = lawsByNation[nationName];
          if (!nationLaws) continue; // Skip if no laws (shouldn't happen but for safety)
          
          totalLaws += nationLaws.length;
          
          description += `\n**🏛️ ${nationName}** (${nationLaws.length} law${nationLaws.length === 1 ? '' : 's'})\n`;
          
          const lawList = nationLaws.slice(0, 5).map((law: any) => { // Limit to 5 laws per nation
            const visibility = law.isPublic || law.is_public ? '🌍' : '🔒';
            const edited = law.editedAt || law.edited_at ? ' ✏️' : '';
            const tags = law.tags && law.tags.length > 0 
              ? ` \`${law.tags.map((t: any) => t.name).join(', ')}\`` 
              : '';
            return `  ${visibility} ${law.name}${edited}${tags}`;
          }).join('\n');
          
          description += lawList;
          
          if (nationLaws.length > 5) {
            description += `\n  *... and ${nationLaws.length - 5} more*`;
          }
          description += '\n';
        }

        if (sortedNations.length > 10) {
          description += `\n*... and ${sortedNations.length - 10} more nations*`;
        }

        embed.setDescription(description);
        
        // Add summary field
        embed.addFields({
          name: '📊 Summary',
          value: `**${totalLaws}** total laws from **${sortedNations.length}** nation${sortedNations.length === 1 ? '' : 's'}`,
          inline: false
        });

        // Add legend
        embed.addFields(
          { name: '🌍 Public', value: 'Visible to all', inline: true },
          { name: '🔒 Private', value: 'Nation & admins only', inline: true },
          { name: '✏️ Edited', value: 'Modified after creation', inline: true }
        );

        if (nationFilter) {
          embed.addFields({ name: '🎯 Nation Filter', value: nationFilter, inline: true });
        }
        if (tagFilter) {
          embed.addFields({ name: '🏷️ Tag Filter', value: tagFilter, inline: true });
        }
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing laws:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Listing Laws')
        .setDescription('An error occurred while listing laws. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRead(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const lawName = interaction.options.getString('law', true);

    try {
      // First try to find the law by exact name
      let law = dbManager.getLawByNameGlobal(lawName);
      
      // If not found, try to find by partial match
      if (!law) {
        const allLaws = dbManager.getAllLaws();
        const matchingLaws = allLaws.filter((l: any) => 
          l.name.toLowerCase().includes(lawName.toLowerCase())
        );
        
        if (matchingLaws.length === 1) {
          law = matchingLaws[0];
        } else if (matchingLaws.length > 1) {
          const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('🔍 Multiple Laws Found')
            .setDescription(`Found ${matchingLaws.length} laws matching "${lawName}":\n\n` +
              matchingLaws.slice(0, 10).map((l: any) => `• **${l.name}** (${l.nation_name})`).join('\n'))
            .setFooter({ text: 'Please be more specific with the law name.' })
            .setTimestamp();

          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
          return;
        }
      }
      
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`Law "${lawName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Normalize law object (handle both database formats)
      const normalizedLaw = {
        id: law.id,
        name: law.name,
        bodyText: law.body_text || law.bodyText,
        isPublic: law.is_public !== undefined ? law.is_public : law.isPublic,
        nationName: law.nation_name || law.nationName,
        createdBy: law.created_by || law.createdBy,
        createdAt: law.created_at || law.createdAt,
        editedAt: law.edited_at || law.editedAt,
        editedBy: law.edited_by || law.editedBy,
        originalText: law.original_text || law.originalText
      };

      // Check permissions for private laws
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);
      
      const userLink = dbManager.getUserLink(interaction.user.id);
      const isOwnNation = userLink && userLink.nationName.toLowerCase() === normalizedLaw.nationName.toLowerCase();

      if (!normalizedLaw.isPublic && !isAdmin && !isOwnNation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Private Law')
          .setDescription('This law is private and you do not have permission to view it.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Get law with tags
      const lawWithTags = dbManager.getLawWithTags(normalizedLaw.id);
      const tags = lawWithTags?.tags || [];

      const embed = new EmbedBuilder()
        .setColor(normalizedLaw.isPublic ? 0x0099ff : 0xffa500)
        .setTitle(`📜 ${normalizedLaw.name}`)
        .setDescription(normalizedLaw.bodyText)
        .addFields(
          { name: '🏛️ Nation', value: normalizedLaw.nationName, inline: true },
          { name: '👁️ Visibility', value: normalizedLaw.isPublic ? 'Public' : 'Private', inline: true },
          { name: '👤 Created By', value: `<@${normalizedLaw.createdBy}>`, inline: true }
        )
        .setFooter({ text: `Created ${new Date(normalizedLaw.createdAt).toLocaleDateString()}` })
        .setTimestamp();

      if (tags.length > 0) {
        embed.addFields({
          name: '🏷️ Tags',
          value: tags.map((tag: any) => `\`${tag.name}\``).join(' '),
          inline: false
        });
      }

      if (normalizedLaw.editedAt) {
        embed.addFields(
          { name: '✏️ Last Edited', value: `${new Date(normalizedLaw.editedAt).toLocaleDateString()} by <@${normalizedLaw.editedBy}>`, inline: false }
        );
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error reading law:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Reading Law')
        .setDescription('An error occurred while reading the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleEdit(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to edit laws.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const lawName = interaction.options.getString('law', true);
    const newText = interaction.options.getString('new_text', true);
    const tagsString = interaction.options.getString('tags');

    try {
      const law = dbManager.getLawByName(lawName, userLink.nationName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`You don't have a law named "${lawName}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if user is admin or law owner
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);
      const isOwner = law.createdBy === interaction.user.id;

      if (!isAdmin && !isOwner) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Permission Denied')
          .setDescription('You can only edit laws that you created.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Store original text if this is the first edit
      const originalText = law.originalText || law.bodyText;

      // Update the law
      dbManager.editLaw(law.id, newText, interaction.user.id, originalText);

      // Update tags if provided
      if (tagsString) {
        const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (tags.length > 0) {
          dbManager.updateLawTags(law.id, tags);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✏️ Law Edited')
        .setDescription(`Successfully edited law "${law.name}" for **${userLink.nationName}**`)
        .addFields(
          { name: '📝 New Text', value: newText.length > 500 ? newText.substring(0, 500) + '...' : newText, inline: false }
        )
        .setFooter({ text: `Edited by ${interaction.user.tag}` })
        .setTimestamp();

      if (tagsString) {
        const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (tags.length > 0) {
          embed.addFields({ name: '🏷️ Updated Tags', value: tags.join(', '), inline: false });
        }
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error editing law:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Editing Law')
        .setDescription('An error occurred while editing the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRename(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to rename laws.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const lawName = interaction.options.getString('law', true);
    const newName = interaction.options.getString('new_name', true);

    try {
      const law = dbManager.getLawByName(lawName, userLink.nationName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`You don't have a law named "${lawName}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if user is admin or law owner
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);
      const isOwner = law.createdBy === interaction.user.id;

      if (!isAdmin && !isOwner) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Permission Denied')
          .setDescription('You can only rename laws that you created.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if new name already exists
      const existingLaw = dbManager.getLawByName(newName, userLink.nationName);
      if (existingLaw && existingLaw.id !== law.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Name Already Exists')
          .setDescription(`A law named "${newName}" already exists for ${userLink.nationName}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Rename the law
      dbManager.renameLaw(law.id, newName);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📝 Law Renamed')
        .setDescription(`Successfully renamed law for **${userLink.nationName}**`)
        .addFields(
          { name: '📋 Old Name', value: lawName, inline: true },
          { name: '📋 New Name', value: newName, inline: true }
        )
        .setFooter({ text: `Renamed by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error renaming law:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Renaming Law')
        .setDescription('An error occurred while renaming the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleDelete(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to delete laws.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const lawName = interaction.options.getString('law', true);

    try {
      const law = dbManager.getLawByName(lawName, userLink.nationName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`You don't have a law named "${lawName}".`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if user is admin or law owner
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);
      const isOwner = law.createdBy === interaction.user.id;

      if (!isAdmin && !isOwner) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Permission Denied')
          .setDescription('You can only delete laws that you created.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Delete the law
      dbManager.deleteLaw(law.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🗑️ Law Deleted')
        .setDescription(`Successfully deleted law "${lawName}" for **${userLink.nationName}**`)
        .setFooter({ text: `Deleted by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error deleting law:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Deleting Law')
        .setDescription('An error occurred while deleting the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'nation') {
        // Autocomplete for nation names
        const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
        const choices = nations.slice(0, 25).map(nation => ({
          name: nation.name,
          value: nation.name
        }));
        
        await interaction.respond(choices);
      } else if (focusedOption.name === 'law') {
        // Autocomplete for law names - show accessible laws
        const userLink = dbManager.getUserLink(interaction.user.id);
        
        // Get laws - be permissive for autocomplete
        let laws: any[] = [];
        try {
          // Get all public laws
          const publicLaws = dbManager.searchLaws({ isPublic: true });
          laws = publicLaws;
          
          // Add user's own laws if they have a linked nation
          if (userLink) {
            const ownLaws = dbManager.getLawsByNation(userLink.nationName, true);
            // Add private laws that aren't already in the list
            const privateLaws = ownLaws.filter((law: any) => 
              !(law.isPublic || law.is_public) && 
              !laws.some(existingLaw => existingLaw.id === law.id)
            );
            laws = [...laws, ...privateLaws];
          }
        } catch (error) {
          // Fallback to just getting all laws
          laws = dbManager.getAllLaws();
        }
        
        const filteredLaws = laws.filter((law: any) => 
          law.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        
        const choices = filteredLaws.slice(0, 25).map((law: any) => ({
          name: `${law.name} (${law.nation_name || law.nationName})`,
          value: law.name
        }));
        
        await interaction.respond(choices);
      } else if (focusedOption.name === 'tags' || focusedOption.name === 'tag') {
        // Autocomplete for tags - improve performance
        if (focusedOption.value.length < 1) {
          // Show common tags if no input
          const commonTags = [
            { name: 'economy', value: 'economy' },
            { name: 'tax', value: 'tax' },
            { name: 'trade', value: 'trade' },
            { name: 'military', value: 'military' },
            { name: 'policy', value: 'policy' },
            { name: 'law', value: 'law' },
            { name: 'regulation', value: 'regulation' },
            { name: 'budget', value: 'budget' }
          ];
          await interaction.respond(commonTags);
          return;
        }
        
        const allTags = dbManager.getAllTags(50, 1).tags; // Limit to 50 for performance
        const filteredTags = allTags.filter((tag: any) => 
          tag.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        
        const choices = filteredTags.slice(0, 25).map((tag: any) => ({
          name: tag.name,
          value: tag.name
        }));
        
        await interaction.respond(choices);
      }
    } catch (error) {
      // Fallback to empty response if autocomplete fails
      await interaction.respond([]);
    }
  }
}