import { config } from 'dotenv';
import { REST, Routes } from 'discord.js';

// Import all commands to get their data
import { AdminNationEditCommand } from './commands/admin/AdminNationEdit';
import { AdminLinkUserCommand } from './commands/admin/AdminLinkUser';
import { AdminActivityCommand } from './commands/admin/AdminActivity';
import { AdminDisasterCommand } from './commands/admin/AdminDisaster';
import { AdminWarAddCommand } from './commands/admin/AdminWarAdd';
import { AdminWarUpdateCommand } from './commands/admin/AdminWarUpdate';
import { AdminNationAddCommand } from './commands/admin/AdminNationAdd';
import { AdminNationDeleteCommand } from './commands/admin/AdminNationDelete';
import { AdminNationRenameCommand } from './commands/admin/AdminNationRename';
import { AdminAllianceAddCommand } from './commands/admin/AdminAllianceAdd';
import { AdminAllianceRemoveCommand } from './commands/admin/AdminAllianceRemove';
import { AdminUnlinkUserCommand } from './commands/admin/AdminUnlinkUser';
import { AdminBackupCommand } from './commands/admin/AdminBackup';
import { AdminAuditCommand } from './commands/admin/AdminAudit';
import { AdminEndWarCommand } from './commands/admin/AdminEndWar';
import { AdminSetCapitalCommand } from './commands/admin/AdminSetCapital';
import { AdminSetFlagCommand } from './commands/admin/AdminSetFlag';
import { AdminRemoveTagCommand } from './commands/admin/AdminRemoveTag';
import { AdminSetPrefixCommand } from './commands/admin/AdminSetPrefix';

import { NationCommand } from './commands/player/NationCommand';
import { WarsCommand } from './commands/player/WarsCommand';
import { RankingsCommand } from './commands/player/RankingsCommand';
import { NationRenameCommand } from './commands/player/NationRenameCommand';
import { AllianceRequestCommand } from './commands/player/AllianceRequestCommand';
import { AllianceRespondCommand } from './commands/player/AllianceRespondCommand';
import { AlliancesCommand } from './commands/player/AlliancesCommand';
import { UnallyCommand } from './commands/player/UnallyCommand';
import { SetCapitalCommand } from './commands/player/SetCapital';
import { SetFlagCommand } from './commands/player/SetFlag';
import { SetTaxRateCommand } from './commands/player/SetTaxRateCommand';
import { SetPrefixCommand } from './commands/player/SetPrefixCommand';
import { AddLawCommand } from './commands/player/AddLawCommand';
import { ReadLawCommand } from './commands/player/ReadLawCommand';
import { ListLawsCommand } from './commands/player/ListLawsCommand';
import { DeleteLawCommand } from './commands/player/DeleteLawCommand';
import { AddTagCommand } from './commands/player/AddTagCommand';
import { ListTagsCommand } from './commands/player/ListTagsCommand';
import { TagInfoCommand } from './commands/player/TagInfoCommand';
import { AddDescCommand } from './commands/player/AddDescCommand';

// Load environment variables
config();

const commands = [
  // Admin commands
  new AdminNationEditCommand().data.toJSON(),
  new AdminLinkUserCommand().data.toJSON(),
  new AdminActivityCommand().data.toJSON(),
  new AdminDisasterCommand().data.toJSON(),
  new AdminWarAddCommand().data.toJSON(),
  new AdminWarUpdateCommand().data.toJSON(),
  new AdminNationAddCommand().data.toJSON(),
  new AdminNationDeleteCommand().data.toJSON(),
  new AdminNationRenameCommand().data.toJSON(),
  new AdminAllianceAddCommand().data.toJSON(),
  new AdminAllianceRemoveCommand().data.toJSON(),
  new AdminBackupCommand().data.toJSON(),
  new AdminUnlinkUserCommand().data.toJSON(),
  new AdminAuditCommand().data.toJSON(),
  new AdminEndWarCommand().data.toJSON(),
  new AdminSetCapitalCommand().data.toJSON(),
  new AdminSetFlagCommand().data.toJSON(),
  new AdminRemoveTagCommand().data.toJSON(),
  new AdminSetPrefixCommand().data.toJSON(),

  
  // Player commands
  new NationCommand().data.toJSON(),
  new WarsCommand().data.toJSON(),
  new RankingsCommand().data.toJSON(),
  new NationRenameCommand().data.toJSON(),
  new AllianceRequestCommand().data.toJSON(),
  new AllianceRespondCommand().data.toJSON(),
  new AlliancesCommand().data.toJSON(),
  new UnallyCommand().data.toJSON(),
  new SetCapitalCommand().data.toJSON(),
  new SetFlagCommand().data.toJSON(),
  new SetTaxRateCommand().data.toJSON(),
  new SetPrefixCommand().data.toJSON(),
  new AddLawCommand().data.toJSON(),
  new ReadLawCommand().data.toJSON(),
  new ListLawsCommand().data.toJSON(),
  new DeleteLawCommand().data.toJSON(),
  new AddTagCommand().data.toJSON(),
  new ListTagsCommand().data.toJSON(),
  new TagInfoCommand().data.toJSON(),
  new AddDescCommand().data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

async function deployCommands(): Promise<void> {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    let data: any;
    
    if (process.env.GUILD_ID) {
      // Deploy to specific guild (faster for development)
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} guild application (/) commands.`);
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commands },
      );
      console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
    }
  } catch (error) {
    console.error('Error deploying commands:', error);
    process.exit(1);
  }
}

deployCommands();