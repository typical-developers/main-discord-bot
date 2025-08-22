import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { type ApplicationCommandOptionData, InteractionContextType, ApplicationIntegrationType, ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, ThreadChannel } from "discord.js";

@ApplyOptions<Command.Options>({
    description: 'Pin a message to a forum thread.'
})
export class ForumPin extends Command {
    readonly _options: ApplicationCommandOptionData[] = [
        {
            type: ApplicationCommandOptionType.String,
            name: 'message-id',
            description: 'The message id to pin.',
            required: true
        }
    ];

    public override async registerApplicationCommands(registry: Command.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._options,
                dmPermission: false,
                contexts: [ InteractionContextType.Guild ],
                integrationTypes: [ ApplicationIntegrationType.GuildInstall ],
            })
            .registerContextMenuCommand({
                type: ApplicationCommandType.Message,
                name: "Pin Message to Thread",
                dmPermission: false,
                contexts: [ InteractionContextType.Guild ],
                integrationTypes: [ ApplicationIntegrationType.GuildInstall ],
            })
    }

    private async toggleMessagePin(interaction: Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction, thread: ThreadChannel, messageId: string) {
        const message = await thread.messages.fetch(messageId);

        if (!message) {
            return await interaction.reply({
                content: 'Unable to fetch the message to be pinned.',
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        if (!message.pinnable) {
            return await interaction.reply({
                content: 'This message cannot be pinned.',
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        if (message.pinned) {
            await message.unpin(`Automated Action - ${interaction.user.tag} unpinned a message from the forum thread.`);
            return await interaction.reply({
                content: 'The message has been unpinned.',
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        await message.pin(`Automated Action - ${interaction.user.tag} pinned a message to the forum thread.`);
        return await interaction.reply({
            content: 'The message has been pinned.',
            flags: [ MessageFlags.Ephemeral ]
        });
    }

    private isThreadOwner(thread: ThreadChannel, userId: string) {
        return thread.ownerId === userId;
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        if (!interaction.channel) return;

        if (!interaction.channel.isThread()) {
            return await interaction.reply({
                content: 'This command can only be used in threads.',
                flags: [ MessageFlags.Ephemeral ]
            });
        };

        if (!this.isThreadOwner(interaction.channel, interaction.user.id)) {
            return await interaction.reply({
                content: 'You are not the owner of the thread.',
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        const messageId = interaction.options.getString('message-id', true);
        return await this.toggleMessagePin(interaction, interaction.channel, messageId);
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        if (!interaction.channel) return;

        if (!interaction.channel.isThread()) {
            return await interaction.reply({
                content: 'This command can only be used in threads.',
                flags: [ MessageFlags.Ephemeral ]
            });
        };

        if (!this.isThreadOwner(interaction.channel, interaction.user.id)) {
            return await interaction.reply({
                content: 'You are not the owner of the thread.',
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        return await this.toggleMessagePin(interaction, interaction.channel, interaction.targetId);
    }
}