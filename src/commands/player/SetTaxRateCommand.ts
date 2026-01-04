import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';

export class SetTaxRateCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('set-tax-rate')
    .setDescription('Change your nation\'s tax rate (once every 7 days)')
    .addNumberOption(option =>
      option.setName('rate')
        .setDescription('New tax rate percentage (0-50%)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(50)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const newTaxRate = interaction.options.getNumber('rate', true);

    try {
      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Linked Nation')
          .setDescription('You must have a linked nation to change tax rates. Ask an admin to link your nation first.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const nationName = userLink.nationName;

      // Check if nation exists
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Your linked nation "${nationName}" was not found in the database.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if user can change tax rate (7-day cooldown)
      const canChange = dbManager.canChangeTaxRate(nationName);
      if (!canChange.canChange) {
        const hoursRemaining = Math.ceil(canChange.timeRemaining! / (1000 * 60 * 60));
        const daysRemaining = Math.floor(hoursRemaining / 24);
        const remainingHours = hoursRemaining % 24;

        let timeText = '';
        if (daysRemaining > 0) {
          timeText = `${daysRemaining} day(s) and ${remainingHours} hour(s)`;
        } else {
          timeText = `${remainingHours} hour(s)`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Tax Rate Change on Cooldown')
          .setDescription(`You can only change your tax rate once every 7 days. Please wait ${timeText} before changing it again.`)
          .addFields(
            { name: '⏰ Current Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
            { name: '⏳ Time Remaining', value: timeText, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if the new tax rate is the same as current
      if (Math.abs(newTaxRate - nation.taxRate) < 0.01) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Change Required')
          .setDescription(`Your nation's tax rate is already ${newTaxRate}%.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Update the tax rate
      const success = dbManager.setTaxRate(nationName, newTaxRate, interaction.user.id);
      
      if (!success) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Update Tax Rate')
          .setDescription('An error occurred while updating your tax rate. Please try again.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get updated nation data
      const updatedNation = dbManager.getNationByName(nationName)!;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Tax Rate Updated Successfully')
        .setDescription(`Your nation's tax rate has been changed from **${nation.taxRate.toFixed(1)}%** to **${newTaxRate}%**.`)
        .addFields(
          { name: '🏛️ Nation', value: nationName, inline: true },
          { name: '💸 Old Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
          { name: '💸 New Tax Rate', value: `${newTaxRate}%`, inline: true },
          { name: '🏦 Old Budget', value: formatGDP(nation.budget), inline: true },
          { name: '🏦 New Budget', value: formatGDP(updatedNation.budget), inline: true },
          { name: '⏰ Next Change Available', value: '<t:' + Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000) + ':R>', inline: true }
        )
        .setFooter({ text: `Changed by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Send notification to admin channel
      try {
        const adminChannelId = process.env.ADMIN_NOTIFICATION_CHANNEL_ID || '1457229969481531463';
        const adminChannel = await interaction.client.channels.fetch(adminChannelId);
        
        if (adminChannel && adminChannel.isTextBased() && 'send' in adminChannel) {
          const adminEmbed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('📊 Tax Rate Changed')
            .setDescription(`A player has changed their nation's tax rate.`)
            .addFields(
              { name: '🏛️ Nation', value: nationName, inline: true },
              { name: '👤 Player', value: `<@${interaction.user.id}>`, inline: true },
              { name: '💸 Change', value: `${nation.taxRate.toFixed(1)}% → ${newTaxRate}%`, inline: true },
              { name: '🏦 Budget Impact', value: `${formatGDP(nation.budget)} → ${formatGDP(updatedNation.budget)}`, inline: false }
            )
            .setFooter({ text: `Player: ${interaction.user.tag}` })
            .setTimestamp();

          await adminChannel.send({ embeds: [adminEmbed] });
        }
      } catch (error) {
        logger.warn('Failed to send admin notification for tax rate change:', { error: error as Error });
      }

      logger.info(`User ${interaction.user.tag} (${nationName}) changed tax rate from ${nation.taxRate}% to ${newTaxRate}%`);

    } catch (error) {
      logger.error('Error changing tax rate:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Changing Tax Rate')
        .setDescription('An error occurred while changing your tax rate. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(
    interaction: AutocompleteInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    await interaction.respond([]);
  }
}