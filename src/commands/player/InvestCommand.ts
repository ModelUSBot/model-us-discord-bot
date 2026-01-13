import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class InvestCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('invest')
    .setDescription('Invest in other human nations (not foreign countries)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create an investment proposal to another human nation')
        .addStringOption(option =>
          option.setName('target')
            .setDescription('Nation to invest in')
            .setRequired(true)
            .addChoices(
              { name: 'Arizona', value: 'Arizona' },
              { name: 'Arkansaw', value: 'Arkansaw' },
              { name: 'Colorado', value: 'Colorado' },
              { name: 'Commonwealth of Cascadia', value: 'Commonwealth of Cascadia' },
              { name: 'Commonwealth of Kentucky', value: 'Commonwealth of Kentucky' },
              { name: 'Commonwealth of Virginia', value: 'Commonwealth of Virginia' },
              { name: 'Dixieland', value: 'Dixieland' },
              { name: 'Empire of French New America', value: 'Empire of French New America' },
              { name: 'Empire of Illinois', value: 'Empire of Illinois' },
              { name: 'Georgia', value: 'Georgia' },
              { name: 'Michigan', value: 'Michigan' },
              { name: 'MinDak', value: 'MinDak' },
              { name: 'Missouri', value: 'Missouri' },
              { name: 'New England', value: 'New England' },
              { name: 'New York', value: 'New York' },
              { name: 'Northern California', value: 'Northern California' },
              { name: 'Ohio', value: 'Ohio' },
              { name: 'Pennsylvania', value: 'Pennsylvania' },
              { name: 'Republic of Carolina', value: 'Republic of Carolina' },
              { name: 'Republic of Florida', value: 'Republic of Florida' },
              { name: 'Republic of Kanaska', value: 'Republic of Kanaska' },
              { name: 'Republic of Maryland', value: 'Republic of Maryland' },
              { name: 'Republic of Oklahoma', value: 'Republic of Oklahoma' },
              { name: 'Republic of Yellowstone', value: 'Republic of Yellowstone' },
              { name: 'Southern California', value: 'Southern California' }
            ))
        .addNumberOption(option =>
          option.setName('amount')
            .setDescription('Investment amount in billions')
            .setRequired(true)
            .setMinValue(0.1)
            .setMaxValue(500))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of investment')
            .setRequired(true)
            .addChoices(
              { name: 'Infrastructure', value: 'infrastructure' },
              { name: 'Military', value: 'military' },
              { name: 'Technology', value: 'technology' },
              { name: 'Education', value: 'education' },
              { name: 'Healthcare', value: 'healthcare' }
            ))
        .addNumberOption(option =>
          option.setName('expected_return')
            .setDescription('Expected return percentage')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100))
        .addIntegerOption(option =>
          option.setName('duration_months')
            .setDescription('Investment duration in months')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(120)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('respond')
        .setDescription('Accept or decline an investment proposal')
        .addIntegerOption(option =>
          option.setName('investment_id')
            .setDescription('ID of the investment proposal')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Accept or decline the investment')
            .setRequired(true)
            .addChoices(
              { name: 'Accept', value: 'accept' },
              { name: 'Decline', value: 'decline' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all investments involving your nation'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get detailed information about a specific investment')
        .addIntegerOption(option =>
          option.setName('investment_id')
            .setDescription('ID of the investment')
            .setRequired(true)));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to manage investments.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this.handleCreate(interaction, dbManager, logger, userLink.nationName);
        break;
      case 'respond':
        await this.handleRespond(interaction, dbManager, logger, userLink.nationName);
        break;
      case 'list':
        await this.handleList(interaction, dbManager, logger, userLink.nationName);
        break;
      case 'info':
        await this.handleInfo(interaction, dbManager, logger, userLink.nationName);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, investorNation: string): Promise<void> {
    const targetNation = interaction.options.getString('target', true);
    const amount = interaction.options.getNumber('amount', true);
    const investmentType = interaction.options.getString('type', true);
    const expectedReturn = interaction.options.getNumber('expected_return', true);
    const durationMonths = interaction.options.getInteger('duration_months', true);

    try {
      // Check if target nation exists
      const targetNationData = dbManager.getNationByName(targetNation);
      if (!targetNationData) {
        // Get all nations for suggestions
        const allNations = dbManager.getAllNations();
        const nationList = allNations.map(n => n.name).sort().join(', ');
        
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${targetNation}" was not found.`)
          .addFields({
            name: '📋 Available Nations',
            value: nationList.length > 1024 ? nationList.substring(0, 1021) + '...' : nationList,
            inline: false
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Can't invest in your own nation
      if (targetNation.toLowerCase() === investorNation.toLowerCase()) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Cannot Invest in Own Nation')
          .setDescription('You cannot create an investment proposal for your own nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if investor nation has enough budget
      const investorNationData = dbManager.getNationByName(investorNation);
      if (!investorNationData || investorNationData.budget < amount) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Insufficient Budget')
          .setDescription(`Your nation doesn't have enough budget for this investment. Available: ${investorNationData?.budget.toFixed(2)}B`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create the investment proposal
      const investmentId = dbManager.createInvestmentProposal(investorNation, targetNation, amount, investmentType, expectedReturn, durationMonths, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📈 Investment Proposal Created')
        .setDescription(`Investment proposal sent from **${investorNation}** to **${targetNation}**`)
        .addFields(
          { name: '💵 Amount', value: `${amount.toFixed(2)}B`, inline: true },
          { name: '🏗️ Type', value: investmentType.charAt(0).toUpperCase() + investmentType.slice(1), inline: true },
          { name: '📊 Expected Return', value: `${expectedReturn.toFixed(1)}%`, inline: true },
          { name: '📅 Duration', value: `${durationMonths} months`, inline: true },
          { name: '🆔 Investment ID', value: `#${investmentId}`, inline: true },
          { name: '⏳ Status', value: 'Pending Approval', inline: true }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating investment:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Investment')
        .setDescription((error as Error).message || 'An error occurred while creating the investment proposal. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleRespond(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const investmentId = interaction.options.getInteger('investment_id', true);
    const action = interaction.options.getString('action', true);

    try {
      const investment = dbManager.getInvestmentById(investmentId);
      
      if (!investment) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Investment Not Found')
          .setDescription(`Investment #${investmentId} was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if user's nation is the target
      if (investment.target_nation !== nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Your Investment')
          .setDescription('You can only respond to investment proposals targeting your nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if already responded
      if (investment.status !== 'pending') {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Already Responded')
          .setDescription(`This investment proposal has already been ${investment.status}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (action === 'accept') {
        dbManager.acceptInvestment(investmentId, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Investment Accepted')
          .setDescription(`Investment from **${investment.investor_nation}** has been accepted`)
          .addFields(
            { name: '💵 Amount', value: `${investment.amount.toFixed(2)}B`, inline: true },
            { name: '🏗️ Type', value: investment.investment_type.charAt(0).toUpperCase() + investment.investment_type.slice(1), inline: true },
            { name: '📊 Expected Return', value: `${investment.expected_return.toFixed(1)}%`, inline: true }
          )
          .setFooter({ text: `Accepted by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        dbManager.declineInvestment(investmentId, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Investment Declined')
          .setDescription(`Investment from **${investment.investor_nation}** has been declined`)
          .setFooter({ text: `Declined by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error('Error responding to investment:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Responding to Investment')
        .setDescription('An error occurred while responding to the investment. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    try {
      const investments = dbManager.getInvestmentsByNation(nationName);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📈 Investments - ${nationName}`)
        .setTimestamp();

      if (investments.length === 0) {
        embed.setDescription('No investments found for this nation.');
      } else {
        const investmentsList = investments.map((investment: any) => {
          const isInvestor = investment.investor_nation === nationName;
          const otherParty = isInvestor ? investment.target_nation : investment.investor_nation;
          const role = isInvestor ? 'Investor' : 'Target';
          const statusIcon = investment.status === 'active' ? '🟢' : investment.status === 'completed' ? '✅' : investment.status === 'pending' ? '🟡' : '❌';
          
          return `**#${investment.id}** - ${role} (${statusIcon} ${investment.status})\n` +
                 `└ ${isInvestor ? 'In' : 'From'}: **${otherParty}**\n` +
                 `└ Amount: ${investment.amount.toFixed(2)}B (${investment.investment_type})\n` +
                 `└ Return: ${investment.expected_return}% | Value: ${investment.current_value.toFixed(2)}B`;
        }).join('\n\n');

        embed.setDescription(investmentsList);
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing investments:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Listing Investments')
        .setDescription('An error occurred while listing investments. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleInfo(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const investmentId = interaction.options.getInteger('investment_id', true);

    try {
      const investment = dbManager.getInvestmentById(investmentId);

      if (!investment) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Investment Not Found')
          .setDescription(`Investment #${investmentId} was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if user's nation is involved in this investment
      if (investment.investor_nation !== nationName && investment.target_nation !== nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Access Denied')
          .setDescription('You can only view investments involving your nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const isInvestor = investment.investor_nation === nationName;
      const createdDate = new Date(investment.created_at);
      const maturityDate = new Date(investment.maturity_date);
      const statusIcon = investment.status === 'active' ? '🟢' : investment.status === 'completed' ? '✅' : investment.status === 'pending' ? '🟡' : '❌';

      const embed = new EmbedBuilder()
        .setColor(investment.status === 'active' ? 0x0099ff : investment.status === 'completed' ? 0x00ff00 : investment.status === 'pending' ? 0xffff00 : 0xff0000)
        .setTitle(`📈 Investment #${investment.id} Details`)
        .addFields(
          { name: '💼 Investor', value: investment.investor_nation, inline: true },
          { name: '🎯 Target', value: investment.target_nation, inline: true },
          { name: '📊 Status', value: `${statusIcon} ${investment.status.replace('_', ' ').toUpperCase()}`, inline: true },
          { name: '💵 Amount', value: `${investment.amount.toFixed(2)}B`, inline: true },
          { name: '💰 Current Value', value: `${investment.current_value.toFixed(2)}B`, inline: true },
          { name: '📈 Expected Return', value: `${investment.expected_return.toFixed(2)}%`, inline: true },
          { name: '🏗️ Type', value: investment.investment_type.charAt(0).toUpperCase() + investment.investment_type.slice(1), inline: true },
          { name: '📅 Duration', value: `${investment.duration} months`, inline: true },
          { name: '🗓️ Created', value: createdDate.toLocaleDateString(), inline: true },
          { name: '⏰ Maturity Date', value: maturityDate.toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `You are the ${isInvestor ? 'investor' : 'target'} in this investment` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error getting investment info:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Getting Investment Info')
        .setDescription('An error occurred while retrieving investment information. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    // No autocomplete functionality
    await interaction.respond([]);
  }
}