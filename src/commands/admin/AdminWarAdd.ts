import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AdminWarAddCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-war-add')
    .setDescription('Add a new war record (Admin only)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the war')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('participants')
        .setDescription('Participating nations (comma-separated)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('start_date')
        .setDescription('Start date (YYYY-MM-DD)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('end_date')
        .setDescription('End date (YYYY-MM-DD, optional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('casualties')
        .setDescription('Number of casualties')
        .setMinValue(0)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('War description')
        .setRequired(false)
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const name = interaction.options.getString('name', true);
    const participantsStr = interaction.options.getString('participants', true);
    const startDateStr = interaction.options.getString('start_date', true);
    const endDateStr = interaction.options.getString('end_date');
    const casualties = interaction.options.getInteger('casualties') ?? 0;
    const description = interaction.options.getString('description');

    try {
      const participants = participantsStr.split(',').map(p => p.trim());
      const startDate = new Date(startDateStr);
      const endDate = endDateStr ? new Date(endDateStr) : undefined;

      if (isNaN(startDate.getTime())) {
        await interaction.reply({
          content: '❌ Invalid start date format. Please use YYYY-MM-DD.',
          ephemeral: true
        });
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        await interaction.reply({
          content: '❌ Invalid end date format. Please use YYYY-MM-DD.',
          ephemeral: true
        });
        return;
      }

      const war = dbManager.createWar({
        name,
        participants,
        startDate,
        endDate,
        casualties,
        description: description || undefined,
        status: endDate ? 'ended' : 'active'
      });

      dbManager.logAdminAction(
        interaction.user.id,
        'ADD_WAR',
        `Added war "${name}" with ${participants.length} participants`
      );

      const embed = new EmbedBuilder()
        .setTitle('⚔️ War Record Added')
        .setDescription(`Successfully added war record: **${war.name}**`)
        .addFields(
          { name: '🏛️ Participants', value: war.participants.join(', '), inline: false },
          { name: '📅 Start Date', value: war.startDate.toDateString(), inline: true },
          { name: '📅 End Date', value: war.endDate?.toDateString() || 'Ongoing', inline: true },
          { name: '💀 Casualties', value: war.casualties.toLocaleString(), inline: true },
          { name: '📊 Status', value: war.status.toUpperCase(), inline: true }
        )
        .setColor(war.status === 'active' ? 0xff4500 : 0x808080)
        .setTimestamp();

      if (war.description) {
        embed.addFields({ name: '📝 Description', value: war.description, inline: false });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error adding war:', { error: error as Error });
      
      await interaction.reply({
        content: '❌ An error occurred while adding the war record. Please try again.',
        ephemeral: true
      });
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