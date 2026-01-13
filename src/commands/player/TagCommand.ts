import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class TagCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Manage tags for laws and organization')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Create a new tag')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the tag')
            .setRequired(true)
            .setMaxLength(50))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the tag')
            .setRequired(true)
            .setMaxLength(200)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all available tags')
        .addNumberOption(option =>
          option.setName('page')
            .setDescription('Page number (default: 1)')
            .setRequired(false)
            .setMinValue(1)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get information about a specific tag')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Tag name')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a tag (admin only)')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the tag to remove')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for removing the tag (for logs)')
            .setRequired(false)
            .setMaxLength(200)));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await this.handleAdd(interaction, dbManager, logger);
        break;
      case 'list':
        await this.handleList(interaction, dbManager, logger);
        break;
      case 'info':
        await this.handleInfo(interaction, dbManager, logger);
        break;
      case 'remove':
        await this.handleRemove(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleAdd(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description', true);

    try {
      // Check if tag already exists
      const existingTag = dbManager.getTagByName(name);
      if (existingTag) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Tag Already Exists')
          .setDescription(`A tag named "${name}" already exists.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Create the tag
      const tag = dbManager.createTag(name, description, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🏷️ Tag Created')
        .setDescription(`Successfully created tag: **${name}**`)
        .addFields(
          { name: '📝 Description', value: description, inline: false },
          { name: '👤 Created By', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating tag:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Tag')
        .setDescription('An error occurred while creating the tag. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const page = interaction.options.getNumber('page') || 1;
    const itemsPerPage = 10;

    try {
      const result = dbManager.getAllTags(itemsPerPage, page);
      const { tags, totalCount } = result;
      const totalPages = Math.ceil(totalCount / itemsPerPage);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🏷️ Available Tags')
        .setTimestamp();

      if (tags.length === 0) {
        embed.setDescription('No tags found.');
      } else {
        const tagList = tags.map((tag: any, index: number) => {
          const globalIndex = (page - 1) * itemsPerPage + index + 1;
          return `**${globalIndex}.** \`${tag.name}\` - ${tag.description}`;
        }).join('\n');

        embed.setDescription(tagList);
        embed.setFooter({ text: `Page ${page} of ${totalPages} • ${totalCount} total tags` });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing tags:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Listing Tags')
        .setDescription('An error occurred while listing tags. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleInfo(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const tagName = interaction.options.getString('name', true);

    try {
      const tag = dbManager.getTagByName(tagName);
      if (!tag) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Tag Not Found')
          .setDescription(`Tag "${tagName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Get laws that use this tag
      const lawsWithTag = dbManager.searchLaws({ tagName: tag.name, isPublic: true });
      const lawCount = lawsWithTag.length;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🏷️ ${tag.name}`)
        .setDescription(tag.description)
        .addFields(
          { name: '👤 Created By', value: `<@${tag.createdBy}>`, inline: true },
          { name: '📅 Created', value: new Date(tag.createdAt).toLocaleDateString(), inline: true },
          { name: '📜 Used in Laws', value: `${lawCount} law${lawCount === 1 ? '' : 's'}`, inline: true }
        )
        .setTimestamp();

      if (lawCount > 0 && lawCount <= 10) {
        const lawList = lawsWithTag.slice(0, 10).map((law: any) => 
          `• **${law.name}** (${law.nation_name || law.nationName})`
        ).join('\n');
        embed.addFields({ name: '📋 Recent Laws', value: lawList, inline: false });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error getting tag info:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Getting Tag Info')
        .setDescription('An error occurred while getting tag information. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRemove(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check admin permissions
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
    const permissions = new PermissionManager(adminUserIds, logger);
    const isAdmin = await permissions.isAdmin(interaction);

    if (!isAdmin) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Permission Denied')
        .setDescription('Only administrators can remove tags.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const tagName = interaction.options.getString('name', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // Get tag info before removal for the confirmation message
      const tag = dbManager.getTagByName(tagName);
      if (!tag) {
        await interaction.reply({
          content: `❌ Tag "${tagName}" not found.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Get laws that use this tag to show impact
      const affectedLaws = dbManager.searchLaws({ 
        tagName: tag.name,
        isPublic: true // Only count public laws for the message
      });

      // Remove the tag
      const success = dbManager.removeTag(tagName, interaction.user.id, reason);
      
      if (!success) {
        await interaction.reply({
          content: `❌ Failed to remove tag "${tagName}". It may have already been removed.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Tag Removed')
        .setDescription(`Successfully removed tag: **${tag.name}**`)
        .addFields(
          { name: '📝 Description', value: tag.description, inline: false },
          { name: '👤 Originally Created By', value: `<@${tag.createdBy}>`, inline: true },
          { name: '👤 Removed By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setColor(0xff6b6b)
        .setTimestamp();

      if (affectedLaws.length > 0) {
        embed.addFields({
          name: '⚠️ Impact',
          value: `This tag was removed from ${affectedLaws.length} law${affectedLaws.length !== 1 ? 's' : ''}.`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.id} removed tag "${tagName}" - Reason: ${reason}`);

    } catch (error) {
      logger.error('Error removing tag:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Removing Tag')
        .setDescription('An error occurred while removing the tag. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    try {
      if (focusedOption.name === 'name') {
        const focusedValue = interaction.options.getFocused();
        
        // Simple, fast tag search
        if (focusedValue.length === 0) {
          const stmt = (dbManager as any).db.prepare(`SELECT name FROM tags ORDER BY name LIMIT 10`);
          const rows = stmt.all() as any[];
          const results = rows.map(row => ({ name: row.name, value: row.name }));
          await interaction.respond(results);
          return;
        }

        const stmt = (dbManager as any).db.prepare(`
          SELECT name FROM tags 
          WHERE name LIKE ? COLLATE NOCASE
          ORDER BY name
          LIMIT 25
        `);
        
        const searchPattern = `%${focusedValue}%`;
        const rows = stmt.all(searchPattern) as any[];
        const results = rows.map(row => ({ name: row.name, value: row.name }));
        
        await interaction.respond(results);
      }
    } catch (error) {
      logger.error('Tag autocomplete error:', { error: error as Error });
      await interaction.respond([]);
    }
  }
}