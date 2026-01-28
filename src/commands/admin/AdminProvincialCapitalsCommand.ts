import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class AdminProvincialCapitalsCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('admin-provincial-capitals')
    .setDescription('Admin management of provincial capitals')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a provincial capital for any nation')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to add capital to')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the provincial capital')
            .setRequired(true)
            .setMaxLength(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a provincial capital from any nation')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to remove capital from')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the provincial capital to remove')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set all provincial capitals for a nation (replaces existing)')
        .addStringOption(option =>
          option.setName('nation')
            .setDescription('Nation to set capitals for')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('capitals')
            .setDescription('Comma-separated list of capitals')
            .setRequired(true)));

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
      case 'add':
        await this.handleAdd(interaction, dbManager, logger);
        break;
      case 'remove':
        await this.handleRemove(interaction, dbManager, logger);
        break;
      case 'set':
        await this.handleSet(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleAdd(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const capitalName = interaction.options.getString('name', true);

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

      const success = dbManager.addProvincialCapital(nationName, capitalName, interaction.user.id);
      
      if (success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏙️ Provincial Capital Added (Admin)')
          .setDescription(`Successfully added **${capitalName}** as a provincial capital for **${nationName}**`)
          .setFooter({ text: `Added by Admin: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Add Capital')
          .setDescription('An error occurred while adding the provincial capital.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

    } catch (error) {
      logger.error('Error adding provincial capital (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Adding Capital')
        .setDescription((error as Error).message || 'An error occurred while adding the provincial capital.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRemove(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const capitalName = interaction.options.getString('name', true);

    try {
      const success = dbManager.removeProvincialCapital(nationName, capitalName, interaction.user.id);
      
      if (success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏙️ Provincial Capital Removed (Admin)')
          .setDescription(`Successfully removed **${capitalName}** as a provincial capital from **${nationName}**`)
          .setFooter({ text: `Removed by Admin: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Capital Not Found')
          .setDescription(`Provincial capital "${capitalName}" was not found for ${nationName}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

    } catch (error) {
      logger.error('Error removing provincial capital (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Removing Capital')
        .setDescription('An error occurred while removing the provincial capital.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleSet(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const capitalsInput = interaction.options.getString('capitals', true);

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

      // Parse capitals list
      const capitals = capitalsInput.split(',').map(c => c.trim()).filter(c => c.length > 0);
      
      // No limit on number of capitals

      const success = dbManager.setProvincialCapitals(nationName, capitals, interaction.user.id);
      
      if (success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏙️ Provincial Capitals Set (Admin)')
          .setDescription(`Successfully set provincial capitals for **${nationName}**`)
          .addFields({
            name: '🏙️ Provincial Capitals',
            value: capitals.length > 0 ? capitals.map((c, i) => `${i + 1}. **${c}**`).join('\n') : 'None',
            inline: false
          })
          .setFooter({ text: `Set by Admin: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Set Capitals')
          .setDescription('An error occurred while setting the provincial capitals.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

    } catch (error) {
      logger.error('Error setting provincial capitals (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Setting Capitals')
        .setDescription((error as Error).message || 'An error occurred while setting the provincial capitals.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'nation') {
      const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
      const choices = nations.slice(0, 25).map(nation => ({
        name: nation.name,
        value: nation.name
      }));
      
      await interaction.respond(choices);
    }
  }
}