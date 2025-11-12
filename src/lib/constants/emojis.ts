type EmojiIDs = {
    NavigatePrevious: string;
    NavigateNext: string;
    Refresh: string;

    Rename: string;
    Lock: string;
    Unlock: string;
    UserLimit: string;
    Reclaim: string;
    Close: string;
}

const ProductionEmojiIDs: EmojiIDs = {
    NavigatePrevious: '1433002487069282434',
    NavigateNext: '1433002485970108599',
    Refresh: '1433002488847667230',

    Rename: '1438000308293861416',
    Lock: '1438000305592864879',
    Unlock: '1438000309694894170',
    UserLimit: '1438000302996324352',
    Reclaim: '1438000307085775048',
    Close: '1438000300035412021',
} as const;

const StagingEmojiIDs: EmojiIDs = {
    NavigatePrevious: '1433000883863687168',
    NavigateNext: '1433000882861113384',
    Refresh: '1433000884698218516',

    Rename: '1319132246229127188',
    Lock: '1319132252663189506',
    Unlock: '1319134440500498482',
    UserLimit: '1319132232354365470',
    Reclaim: '1319132239895990442',
    Close: '1319132224129597450',
} as const;

export const emojis = process.env.ENVIRONMENT === "production"
    ? ProductionEmojiIDs
    : StagingEmojiIDs;