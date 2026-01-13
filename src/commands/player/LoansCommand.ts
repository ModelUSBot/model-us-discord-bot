import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class LoansCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('loans')
    .setDescription('Manage loans between nations')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a loan proposal to another nation')
        .addStringOption(option =>
          option.setName('borrower')
            .setDescription('Nation that will receive the loan')
            .setRequired(true)
            .setAutocomplete(true))
        .addNumberOption(option =>
          option.setName('amount')
            .setDescription('Loan amount in billions')
            .setRequired(true)
            .setMinValue(0.1)
            .setMaxValue(1000))
        .addNumberOption(option =>
          option.setName('interest_rate')
            .setDescription('Annual interest rate (percentage)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(50))
        .addIntegerOption(option =>
          option.setName('term_months')
            .setDescription('Loan term in months')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(360))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Description of the loan purpose')
            .setRequired(true)
            .setMaxLength(200)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('respond')
        .setDescription('Accept or decline a loan proposal')
        .addStringOption(option =>
          option.setName('loan_code')
            .setDescription('Code of the loan proposal (e.g., LOAN-ABC123)')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Accept or decline the loan')
            .setRequired(true)
            .addChoices(
              { name: 'Accept', value: 'accept' },
              { name: 'Decline', value: 'decline' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all loans involving your nation'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get detailed information about a specific loan')
        .addStringOption(option =>
          option.setName('loan_code')
            .setDescription('Code of the loan to view')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pay')
        .setDescription('Make a payment on an active loan')
        .addStringOption(option =>
          option.setName('loan_code')
            .setDescription('Code of the loan to pay (e.g., LOAN-ABC123)')
            .setRequired(true)
            .setAutocomplete(true))
        .addNumberOption(option =>
          option.setName('amount')
            .setDescription('Payment amount in billions (cannot exceed your budget)')
            .setRequired(true)
            .setMinValue(0.01)
            .setMaxValue(1000)));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to manage loans.')
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
      case 'pay':
        await this.handlePay(interaction, dbManager, logger, userLink.nationName);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, lenderNation: string): Promise<void> {
    const borrowerNation = interaction.options.getString('borrower', true);
    const amount = interaction.options.getNumber('amount', true);
    const interestRate = interaction.options.getNumber('interest_rate', true);
    const termMonths = interaction.options.getInteger('term_months', true);
    const description = interaction.options.getString('description', true);

    try {
      // Check if borrower nation exists
      const borrower = dbManager.getNationByName(borrowerNation);
      if (!borrower) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${borrowerNation}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Can't loan to yourself
      if (lenderNation.toLowerCase() === borrowerNation.toLowerCase()) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid Loan')
          .setDescription('You cannot create a loan to your own nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Calculate loan details for TRUE compound interest
      const monthlyPayment = dbManager.calculateCompoundMonthlyPayment(amount, interestRate, termMonths);
      const trueCompoundAmount = dbManager.calculateCompoundAmount(amount, interestRate, termMonths);
      const totalInterestCompound = trueCompoundAmount - amount;

      // Check if loan terms are realistic
      const riskCheck = dbManager.isLoanTermRealistic(interestRate, termMonths);

      // Create the loan proposal
      const loanResult = dbManager.createLoanProposal(lenderNation, borrowerNation, amount, interestRate, termMonths, description, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(riskCheck.realistic ? 0x0099ff : 0xff6600)
        .setTitle('💰 Compound Loan Proposal Created')
        .setDescription(`Compound loan proposal sent from **${lenderNation}** to **${borrowerNation}**\n📝 **${description}**`)
        .addFields(
          { name: '💵 Principal Amount', value: `$${amount.toFixed(2)}B`, inline: true },
          { name: '📈 Interest Rate', value: `${interestRate.toFixed(2)}%`, inline: true },
          { name: '📅 Term', value: `${termMonths} months`, inline: true },
          { name: '💸 Monthly Payment', value: `$${monthlyPayment.toFixed(2)}B`, inline: true },
          { name: '💰 Total Amount Due', value: `$${trueCompoundAmount.toFixed(2)}B`, inline: true },
          { name: '📊 Total Interest', value: `$${totalInterestCompound.toFixed(2)}B`, inline: true },
          { name: '🆔 Loan Code', value: `**${loanResult.code}**`, inline: true },
          { name: '⏳ Status', value: 'Pending Approval', inline: true }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      if (!riskCheck.realistic && riskCheck.warning) {
        embed.addFields({
          name: '⚠️ Risk Warning',
          value: riskCheck.warning,
          inline: false
        });
      }

      // Add compound interest explanation for high rates
      if (interestRate >= 20) {
        embed.addFields({
          name: '📈 Compound Interest Explanation',
          value: `This is a **compound interest** loan. Interest compounds monthly at ${(interestRate/12).toFixed(3)}% per month. The monthly payment of $${monthlyPayment.toFixed(2)}B is calculated to pay off the full compound amount over ${termMonths} months. You can pay extra to reduce the principal faster.`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating loan:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Creating Loan')
        .setDescription('An error occurred while creating the loan proposal. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleRespond(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const loanCode = interaction.options.getString('loan_code', true);
    const action = interaction.options.getString('action', true);

    try {
      const loan = dbManager.getLoanByCode(loanCode);
      
      if (!loan) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Loan Not Found')
          .setDescription(`Loan **${loanCode}** was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if user's nation is the borrower
      if (loan.borrower_nation !== nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Your Loan')
          .setDescription('You can only respond to loan proposals targeting your nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if already responded
      if (loan.status !== 'pending') {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Already Responded')
          .setDescription(`This loan proposal has already been ${loan.status}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (action === 'accept') {
        dbManager.acceptLoan(loan.id, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Loan Accepted')
          .setDescription(`Loan from **${loan.lender_nation}** has been accepted`)
          .addFields(
            { name: '💵 Amount', value: `${loan.amount.toFixed(2)}B`, inline: true },
            { name: '📈 Interest Rate', value: `${loan.interest_rate.toFixed(2)}%`, inline: true },
            { name: '📅 Term', value: `${loan.term_months} months`, inline: true },
            { name: '💸 Monthly Payment', value: `${loan.monthly_payment.toFixed(2)}B`, inline: true }
          )
          .setFooter({ text: `Accepted by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        dbManager.declineLoan(loan.id, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Loan Declined')
          .setDescription(`Loan from **${loan.lender_nation}** has been declined`)
          .setFooter({ text: `Declined by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error('Error responding to loan:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Responding to Loan')
        .setDescription('An error occurred while responding to the loan. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    try {
      const loans = dbManager.getLoansByNation(nationName);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`💰 Loans - ${nationName}`)
        .setTimestamp();

      if (loans.length === 0) {
        embed.setDescription('No loans found for this nation.');
      } else {
        // Group loans by status for better organization
        const pendingLoans = loans.filter((loan: any) => loan.status === 'pending');
        const activeLoans = loans.filter((loan: any) => loan.status === 'active');
        const completedLoans = loans.filter((loan: any) => loan.status === 'paid_off');
        const declinedLoans = loans.filter((loan: any) => loan.status === 'declined');

        let description = '';

        // Show pending loans first
        if (pendingLoans.length > 0) {
          description += '**🟡 PENDING LOANS**\n';
          pendingLoans.forEach((loan: any) => {
            const isLender = loan.lender_nation.toLowerCase() === nationName.toLowerCase();
            const otherParty = isLender ? loan.borrower_nation : loan.lender_nation;
            const role = isLender ? 'Lending to' : 'Borrowing from';
            description += `• **${loan.loan_code}** - ${role} **${otherParty}**\n`;
            description += `  └ ${loan.amount.toFixed(2)}B @ ${loan.interest_rate}% for ${loan.term_months} months\n`;
            description += `  └ 📝 ${loan.description || 'No description'}\n\n`;
          });
        }

        // Show active loans
        if (activeLoans.length > 0) {
          description += '**🟢 ACTIVE LOANS**\n';
          activeLoans.forEach((loan: any) => {
            const isLender = loan.lender_nation.toLowerCase() === nationName.toLowerCase();
            const otherParty = isLender ? loan.borrower_nation : loan.lender_nation;
            const role = isLender ? 'Lending to' : 'Borrowing from';
            description += `• **${loan.loan_code}** - ${role} **${otherParty}**\n`;
            description += `  └ ${loan.amount.toFixed(2)}B @ ${loan.interest_rate}% | Remaining: ${loan.remaining_balance.toFixed(2)}B\n`;
            description += `  └ 📝 ${loan.description || 'No description'}\n\n`;
          });
        }

        // Show completed loans
        if (completedLoans.length > 0) {
          description += '**✅ COMPLETED LOANS**\n';
          completedLoans.forEach((loan: any) => {
            const isLender = loan.lender_nation.toLowerCase() === nationName.toLowerCase();
            const otherParty = isLender ? loan.borrower_nation : loan.lender_nation;
            const role = isLender ? 'Lent to' : 'Borrowed from';
            description += `• **${loan.loan_code}** - ${role} **${otherParty}** (${loan.amount.toFixed(2)}B)\n`;
          });
          description += '\n';
        }

        // Show declined loans
        if (declinedLoans.length > 0) {
          description += '**❌ DECLINED LOANS**\n';
          declinedLoans.forEach((loan: any) => {
            const isLender = loan.lender_nation.toLowerCase() === nationName.toLowerCase();
            const otherParty = isLender ? loan.borrower_nation : loan.lender_nation;
            const role = isLender ? 'Offered to' : 'Declined from';
            description += `• **${loan.loan_code}** - ${role} **${otherParty}** (${loan.amount.toFixed(2)}B)\n`;
          });
        }

        embed.setDescription(description.trim());
        
        // Add summary footer
        const totalActive = activeLoans.length;
        const totalPending = pendingLoans.length;
        embed.setFooter({ 
          text: `Total: ${loans.length} loans | Active: ${totalActive} | Pending: ${totalPending}` 
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing loans:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Listing Loans')
        .setDescription('An error occurred while listing loans. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleInfo(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const loanCode = interaction.options.getString('loan_code', true);

    try {
      const loan = dbManager.getLoanByCode(loanCode);

      if (!loan) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Loan Not Found')
          .setDescription(`Loan **${loanCode}** was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if user's nation is involved in this loan
      if (loan.lender_nation !== nationName && loan.borrower_nation !== nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Access Denied')
          .setDescription('You can only view loans involving your nation.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const isLender = loan.lender_nation === nationName;
      const createdDate = new Date(loan.created_at);
      const dueDate = new Date(loan.due_date);
      const statusIcon = loan.status === 'active' ? '🟢' : loan.status === 'paid_off' ? '✅' : '❌';

      const embed = new EmbedBuilder()
        .setColor(loan.status === 'active' ? 0x0099ff : loan.status === 'paid_off' ? 0x00ff00 : 0xff0000)
        .setTitle(`💰 Loan ${loanCode} Details`)
        .setDescription(`📝 **${loan.description || 'No description'}**`)
        .addFields(
          { name: '🏦 Lender', value: loan.lender_nation, inline: true },
          { name: '🏛️ Borrower', value: loan.borrower_nation, inline: true },
          { name: '📊 Status', value: `${statusIcon} ${loan.status.replace('_', ' ').toUpperCase()}`, inline: true },
          { name: '💵 Original Amount', value: `${loan.amount.toFixed(2)}B`, inline: true },
          { name: '💰 Remaining Balance', value: `${loan.remaining_balance.toFixed(2)}B`, inline: true },
          { name: '📈 Interest Rate', value: `${loan.interest_rate.toFixed(2)}%`, inline: true },
          { name: '💸 Monthly Payment', value: `${loan.monthly_payment.toFixed(2)}B`, inline: true },
          { name: '📅 Term', value: `${loan.term_months} months`, inline: true },
          { name: '🗓️ Created', value: createdDate.toLocaleDateString(), inline: true },
          { name: '⏰ Due Date', value: dueDate.toLocaleDateString(), inline: true }
        )
        .setFooter({ text: `You are the ${isLender ? 'lender' : 'borrower'} in this loan` })
        .setTimestamp();

      if (loan.last_payment) {
        const lastPaymentDate = new Date(loan.last_payment);
        embed.addFields({
          name: '💳 Last Payment',
          value: lastPaymentDate.toLocaleDateString(),
          inline: true
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error getting loan info:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Getting Loan Info')
        .setDescription('An error occurred while retrieving loan information. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handlePay(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const loanCode = interaction.options.getString('loan_code', true);
    const paymentAmount = interaction.options.getNumber('amount', true);

    try {
      const loan = dbManager.getLoanByCode(loanCode);
      
      if (!loan) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Loan Not Found')
          .setDescription(`Loan **${loanCode}** was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if user's nation is the borrower
      if (loan.borrower_nation !== nationName) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Not Your Loan')
          .setDescription('You can only make payments on loans where your nation is the borrower.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if loan is active
      if (loan.status !== 'active') {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Loan Not Active')
          .setDescription(`This loan is ${loan.status} and cannot accept payments.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get nation's current budget
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription('Your nation was not found in the database.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if payment amount exceeds budget
      if (paymentAmount > nation.budget) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Insufficient Budget')
          .setDescription(`Payment amount (${paymentAmount.toFixed(2)}B) exceeds your current budget (${nation.budget.toFixed(2)}B).`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if payment amount exceeds remaining balance
      const actualPayment = Math.min(paymentAmount, loan.remaining_balance);
      
      // Make the payment
      const success = dbManager.makeLoanPayment(loan.id, actualPayment, interaction.user.id);
      
      if (!success) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Payment Failed')
          .setDescription('Failed to process the loan payment. Please try again.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get updated loan info
      const updatedLoan = dbManager.getLoanById(loan.id);
      const newBalance = updatedLoan.remaining_balance;
      const isPaidOff = newBalance <= 0;

      const embed = new EmbedBuilder()
        .setColor(isPaidOff ? 0x00ff00 : 0x0099ff)
        .setTitle(isPaidOff ? '✅ Loan Paid Off!' : '💰 Loan Payment Made')
        .setDescription(`Payment processed for loan **${loanCode}** from **${loan.lender_nation}**\n📝 **${loan.description || 'No description'}**`)
        .addFields(
          { name: '💸 Payment Amount', value: `${actualPayment.toFixed(2)}B`, inline: true },
          { name: '💰 Previous Balance', value: `${loan.remaining_balance.toFixed(2)}B`, inline: true },
          { name: '📊 New Balance', value: `${newBalance.toFixed(2)}B`, inline: true }
        )
        .setFooter({ text: `Payment made by ${interaction.user.tag}` })
        .setTimestamp();

      if (actualPayment < paymentAmount) {
        embed.addFields({
          name: '⚠️ Note',
          value: `Payment was reduced to ${actualPayment.toFixed(2)}B to match remaining balance.`,
          inline: false
        });
      }

      if (isPaidOff) {
        embed.addFields({
          name: '🎉 Congratulations!',
          value: 'This loan has been fully paid off and your national debt has been reduced accordingly.',
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error making loan payment:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Making Payment')
        .setDescription('An error occurred while processing the loan payment. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'borrower') {
      const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
      const choices = nations.slice(0, 25).map(nation => ({
        name: nation.name,
        value: nation.name
      }));
      
      await interaction.respond(choices);
    } else if (focusedOption.name === 'loan_code') {
      // Get user's linked nation
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (!userLink) {
        await interaction.respond([]);
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      
      // Show autocomplete for respond and pay commands
      if (subcommand === 'respond') {
        // For responding, show pending loans where user's nation is the borrower
        const loans = dbManager.getLoansForAutocomplete(userLink.nationName, 'pending')
          .filter(loan => loan.borrower_nation.toLowerCase() === userLink.nationName.toLowerCase());

        // Filter by the focused value if provided
        let filteredLoans = loans;
        if (focusedOption.value) {
          filteredLoans = loans.filter(loan => 
            loan.loan_code.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
            loan.description.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
            loan.lender_nation.toLowerCase().includes(focusedOption.value.toLowerCase())
          );
        }

        const choices = filteredLoans.slice(0, 25).map(loan => {
          const shortDesc = loan.description && loan.description.length > 40 
            ? loan.description.substring(0, 40) + '...' 
            : loan.description || 'No description';
          
          return {
            name: `${loan.loan_code} - From ${loan.lender_nation} - ${loan.amount}B @ ${loan.interest_rate}% - ${shortDesc}`,
            value: loan.loan_code
          };
        });
        
        await interaction.respond(choices);
      } else if (subcommand === 'pay') {
        // For paying, show active loans where user's nation is the borrower
        const loans = dbManager.getLoansForAutocomplete(userLink.nationName, 'active')
          .filter(loan => loan.borrower_nation.toLowerCase() === userLink.nationName.toLowerCase());

        // Filter by the focused value if provided
        let filteredLoans = loans;
        if (focusedOption.value) {
          filteredLoans = loans.filter(loan => 
            loan.loan_code.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
            loan.description.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
            loan.lender_nation.toLowerCase().includes(focusedOption.value.toLowerCase())
          );
        }

        const choices = filteredLoans.slice(0, 25).map(loan => {
          const shortDesc = loan.description && loan.description.length > 30 
            ? loan.description.substring(0, 30) + '...' 
            : loan.description || 'No description';
          
          return {
            name: `${loan.loan_code} - To ${loan.lender_nation} - Balance: ${loan.remaining_balance}B - ${shortDesc}`,
            value: loan.loan_code
          };
        });
        
        await interaction.respond(choices);
      } else {
        // For other commands, don't show autocomplete (user must type the loan code)
        await interaction.respond([]);
      }
    }
  }
}