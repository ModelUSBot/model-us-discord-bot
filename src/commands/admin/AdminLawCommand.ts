import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class AdminLawCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('admin-law')
    .setDescription('Admin law management commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a law for any nation')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to create law for')
            .setRequired(true)
            .setAutocomplete(true))
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
        .setName('edit')
        .setDescription('Edit any law')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to edit')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('new_text')
            .setDescription('New text for the law')
            .setRequired(true)
            .setMaxLength(2000)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('rename')
        .setDescription('Rename any law')
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
        .setDescription('Delete any law')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to delete')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('transfer')
        .setDescription('Transfer law ownership to another nation')
        .addStringOption(option =>
          option.setName('law')
            .setDescription('Law to transfer')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('new_nation')
            .setDescription('Nation to transfer law to')
            .setRequired(true)
            .setAutocomplete(true)));

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
      case 'edit':
        await this.handleEdit(interaction, dbManager, logger);
        break;
      case 'rename':
        await this.handleRename(interaction, dbManager, logger);
        break;
      case 'delete':
        await this.handleDelete(interaction, dbManager, logger);
        break;
      case 'transfer':
        await this.handleTransfer(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
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

      // Check if law name already exists for this nation
      const existingLaw = dbManager.getLawByName(name, nation.name);
      if (existingLaw) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Already Exists')
          .setDescription(`A law named "${name}" already exists for ${nation.name}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Create the law
      const law = dbManager.createLaw(name, text, isPublic, nation.name, interaction.user.id, tags);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📜 Law Created (Admin)')
        .setDescription(`Successfully created ${isPublic ? 'public' : 'private'} law for **${nation.name}**`)
        .addFields(
          { name: '📋 Law Name', value: name, inline: true },
          { name: '🏛️ Nation', value: nation.name, inline: true },
          { name: '👁️ Visibility', value: isPublic ? 'Public' : 'Private', inline: true },
          { name: '🏷️ Tags', value: tags.join(', '), inline: true },
          { name: '📝 Text Preview', value: text.length > 100 ? text.substring(0, 100) + '...' : text, inline: false }
        )
        .setFooter({ text: `Created by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating law (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Law')
        .setDescription('An error occurred while creating the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleEdit(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const lawName = interaction.options.getString('law', true);
    const newText = interaction.options.getString('new_text', true);

    try {
      const law = dbManager.getLawByNameGlobal(lawName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`Law "${lawName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Store original text if this is the first edit
      const originalText = law.originalText || law.bodyText;

      // Update the law
      dbManager.editLaw(law.id, newText, interaction.user.id, originalText);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✏️ Law Edited (Admin)')
        .setDescription(`Successfully edited law "${law.name}" for **${law.nationName}**`)
        .addFields(
          { name: '📝 New Text', value: newText.length > 500 ? newText.substring(0, 500) + '...' : newText, inline: false }
        )
        .setFooter({ text: `Edited by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error editing law (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Editing Law')
        .setDescription('An error occurred while editing the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRename(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const lawName = interaction.options.getString('law', true);
    const newName = interaction.options.getString('new_name', true);

    try {
      const law = dbManager.getLawByNameGlobal(lawName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`Law "${lawName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if new name already exists for the same nation
      const existingLaw = dbManager.getLawByName(newName, law.nationName);
      if (existingLaw && existingLaw.id !== law.id) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Name Already Exists')
          .setDescription(`A law named "${newName}" already exists for ${law.nationName}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Rename the law
      dbManager.renameLaw(law.id, newName);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📝 Law Renamed (Admin)')
        .setDescription(`Successfully renamed law for **${law.nationName}**`)
        .addFields(
          { name: '📋 Old Name', value: lawName, inline: true },
          { name: '📋 New Name', value: newName, inline: true }
        )
        .setFooter({ text: `Renamed by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error renaming law (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Renaming Law')
        .setDescription('An error occurred while renaming the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleDelete(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const lawName = interaction.options.getString('law', true);

    try {
      const law = dbManager.getLawByNameGlobal(lawName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`Law "${lawName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Delete the law
      dbManager.deleteLaw(law.id, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🗑️ Law Deleted (Admin)')
        .setDescription(`Successfully deleted law "${lawName}" from **${law.nationName}**`)
        .setFooter({ text: `Deleted by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error deleting law (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Deleting Law')
        .setDescription('An error occurred while deleting the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleTransfer(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const lawName = interaction.options.getString('law', true);
    const newNationName = interaction.options.getString('new_nation', true);

    try {
      const law = dbManager.getLawByNameGlobal(lawName);
      if (!law) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Not Found')
          .setDescription(`Law "${lawName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if target nation exists
      const targetNation = dbManager.getNationByName(newNationName);
      if (!targetNation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${newNationName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if law name already exists for target nation
      const existingLaw = dbManager.getLawByName(law.name, targetNation.name);
      if (existingLaw) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Law Name Conflict')
          .setDescription(`A law named "${law.name}" already exists for ${targetNation.name}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Transfer the law
      dbManager.transferLaw(law.id, targetNation.name);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🔄 Law Transferred (Admin)')
        .setDescription(`Successfully transferred law "${lawName}"`)
        .addFields(
          { name: '📤 From Nation', value: law.nationName, inline: true },
          { name: '📥 To Nation', value: targetNation.name, inline: true }
        )
        .setFooter({ text: `Transferred by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error transferring law (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Transferring Law')
        .setDescription('An error occurred while transferring the law. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'nation' || focusedOption.name === 'new_nation') {
        // Autocomplete for nation names
        const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
        const choices = nations.slice(0, 25).map(nation => ({
          name: nation.name,
          value: nation.name
        }));
        
        await interaction.respond(choices);
      } else if (focusedOption.name === 'law') {
        // Autocomplete for all law names (admin can see all)
        const laws = dbManager.getAllLaws();
        const filteredLaws = laws.filter((law: any) => 
          law.name.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        
        const choices = filteredLaws.slice(0, 25).map((law: any) => ({
          name: `${law.name} (${law.nation_name})`,
          value: law.name
        }));
        
        await interaction.respond(choices);
      } else if (focusedOption.name === 'tags') {
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
        
        const allTags = dbManager.getAllTags(50, 1).tags;
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