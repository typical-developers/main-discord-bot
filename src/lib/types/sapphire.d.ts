import type { TypicalAPI } from '#lib/structures/API';

declare module '@sapphire/pieces' {
    interface Container {
        api: TypicalAPI;
    }
}
