import { Collection, type ModalSubmitFields } from 'discord.js';

export const UserCooldown: Collection<string, Date> = new Collection();
export const FailedUserReports: Collection<string, ModalSubmitFields> = new Collection();
export const FailedIssueReports: Collection<string, ModalSubmitFields> = new Collection();
