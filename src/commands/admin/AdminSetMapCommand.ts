import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class AdminSetMapCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-set-map')
    .setDescription('Set the world or alliance map (Admin only)')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of map to set')
        .setRequired(true)
        .addChoices(
          { name: 'World Map', value: 'world' },
          { name: 'Alliance Map', value: 'alliance' }
        ))
    .addStringOption(option =>
      option.setName('url')
        .setDescription('URL of the map image')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Description of the map')
        .setRequired(false)
        .setMaxLength(200));

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

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const mapType = interaction.options.getString('type', true) as 'world' | 'alliance';
    const mapUrl = interaction.options.getString('url', true);
    const description = interaction.options.getString('description') || (mapType === 'world' ? 'World Map' : 'Alliance Map');

    try {
      // Validate URL format (basic check)
      try {
        new URL(mapUrl);
      } catch {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid URL')
          .setDescription('Please provide a valid image URL.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Set the map
      dbManager.setMap(mapUrl, description, interaction.user.id, mapType);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`🗺️ ${mapType === 'world' ? 'World' : 'Alliance'} Map Updated`)
        .setDescription(`Successfully updated the ${mapType} map`)
        .addFields(
          { name: '📋 Description', value: description, inline: true },
          { name: '🗺️ Type', value: mapType === 'world' ? 'World Map' : 'Alliance Map', inline: true },
          { name: '🔗 URL', value: mapUrl, inline: false }
        )
        .setImage(mapUrl)
        .setFooter({ text: `Set by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error setting map:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Setting Map')
        .setDescription('An error occurred while setting the map. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}