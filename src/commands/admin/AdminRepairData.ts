import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class AdminRepairDataCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-repair-data')
    .setDescription('Repair corrupted data in the database (admin only)')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of data to repair')
        .setRequired(true)
        .addChoices(
          { name: 'Provincial Capitals', value: 'capitals' },
          { name: 'All Data', value: 'all' }
        ));

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const repairType = interaction.options.getString('type', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      let totalRepaired = 0;
      const allErrors: string[] = [];

      if (repairType === 'capitals' || repairType === 'all') {
        const result = dbManager.repairProvincialCapitals();
        totalRepaired += result.repaired;
        allErrors.push(...result.errors);
      }

      const embed = new EmbedBuilder()
        .setColor(totalRepaired > 0 ? 0x00ff00 : 0x0099ff)
        .setTitle('🔧 Data Repair Complete')
        .setDescription(`Repaired **${totalRepaired}** corrupted records`)
        .setFooter({ text: `Repair initiated by ${interaction.user.tag}` })
        .setTimestamp();

      if (allErrors.length > 0) {
        embed.addFields({
          name: 'Repair Details',
          value: allErrors.slice(0, 10).join('\n') + (allErrors.length > 10 ? `\n... and ${allErrors.length - 10} more` : ''),
          inline: false
        });
      }

      if (totalRepaired === 0) {
        embed.setDescription('No corrupted data found. All records are healthy! ✅');
      }

      await interaction.editReply({ embeds: [embed] });

      logger.info('Data repair completed', {
        user: interaction.user.tag,
        metadata: {
          repairType,
          totalRepaired,
          errorCount: allErrors.length
        }
      });

    } catch (error) {
      logger.error('Error during data repair:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Repair Failed')
        .setDescription('An error occurred during data repair. Check logs for details.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
}