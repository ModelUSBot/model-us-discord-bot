import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatTimeRemaining, formatCooldownTime } from '../../utils/FormatUtils';
import { PermissionManager } from '../../bot/PermissionManager';

export class SetFlagCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('set-flag')
    .setDescription('Set your nation\'s flag using an image (3 hour cooldown)')
    .addAttachmentOption(option =>
      option.setName('flag_image')
        .setDescription('Flag image for your nation (PNG, JPG, GIF supported)')
        .setRequired(true)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const flagAttachment = interaction.options.getAttachment('flag_image', true);

    try {
      // Check if user is linked to a nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.reply({
          content: '❌ You must have your Discord account linked to a nation to set a flag. Contact an admin to link your account.'
        });
        return;
      }

      // Validate attachment
      if (!flagAttachment.contentType?.startsWith('image/')) {
        await interaction.reply({
          content: '❌ Invalid file type. Please upload an image file (PNG, JPG, GIF).'
        });
        return;
      }

      // Check file size (Discord limit is 8MB for non-nitro, but we'll be more restrictive)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (flagAttachment.size > maxSize) {
        await interaction.reply({
          content: '❌ Image file is too large. Please use an image smaller than 5MB.'
        });
        return;
      }

      // Check if user is admin (admins bypass cooldown)
      const adminUserIds = process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [];
      const permissions = new PermissionManager(adminUserIds, logger);
      const isAdmin = await permissions.isAdmin(interaction);

      // Check cooldown (unless admin)
      if (!isAdmin) {
        const nation = dbManager.getNationByName(userLink.nationName);
        if (!nation) {
          await interaction.reply({
            content: '❌ Your linked nation was not found. Contact an admin.'
          });
          return;
        }

        if (nation.flagSetAt) {
          const cooldownMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
          const timeSinceLastSet = Date.now() - new Date(nation.flagSetAt).getTime();
          
          if (timeSinceLastSet < cooldownMs) {
            const timeRemaining = cooldownMs - timeSinceLastSet;
            await interaction.reply({
              content: `❌ You can change your flag again in ${formatTimeRemaining(timeRemaining)}.`
            });
            return;
          }
        }
      }

      // Set the flag (store the image URL)
      const success = dbManager.setNationFlag(userLink.nationName, flagAttachment.url, interaction.user.id);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to set the flag. Please try again.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏳️ Flag Updated')
        .setDescription(`Successfully set the flag for **${userLink.nationName}**${isAdmin ? ' (Admin Override)' : ''}`)
        .addFields(
          { name: '🕐 Next Change Available', value: isAdmin ? 'No cooldown (Admin)' : 'In 3 hours', inline: true }
        )
        .setImage(flagAttachment.url)
        .setColor(isAdmin ? 0xff9500 : 0x00ff00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      logger.info(`User ${interaction.user.id} set flag for nation ${userLink.nationName}: ${flagAttachment.url}`);

    } catch (error) {
      logger.error('Error setting flag:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while setting the flag. Please try again.'
      });
    }
  }
}