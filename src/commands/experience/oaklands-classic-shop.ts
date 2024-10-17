import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { AttachmentBuilder } from 'discord.js';
import { generateClassicShop } from '@/lib/util/image-generators';
import { htmlFunctions } from '@/lib/util/html';
import { classicShop } from '@/lib/util/public-api';

const { div, img, a } = htmlFunctions;

@ApplyOptions<Command.Options>({
    description: 'Fetch the current classic shop.'
})
export class OaklandsClassicShop extends Command {
    public override async registerApplicationCommands(registry: Command.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
            });
    }

    private readonly _shopItems: Record<string, { price: number; thumbnail?: string; }> = {
        WitchesBrew: { price: 404, thumbnail: "https://tr.rbxcdn.com/180DAY-0c8652841b77bbee2ffee7e63ed51794/150/150/Gear/Webp/noFilter" },
        Oakpiece: { price: 8994, thumbnail: "" },
        VinylStud: { price: 4444, thumbnail: "https://static.miraheze.org/oaklandsrblxwikiwiki/0/04/Vinyl-Stud_Vinyl.png" },
        ClassicJeepVehiclePad: { price: 86000, thumbnail: "https://static.miraheze.org/oaklandsrblxwikiwiki/5/55/Classic_Joop.png" },
        BloxyCola: { price: 737, thumbnail: "https://tr.rbxcdn.com/180DAY-90b877c5aecda54566b428250712c21b/150/150/Gear/Webp/noFilter" },
        TobascoSauce: { price: 404, thumbnail: "https://tr.rbxcdn.com/180DAY-a2ecaf223b1aed9ad0bcca15dda049be/150/150/Gear/Webp/noFilter" },
        RocketLauncher: { price: 9999, thumbnail: "https://static.miraheze.org/oaklandsrblxwikiwiki/f/f5/Confetti_Launcher.png" },
        TeamFlag: { price: 3000, thumbnail: "https://static.miraheze.org/oaklandsrblxwikiwiki/6/6a/Team_Flag_Red.png" },
        StudGift: { price: 390, thumbnail: "" },
        Slingshot: { price: 727, thumbnail: "" },
        Trowel: { price: 777, thumbnail: "" },
        HealingCoil: { price: 5117, thumbnail: "https://tr.rbxcdn.com/180DAY-d147d1c62a17bccd46ab2fed0f7c5a61/150/150/Gear/Webp/noFilter" },
        GiftOfEmotion: { price: 1200, thumbnail: "" },
        ClassicBillboard: { price: 1270, thumbnail: "" },
        BabyDucky: { price: 125, thumbnail: "https://tr.rbxcdn.com/180DAY-8ec8b7ea7250d6f47a87b1f69123bbcd/150/150/Hat/Webp/noFilter" },
        CannedBeans: { price: 4890, thumbnail: "https://tr.rbxcdn.com/180DAY-2a535f607032decea59ba0552830542e/150/150/Gear/Webp/noFilter" },
        GravityCoil: { price: 8008, thumbnail: "https://tr.rbxcdn.com/180DAY-5a087350499e826bfd11e06a312b8f45/150/150/Gear/Webp/noFilter" },
        SpeedCoil: { price: 8008, thumbnail: "https://tr.rbxcdn.com/180DAY-7ee382f34b7657e33a2f94ad863f1b14/150/150/Gear/Webp/noFilter" },
        TrappedBeans: { price: 4891, thumbnail: "https://tr.rbxcdn.com/180DAY-2a535f607032decea59ba0552830542e/150/150/Gear/Webp/noFilter" },
        SubspaceTripmine: { price: 1010, thumbnail: "https://tr.rbxcdn.com/180DAY-8aa4c9d1585a59ca78ce7657f6728c7b/150/150/Gear/Webp/noFilter" },
        LinkedSword: { price: 1337, thumbnail: "https://tr.rbxcdn.com/180DAY-4abe6932f60781b03a2c15e399a4be92/150/150/Gear/Webp/noFilter" },
        ClassicMoai: { price: 1250, thumbnail: "https://tr.rbxcdn.com/180DAY-0ed7be414329998ea0b4cc25b4e391d1/150/150/Hat/Webp/noFilter" }
    }

    private _resetTime(reset: Date): string {
        const nowSeconds = new Date().getTime() / 1000;
        const resetSeconds = reset.getTime() / 1000

        const remainingSeconds = Math.floor(resetSeconds - nowSeconds);

        if (remainingSeconds <= 0) {
            return `00:00:00`;
        }

        const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        const shop = await classicShop();

        if (!shop) {
            return interaction.editReply('Unable to fetch the Oaklands Classic Shop at this time, try again later.');
        }

        const attachment = new AttachmentBuilder(
            await generateClassicShop({
                shopResetTime: this._resetTime(new Date(shop.reset_time)),
                shopContentHtml: shop.items.filter((i) => i !== "GiftOfEmotion").map((i) => {
                    const name = i.split(/(?=[A-Z])/).join(' ');
                    const details = this._shopItems[i];

                    const html = div({ class: "shop-item" }, [
                        img({ src: details.thumbnail !== ""
                                ? details.thumbnail
                                : "https://web.archive.org/web/20110228202605im_/http://t1bg.roblox.com/unapprove-110x110.Png"
                            }),
                        a({ class: "item-header" }, [name]),
                        a({ class: "item-cost" }, [`Ca$h: ${details.price.toString()}`])
                    ]);
        
                    return html;
                }).join('')
            }),
            { name: 'classic-shop.png' }
        );

        await interaction.editReply({ files: [attachment] });
    }
}
