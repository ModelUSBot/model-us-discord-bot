import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder, MessageFlags } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { PermissionManager } from '../../bot/PermissionManager';

export class AdminLoansCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('admin-loans')
    .setDescription('Admin management of loans between nations')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a loan between any nations')
        .addStringOption(option =>
          option.setName('lender')
            .setDescription('Nation providing the loan')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('borrower')
            .setDescription('Nation receiving the loan')
            .setRequired(true)
            .setAutocomplete(true))
        .addNumberOption(option =>
          option.setName('amount')
            .setDescription('Loan amount in billions')
            .setRequired(true)
            .setMinValue(0.1)
            .setMaxValue(10000))
        .addNumberOption(option =>
          option.setName('interest_rate')
            .setDescription('Annual interest rate (percentage)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100))
        .addIntegerOption(option =>
          option.setName('term_months')
            .setDescription('Loan term in months')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(600)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('respond')
        .setDescription('Respond to a loan proposal on behalf of a nation')
        .addStringOption(option =>
          option.setName('loan_code')
            .setDescription('Code of the loan proposal (e.g., LOAN-ABC123)')
            .setRequired(true))
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
        .setName('approve')
        .setDescription('Approve a pending loan')
        .addIntegerOption(option =>
          option.setName('loan_id')
            .setDescription('ID of the loan to approve')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('decline')
        .setDescription('Decline a pending loan')
        .addIntegerOption(option =>
          option.setName('loan_id')
            .setDescription('ID of the loan to decline')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('modify')
        .setDescription('Modify an existing loan')
        .addIntegerOption(option =>
          option.setName('loan_id')
            .setDescription('ID of the loan to modify')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('status')
            .setDescription('New status for the loan')
            .setRequired(false)
            .addChoices(
              { name: 'Active', value: 'active' },
              { name: 'Paid Off', value: 'paid_off' },
              { name: 'Defaulted', value: 'defaulted' }
            ))
        .addNumberOption(option =>
          option.setName('remaining_balance')
            .setDescription('New remaining balance')
            .setRequired(false)
            .setMinValue(0)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all loans in the system')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Pending', value: 'pending' },
              { name: 'Active', value: 'active' },
              { name: 'Paid Off', value: 'paid_off' },
              { name: 'Defaulted', value: 'defaulted' },
              { name: 'Declined', value: 'declined' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a loan from the system')
        .addIntegerOption(option =>
          option.setName('loan_id')
            .setDescription('ID of the loan to delete')
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
      case 'create':
        await this.handleCreate(interaction, dbManager, logger);
        break;
      case 'respond':
        await this.handleRespond(interaction, dbManager, logger);
        break;
      case 'approve':
        await this.handleApprove(interaction, dbManager, logger);
        break;
      case 'decline':
        await this.handleDecline(interaction, dbManager, logger);
        break;
      case 'modify':
        await this.handleModify(interaction, dbManager, logger);
        break;
      case 'list':
        await this.handleList(interaction, dbManager, logger);
        break;
      case 'delete':
        await this.handleDelete(interaction, dbManager, logger);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const lenderNation = interaction.options.getString('lender', true);
    const borrowerNation = interaction.options.getString('borrower', true);
    const amount = interaction.options.getNumber('amount', true);
    const interestRate = interaction.options.getNumber('interest_rate', true);
    const termMonths = interaction.options.getInteger('term_months', true);

    try {
      // Validate nations exist
      const lender = dbManager.getNationByName(lenderNation);
      const borrower = dbManager.getNationByName(borrowerNation);

      if (!lender) {
        await interaction.reply({ content: `❌ Lender nation "${lenderNation}" not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (!borrower) {
        await interaction.reply({ content: `❌ Borrower nation "${borrowerNation}" not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (lenderNation.toLowerCase() === borrowerNation.toLowerCase()) {
        await interaction.reply({ content: '❌ Lender and borrower cannot be the same nation.', flags: MessageFlags.Ephemeral });
        return;
      }

      // Create loan directly as active (admin override)
      const monthlyPayment = dbManager.calculateCompoundMonthlyPayment(amount, interestRate, termMonths);
      const trueCompoundAmount = dbManager.calculateCompoundAmount(amount, interestRate, termMonths);
      const riskCheck = dbManager.isLoanTermRealistic(interestRate, termMonths);
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + termMonths);

      // Generate loan code
      const loanCode = (dbManager as any).generateLoanCode();
      const description = `Admin-created loan: ${lenderNation} → ${borrowerNation}`;

      const stmt = (dbManager as any).db.prepare(`
        INSERT INTO loans (lender_nation, borrower_nation, amount, interest_rate, term_months, loan_type, monthly_payment, remaining_balance, due_date, status, accepted_at, loan_code, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, ?)
      `);

      const result = stmt.run(lenderNation, borrowerNation, amount, interestRate, termMonths, 'compound', monthlyPayment, amount, dueDate.toISOString(), loanCode, description);
      const loanId = result.lastInsertRowid as number;

      dbManager.logAdminAction(interaction.user.id, 'ADMIN_CREATE_LOAN', `Created loan: ${lenderNation} → ${borrowerNation}, $${amount}B at ${interestRate}%`);

      const totalInterestCompound = trueCompoundAmount - amount;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('💰 Loan Created (Admin)')
        .setDescription(`Successfully created active loan`)
        .addFields(
          { name: '🏦 Lender', value: lenderNation, inline: true },
          { name: '🏛️ Borrower', value: borrowerNation, inline: true },
          { name: '🆔 Loan Code', value: `**${loanCode}**`, inline: true },
          { name: '💵 Amount', value: `$${amount.toFixed(2)}B`, inline: true },
          { name: '📈 Interest Rate', value: `${interestRate.toFixed(2)}%`, inline: true },
          { name: '📅 Term', value: `${termMonths} months`, inline: true },
          { name: '💸 Monthly Payment', value: `$${monthlyPayment.toFixed(2)}B`, inline: true },
          { name: '💰 Total Amount Due', value: `$${trueCompoundAmount.toFixed(2)}B`, inline: true },
          { name: '📊 Total Interest', value: `$${totalInterestCompound.toFixed(2)}B`, inline: true }
        )
        .setFooter({ text: `Created by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error creating admin loan:', { error: error as Error });
      await interaction.reply({ content: '❌ Error creating loan. Please try again.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleRespond(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
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

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      // Check if already responded
      if (loan.status !== 'pending') {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Already Responded')
          .setDescription(`This loan proposal has already been ${loan.status}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === 'accept') {
        dbManager.acceptLoan(loan.id, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Loan Accepted (Admin)')
          .setDescription(`Loan **${loanCode}** from **${loan.lender_nation}** has been accepted on behalf of **${loan.borrower_nation}**`)
          .addFields(
            { name: '💵 Amount', value: `${loan.amount.toFixed(2)}B`, inline: true },
            { name: '📈 Interest Rate', value: `${loan.interest_rate.toFixed(2)}%`, inline: true },
            { name: '📅 Term', value: `${loan.term_months} months`, inline: true },
            { name: '💸 Monthly Payment', value: `${loan.monthly_payment.toFixed(2)}B`, inline: true },
            { name: '📝 Description', value: loan.description || 'No description', inline: false }
          )
          .setFooter({ text: `Accepted by Admin: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        dbManager.declineLoan(loan.id, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Loan Declined (Admin)')
          .setDescription(`Loan **${loanCode}** from **${loan.lender_nation}** has been declined on behalf of **${loan.borrower_nation}**`)
          .addFields(
            { name: '💵 Amount', value: `${loan.amount.toFixed(2)}B`, inline: true },
            { name: '📈 Interest Rate', value: `${loan.interest_rate.toFixed(2)}%`, inline: true },
            { name: '📝 Description', value: loan.description || 'No description', inline: false }
          )
          .setFooter({ text: `Declined by Admin: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      logger.error('Error responding to loan (admin):', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Responding to Loan')
        .setDescription('An error occurred while responding to the loan. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  private async handleApprove(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const loanId = interaction.options.getInteger('loan_id', true);

    try {
      const loan = dbManager.getLoanById(loanId);
      if (!loan) {
        await interaction.reply({ content: `❌ Loan #${loanId} not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (loan.status !== 'pending') {
        await interaction.reply({ content: `❌ Loan #${loanId} is not pending approval.`, flags: MessageFlags.Ephemeral });
        return;
      }

      dbManager.acceptLoan(loanId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Loan Approved (Admin)')
        .setDescription(`Loan #${loanId} has been approved`)
        .addFields(
          { name: '🏦 Lender', value: loan.lender_nation, inline: true },
          { name: '🏛️ Borrower', value: loan.borrower_nation, inline: true },
          { name: '💵 Amount', value: `${loan.amount.toFixed(2)}B`, inline: true }
        )
        .setFooter({ text: `Approved by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error approving loan:', { error: error as Error });
      await interaction.reply({ content: '❌ Error approving loan. Please try again.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleDecline(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const loanId = interaction.options.getInteger('loan_id', true);

    try {
      const loan = dbManager.getLoanById(loanId);
      if (!loan) {
        await interaction.reply({ content: `❌ Loan #${loanId} not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (loan.status !== 'pending') {
        await interaction.reply({ content: `❌ Loan #${loanId} is not pending approval.`, flags: MessageFlags.Ephemeral });
        return;
      }

      dbManager.declineLoan(loanId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Loan Declined (Admin)')
        .setDescription(`Loan #${loanId} has been declined`)
        .addFields(
          { name: '🏦 Lender', value: loan.lender_nation, inline: true },
          { name: '🏛️ Borrower', value: loan.borrower_nation, inline: true },
          { name: '💵 Amount', value: `${loan.amount.toFixed(2)}B`, inline: true }
        )
        .setFooter({ text: `Declined by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error declining loan:', { error: error as Error });
      await interaction.reply({ content: '❌ Error declining loan. Please try again.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleModify(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const loanId = interaction.options.getInteger('loan_id', true);
    const newStatus = interaction.options.getString('status');
    const newBalance = interaction.options.getNumber('remaining_balance');

    try {
      const loan = dbManager.getLoanById(loanId);
      if (!loan) {
        await interaction.reply({ content: `❌ Loan #${loanId} not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      let updates = [];
      let params = [];

      if (newStatus) {
        updates.push('status = ?');
        params.push(newStatus);
      }

      if (newBalance !== null) {
        updates.push('remaining_balance = ?');
        params.push(newBalance);
      }

      if (updates.length === 0) {
        await interaction.reply({ content: '❌ No modifications specified.', flags: MessageFlags.Ephemeral });
        return;
      }

      params.push(loanId);
      const stmt = (dbManager as any).db.prepare(`
        UPDATE loans SET ${updates.join(', ')} WHERE id = ?
      `);
      stmt.run(...params);

      dbManager.logAdminAction(interaction.user.id, 'ADMIN_MODIFY_LOAN', `Modified loan #${loanId}: ${updates.join(', ')}`);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('✏️ Loan Modified (Admin)')
        .setDescription(`Loan #${loanId} has been updated`)
        .addFields(
          { name: '🏦 Lender', value: loan.lender_nation, inline: true },
          { name: '🏛️ Borrower', value: loan.borrower_nation, inline: true },
          { name: '💵 Original Amount', value: `${loan.amount.toFixed(2)}B`, inline: true }
        )
        .setFooter({ text: `Modified by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      if (newStatus) {
        embed.addFields({ name: '📊 New Status', value: newStatus.toUpperCase(), inline: true });
      }
      if (newBalance !== null) {
        embed.addFields({ name: '💰 New Balance', value: `$${newBalance.toFixed(2)}B`, inline: true });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error modifying loan:', { error: error as Error });
      await interaction.reply({ content: '❌ Error modifying loan. Please try again.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const statusFilter = interaction.options.getString('status') || 'all';

    try {
      let query = 'SELECT * FROM loans';
      let params: any[] = [];

      if (statusFilter !== 'all') {
        query += ' WHERE status = ?';
        params.push(statusFilter);
      }

      query += ' ORDER BY created_at DESC LIMIT 20';

      const stmt = (dbManager as any).db.prepare(query);
      const loans = stmt.all(...params);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`💰 Loans List (Admin) - ${statusFilter.toUpperCase()}`)
        .setTimestamp();

      if (loans.length === 0) {
        embed.setDescription('No loans found matching the criteria.');
      } else {
        const loansList = loans.map((loan: any) => {
          const statusIcon = loan.status === 'active' ? '🟢' : loan.status === 'paid_off' ? '✅' : loan.status === 'pending' ? '🟡' : '❌';
          const loanCode = loan.loan_code || `ID-${loan.id}`;
          const description = loan.description || 'No description';
          
          // Ensure numeric values are properly converted
          const amount = typeof loan.amount === 'string' ? parseFloat(loan.amount) : (loan.amount || 0);
          const interestRate = typeof loan.interest_rate === 'string' ? parseFloat(loan.interest_rate) : (loan.interest_rate || 0);
          const remainingBalance = typeof loan.remaining_balance === 'string' ? parseFloat(loan.remaining_balance) : (loan.remaining_balance || 0);
          
          return `**${loanCode}** ${statusIcon} ${loan.status.toUpperCase()}\n` +
                 `└ ${loan.lender_nation} → ${loan.borrower_nation}\n` +
                 `└ ${amount.toFixed(1)}B @ ${interestRate.toFixed(1)}% | Balance: ${remainingBalance.toFixed(1)}B\n` +
                 `└ 📝 ${description}`;
        }).join('\n\n');

        embed.setDescription(loansList);
        embed.setFooter({ text: `Showing ${loans.length} loans` });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing loans:', { error: error as Error });
      await interaction.reply({ content: '❌ Error listing loans. Please try again.', flags: MessageFlags.Ephemeral });
    }
  }

  private async handleDelete(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    const loanId = interaction.options.getInteger('loan_id', true);

    try {
      const loan = dbManager.getLoanById(loanId);
      if (!loan) {
        await interaction.reply({ content: `❌ Loan #${loanId} not found.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const stmt = (dbManager as any).db.prepare('DELETE FROM loans WHERE id = ?');
      stmt.run(loanId);

      dbManager.logAdminAction(interaction.user.id, 'ADMIN_DELETE_LOAN', `Deleted loan #${loanId}: ${loan.lender_nation} → ${loan.borrower_nation}`);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🗑️ Loan Deleted (Admin)')
        .setDescription(`Loan #${loanId} has been permanently deleted`)
        .addFields(
          { name: '🏦 Lender', value: loan.lender_nation, inline: true },
          { name: '🏛️ Borrower', value: loan.borrower_nation, inline: true },
          { name: '💵 Amount', value: `${loan.amount.toFixed(2)}B`, inline: true }
        )
        .setFooter({ text: `Deleted by Admin: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error deleting loan:', { error: error as Error });
      await interaction.reply({ content: '❌ Error deleting loan. Please try again.', flags: MessageFlags.Ephemeral });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'lender' || focusedOption.name === 'borrower') {
      const nations = dbManager.searchNationsForAutocomplete(focusedOption.value);
      const choices = nations.slice(0, 25).map(nation => ({
        name: nation.name,
        value: nation.name
      }));
      
      await interaction.respond(choices);
    }
  }
}