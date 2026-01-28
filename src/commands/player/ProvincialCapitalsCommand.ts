import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';

export class ProvincialCapitalsCommand implements Command {
  public data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName('provincial-capitals')
    .setDescription('Manage provincial capitals for your nation')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a provincial capital')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the provincial capital')
            .setRequired(true)
            .setMaxLength(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a provincial capital')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Name of the provincial capital to remove')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all provincial capitals for your nation'));

  public async execute(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger): Promise<void> {
    // Check if user has a linked nation
    const userLink = dbManager.getUserLink(interaction.user.id);
    if (!userLink) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Linked Nation')
        .setDescription('You must have a linked nation to manage provincial capitals.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await this.handleAdd(interaction, dbManager, logger, userLink.nationName);
        break;
      case 'remove':
        await this.handleRemove(interaction, dbManager, logger, userLink.nationName);
        break;
      case 'list':
        await this.handleList(interaction, dbManager, logger, userLink.nationName);
        break;
      default:
        await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
  }

  private async handleAdd(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const capitalName = interaction.options.getString('name', true);

    try {
      const success = dbManager.addProvincialCapital(nationName, capitalName, interaction.user.id);
      
      if (success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏙️ Provincial Capital Added')
          .setDescription(`Successfully added **${capitalName}** as a provincial capital for **${nationName}**`)
          .setFooter({ text: `Added by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Add Capital')
          .setDescription('An error occurred while adding the provincial capital.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      logger.error('Error adding provincial capital:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Adding Capital')
        .setDescription((error as Error).message || 'An error occurred while adding the provincial capital.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleRemove(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    const capitalName = interaction.options.getString('name', true);

    try {
      const success = dbManager.removeProvincialCapital(nationName, capitalName, interaction.user.id);
      
      if (success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🏙️ Provincial Capital Removed')
          .setDescription(`Successfully removed **${capitalName}** as a provincial capital from **${nationName}**`)
          .setFooter({ text: `Removed by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Capital Not Found')
          .setDescription(`Provincial capital "${capitalName}" was not found for ${nationName}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      logger.error('Error removing provincial capital:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Removing Capital')
        .setDescription('An error occurred while removing the provincial capital.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, dbManager: DatabaseManager, logger: Logger, nationName: string): Promise<void> {
    try {
      const nation = dbManager.getNationByName(nationName);
      if (!nation) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Nation Not Found')
          .setDescription(`Nation "${nationName}" was not found.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🏙️ Provincial Capitals - ${nationName}`)
        .setTimestamp();

      if (!nation.provincialCapitals || nation.provincialCapitals.length === 0) {
        embed.setDescription('No provincial capitals have been set for this nation.');
      } else {
        const capitalsList = nation.provincialCapitals.map((capital, index) => 
          `${index + 1}. **${capital}**`
        ).join('\n');
        
        embed.setDescription(`**Provincial Capitals (${nation.provincialCapitals.length}):**\n${capitalsList}`);
        
        // No footer needed since there's no limit
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error listing provincial capitals:', { error: error as Error });
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error Listing Capitals')
        .setDescription('An error occurred while listing provincial capitals.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  public async autocomplete(interaction: AutocompleteInteraction, dbManager: DatabaseManager): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'name' && interaction.options.getSubcommand() === 'remove') {
      // For remove command, show current provincial capitals
      const userLink = dbManager.getUserLink(interaction.user.id);
      if (userLink) {
        const nation = dbManager.getNationByName(userLink.nationName);
        if (nation && nation.provincialCapitals) {
          const choices = nation.provincialCapitals
            .filter(capital => capital.toLowerCase().includes(focusedOption.value.toLowerCase()))
            .slice(0, 25)
            .map(capital => ({
              name: capital,
              value: capital
            }));
          
          await interaction.respond(choices);
          return;
        }
      }
      
      await interaction.respond([]);
    }
  }
}