import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import fs from 'fs';
import path from 'path';

export class AdminBackupCommand implements Command {
  public data = new SlashCommandBuilder()
    .setName('admin-backup')
    .setDescription('Manage database backups')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Backup action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Create Manual Backup', value: 'create' },
          { name: 'List Recent Backups', value: 'list' },
          { name: 'Cleanup Old Backups', value: 'cleanup' }
        )
    );

  public async execute(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const action = interaction.options.getString('action', true);

    try {
      if (action === 'create') {
        await this.createBackup(interaction, dbManager, logger);
      } else if (action === 'list') {
        await this.listBackups(interaction, dbManager, logger);
      } else if (action === 'cleanup') {
        await this.cleanupBackups(interaction, dbManager, logger);
      }
    } catch (error) {
      logger.error('Error in backup command:', { error: error as Error });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Backup Error')
        .setDescription('An error occurred while performing the backup operation. Please try again.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  private async createBackup(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `model-us-bot-manual-${timestamp}.db`;
    const backupPath = path.join('./data', backupFilename);

    // Create the backup
    dbManager.backup(backupPath);
    
    logger.info(`Database backed up to: ${backupPath}`);

    // Get file size (wait a moment for file to be written)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file was not created at ${backupPath}`);
    }
    
    const stats = fs.statSync(backupPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

    // Record the backup in database
    const recordStmt = (dbManager as any).db.prepare(`
      INSERT INTO backup_records (filename, created_by, size, type)
      VALUES (?, ?, ?, 'manual')
    `);
    recordStmt.run(backupFilename, interaction.user.id, fileSizeInBytes);

    // Log admin action
    dbManager.logAdminAction(
      interaction.user.id,
      'BACKUP_CREATE',
      `Created manual backup: ${backupFilename} (${fileSizeInMB} MB)`
    );

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Backup Created Successfully')
      .addFields(
        { name: '📁 Filename', value: backupFilename, inline: true },
        { name: '📊 Size', value: `${fileSizeInMB} MB`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Created by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  private async listBackups(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const backupsStmt = (dbManager as any).db.prepare(`
      SELECT filename, created_at, created_by, size, type
      FROM backup_records
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const backups = backupsStmt.all();

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📁 Recent Database Backups')
      .setTimestamp();

    if (backups.length === 0) {
      embed.setDescription('No backup records found.');
    } else {
      const backupList = backups.map((backup: any) => {
        const createdDate = new Date(backup.created_at);
        const sizeInMB = (backup.size / (1024 * 1024)).toFixed(2);
        const typeIcon = backup.type === 'manual' ? '👤' : '🤖';
        const creatorText = backup.created_by ? `<@${backup.created_by}>` : 'Automatic';
        
        return `${typeIcon} **${backup.filename}**\n` +
               `   📊 ${sizeInMB} MB • 📅 <t:${Math.floor(createdDate.getTime() / 1000)}:R> • 👤 ${creatorText}`;
      }).join('\n\n');

      embed.setDescription(`**Recent Backups (${backups.length}/10):**\n\n${backupList}`);
    }

    await interaction.reply({ embeds: [embed] });
  }

  private async cleanupBackups(
    interaction: ChatInputCommandInteraction,
    dbManager: DatabaseManager,
    logger: Logger
  ): Promise<void> {
    const dataDir = './data';
    const files = fs.readdirSync(dataDir);
    const backupFiles = files.filter(file => 
      file.includes('backup') && file.endsWith('.db') && file !== 'model-us-bot.db'
    );

    // Keep only the 10 most recent backups
    const backupFilesWithStats = backupFiles.map(file => {
      const filePath = path.join(dataDir, file);
      const stats = fs.statSync(filePath);
      return { file, path: filePath, mtime: stats.mtime };
    });

    // Sort by modification time (newest first)
    backupFilesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Delete old backups (keep only 10 most recent)
    const filesToDelete = backupFilesWithStats.slice(10);
    let deletedCount = 0;
    let totalSizeFreed = 0;

    for (const fileInfo of filesToDelete) {
      try {
        const stats = fs.statSync(fileInfo.path);
        totalSizeFreed += stats.size;
        fs.unlinkSync(fileInfo.path);
        deletedCount++;

        // Remove from backup records
        const deleteRecordStmt = (dbManager as any).db.prepare(`
          DELETE FROM backup_records WHERE filename = ?
        `);
        deleteRecordStmt.run(fileInfo.file);
      } catch (error) {
        logger.warn(`Failed to delete backup file ${fileInfo.file}:`, { error: error as Error });
      }
    }

    // Log admin action
    dbManager.logAdminAction(
      interaction.user.id,
      'BACKUP_CLEANUP',
      `Cleaned up ${deletedCount} old backup files, freed ${(totalSizeFreed / (1024 * 1024)).toFixed(2)} MB`
    );

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Backup Cleanup Complete')
      .addFields(
        { name: '🗑️ Files Deleted', value: deletedCount.toString(), inline: true },
        { name: '💾 Space Freed', value: `${(totalSizeFreed / (1024 * 1024)).toFixed(2)} MB`, inline: true },
        { name: '📁 Files Remaining', value: (backupFilesWithStats.length - deletedCount).toString(), inline: true }
      )
      .setDescription(deletedCount > 0 ? 'Old backup files have been cleaned up.' : 'No old backup files to clean up.')
      .setFooter({ text: `Cleaned by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
