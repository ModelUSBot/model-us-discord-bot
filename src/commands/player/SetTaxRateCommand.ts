import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { formatGDP } from '../../utils/FormatUtils';
import { handleCommandError, validateTaxRate, checkCooldown, safeReply } from '../../utils/CommandUtils';

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
    // Check cooldown
    if (!(await checkCooldown(interaction, 2000))) {
      return;
    }

    const newTaxRate = interaction.options.getNumber('rate', true);

    try {
      // Validate tax rate input
      const validation = validateTaxRate(newTaxRate);
      if (!validation.valid) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid Tax Rate')
          .setDescription(validation.error!)
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Check if user has a linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Linked Nation')
          .setDescription('You must have a linked nation to change tax rates. Ask an admin to link your nation first.')
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
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

        await safeReply(interaction, { embeds: [embed] }, true);
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
          .setDescription(`You can only change your tax rate once every 7 days. You can do it in ${timeText}.`)
          .addFields(
            { name: '⏰ Current Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
            { name: '⏳ Time Remaining', value: timeText, inline: true }
          )
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Check if the new tax rate is the same as current
      if (Math.abs(newTaxRate - nation.taxRate) < 0.01) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ No Change Required')
          .setDescription(`Your nation's tax rate is already ${newTaxRate}%.`)
          .setTimestamp();

        await safeReply(interaction, { embeds: [embed] }, true);
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

        await safeReply(interaction, { embeds: [embed] }, true);
        return;
      }

      // Get updated nation data
      const updatedNation = dbManager.getNationByName(nationName);
      if (!updatedNation) {
        throw new Error('Failed to retrieve updated nation data');
      }

      const oldBudget = nation.gdp * (nation.taxRate / 100);
      const newBudget = updatedNation.budget;
      const budgetChange = newBudget - oldBudget;

      const embed = new EmbedBuilder()
        .setColor(budgetChange >= 0 ? 0x00ff00 : 0xff6600)
        .setTitle('✅ Tax Rate Updated')
        .setDescription(`Successfully updated tax rate for **${nationName}**`)
        .addFields(
          { name: '📊 Previous Tax Rate', value: `${nation.taxRate.toFixed(1)}%`, inline: true },
          { name: '📈 New Tax Rate', value: `${newTaxRate.toFixed(1)}%`, inline: true },
          { name: '💰 Budget Impact', value: `${budgetChange >= 0 ? '+' : ''}${formatGDP(budgetChange)}`, inline: true },
          { name: '💵 New Budget', value: formatGDP(newBudget), inline: true },
          { name: '⏰ Next Change Available', value: '7 days from now', inline: true }
        )
        .setFooter({ text: 'Tax rate changes affect your nation\'s budget immediately' })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });

      logger.info(`Tax rate updated for ${nationName}`, {
        user: interaction.user.id,
        metadata: {
          nation: nationName,
          oldRate: nation.taxRate,
          newRate: newTaxRate,
          budgetChange
        }
      });

    } catch (error) {
      await handleCommandError(interaction, error as Error, logger, 'set-tax-rate');
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