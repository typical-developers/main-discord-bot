import { ApplicationCommandOptionType, PermissionFlagsBits, type ApplicationCommandSubCommandData } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { UserError } from '@sapphire/framework';

@ApplyOptions<Subcommand.Options>({
})
export class Settings extends Subcommand {
}