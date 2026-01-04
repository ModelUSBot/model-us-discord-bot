import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { isValidFlag, isValidImageUrl } from '../../utils/FormatUtils';

export class AdminSetFlagCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-set-flag')
    .setDescription('Set any nation\'s flag (admin only, bypasses cooldown)')
    .addStringOption(option =>
      option.setName('nation')
        .setDescription('Nation name')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('flag_url')
        .setDescription('Flag emoji or HTTPS image URL for the nation')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option.setName('flag_image')
        .setDescription('Flag image file (PNG, JPG, GIF, WebP, SVG)')
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const nationName = interaction.options.getString('nation', true);
    const flagUrl = interaction.options.getString('flag_url');
    const flagImage = interaction.options.getAttachment('flag_image');

    // Must provide either flag_url or flag_image
    if (!flagUrl && !flagImage) {
      await interaction.reply({
        content: '❌ Please provide either a flag URL/emoji or upload a flag image.'
      });
      return;
    }

    // Can't provide both
    if (flagUrl && flagImage) {
      await interaction.reply({
        content: '❌ Please provide either a flag URL/emoji OR upload an image, not both.'
      });
      return;
    }

    // Determine the flag value to use
    let flag: string;
    if (flagImage) {
      // Validate image attachment
      if (!flagImage.contentType?.startsWith('image/')) {
        await interaction.reply({
          content: '❌ Invalid file type. Please upload an image file (PNG, JPG, GIF, WebP, SVG).'
        });
        return;
      }

      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024;
      if (flagImage.size > maxSize) {
        await interaction.reply({
          content: '❌ Image file is too large. Please use an image smaller than 5MB.'
        });
        return;
      }

      flag = flagImage.url;
    } else {
      flag = flagUrl!;
      
      // Validate flag format for URL/emoji
      if (!isValidFlag(flag)) {
        await interaction.reply({
          content: '❌ Invalid flag format. Please use a valid emoji or HTTPS image URL (PNG, JPG, GIF, WebP, SVG).'
        });
        return;
      }
    }

    try {
      // Check if nation exists
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const allNations = dbManager.getAllNations();
        const suggestions = allNations
          .filter(n => n.name.toLowerCase().includes(nationName.toLowerCase()))
          .slice(0, 5)
          .map(n => n.name)
          .join(', ');

        const suggestionText = suggestions ? `\n\nDid you mean: ${suggestions}?` : '';
        
        await interaction.reply({
          content: `❌ Nation "${nationName}" not found.${suggestionText}`
        });
        return;
      }

      // Validate flag format
      if (!isValidFlag(flag)) {
        await interaction.reply({
          content: '❌ Invalid flag format. Please use a valid emoji or HTTPS image URL (PNG, JPG, GIF, WebP, SVG).'
        });
        return;
      }

      // Set the flag (admin bypasses cooldown)
      const success = dbManager.setNationFlag(nationName, flag, interaction.user.id);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to set the flag. Please try again.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏳️ Flag Updated (Admin)')
        .setDescription(`Successfully set the flag for **${nationName}**`)
        .addFields(
          { name: '🏳️ New Flag', value: isValidImageUrl(flag) ? '[Image Flag]' : flag, inline: true },
          { name: '👤 Set By', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor(0xff9500)
        .setTimestamp();

      // If it's an image URL, set it as the embed image
      if (isValidImageUrl(flag)) {
        embed.setImage(flag);
      }

      await interaction.reply({ embeds: [embed] });

      logger.info(`Admin ${interaction.user.id} set flag for nation ${nationName}: ${flag}`);

    } catch (error) {
      logger.error('Error setting flag (admin)', { 
        command: 'admin-set-flag',
        user: interaction.user.id,
        error: error as Error,
        metadata: { nationName, flag }
      });
      
      await interaction.reply({
        content: '❌ Database temporarily unavailable. Please try again in a moment.'
      });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    try {
      const nations = dbManager.getAllNations();
      
      const filtered = nations
        .filter(nation => nation.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(nation => ({
          name: nation.name,
          value: nation.name
        }));

      await interaction.respond(filtered);
    } catch (error) {
      logger.error('Error in autocomplete', { 
        command: 'admin-set-flag',
        user: interaction.user.id,
        error: error as Error
      });
      await interaction.respond([]);
    }
  }
}