import { HTMLToImage } from '#lib/structures/HTMLToImage';
import { htmlFunctions } from '#lib/util/html';
import { css } from '#lib/util/css';
import { imageToBase64 } from '#lib/util/files';

const { div, img } = htmlFunctions;

export interface LeaderboardStatsDetails {
    /** Image for the details header. */
    headerImage: string;
    /** Describe where the leaderboard is from. */
    mainHeader: string;
    /** Describe what the leaderboard is for. */
    describeHeader: string;
    /** Any other details, such as maybe a reset time if it's a timed leaderboard. */
    otherHeader?: string;
    /** Header fields for stats. */
    fields: {
        /** The holder field header text. */
        holder: string;
        /** The value field header text. */
        value: string;
    };
    /** The leaderboard values. */
    stats: {
        /** The rank position of the stat holder. */
        rank: number;
        /** The name of the stat holder. */
        holder: string;
        /** The value of the stat. */
        value: string | number;
    }[];
    lastUpdated: Date;
    pageNumber: number;
}

export interface LeaderboardStatsCustomization {
    backgroundImageUrl?: string | null;
}

export class LeaderboardStats extends HTMLToImage {
    constructor(details: LeaderboardStatsDetails & LeaderboardStatsCustomization) {
        const html = div({
            class: 'leaderboard',
            style: "background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 20%, rgba(0,0,0,0.75) 100%), url('{{backgroundImageUrl}}') center/cover no-repeat, #0E0911;"
        }, [
            div({ class: 'leaderboard-info' }, [
                img({ src: '{{headerImage}}' }),
                div({ class: 'details' }, [
                    div({ class: 'main-header' }, ['{{mainHeader}}']),
                    div({ class: 'details-header' }, ['{{detailsHeader}}']),
                    ...(details.otherHeader
                        ? div({ class: 'optional-header' }, ['{{otherHeader}}'])
                        : ''
                    )
                    // div({ class: 'optional-header' }, [''])
                ])
            ]),
            div({ class: 'leaderboard-stats' }, [
                div({ class: 'header' }, [
                    div({ class: 'rank' }, ['Rank']),
                    div({ class: 'holder' }, ['{{statNameOne}}']),
                    div({ class: 'stat' }, ['{{statNameTwo}}'])
                ]),
                div({ class: 'content' }, 
                    details.stats.map((v) => div({ class: 'row' }, [
                        div({ class: 'rank' }, [`#${v.rank}`]),
                        div({ class: 'holder' }, [v.holder]),
                        div({ class: 'stat' }, [v.value.toLocaleString()])
                    ])
                ))
            ]),
            div({ class: 'leaderboard-page' }, [
                div({ class: 'time' }, ['Last updated on {{updated}}']),
                div({ class: 'page' }, ['Page {{page}}'])
            ])
        ]);

        const style = [
            css('.leaderboard', {
                display: 'flex',
                flex_direction: 'column',
                align_items: 'center',
                justify_content: 'center',
                box_sizing: 'border-box',
                padding: '30px',
                gap: '15px',
                width: '650px',
                border_radius: '20px',
                background_color: '#0E0911'
            }),
            css('.leaderboard-info', {
                display: 'flex',
                flex_direction: 'row',
                align_items: 'center',
                gap: '10px',
                width: '100%'
            }),
            css('.leaderboard-info .details', {
                width: '100%'
            }),
            css('.leaderboard-info .details .main-header', {
                font_size: '20px',
                font_weight: '700'
            }),
            css('.leaderboard-info .details .main-header img.emoji', {
                width: '20px',
                height: '20px'
            }),
            css('.leaderboard-info .details .details-header', {
                font_size: '14px',
                font_weight: '700'
            }),
            css('.leaderboard-info .details .optional-header', {
                font_size: '12px',
                font_weight: '700'
            }),
            css('.leaderboard-info img', {
                width: '60px',
                height: '60px',
                border_radius: '10px',
                filter: 'drop-shadow(1px 1px 7px rgba(0, 0, 0, 0.45))'
            }),
            css('.leaderboard-stats', {
                display: 'flex',
                flex_direction: 'column',
                gap: '10px',
                width: '100%',
                height: '100%'
            }),
            css('.leaderboard-stats .header', {
                display: 'flex',
                flex_direction: 'row',
                padding: '0 15px 5px',
                border_bottom: '1px solid rgba(229, 232, 255, 0.35)',
                font_size: '14px',
                font_weight: '600'
            }),
            css('.leaderboard-stats .content', {
                display: 'flex',
                flex_direction: 'column',
                gap: '5px'
            }),
            css('.leaderboard-stats .content .row', {
                display: 'flex',
                flex_direction: 'row',
                padding: '5px 15px',
                font_size: '16px',
                border_radius: '5px'
            }),
            css('.leaderboard-stats .content .row:nth-child(2n)', {
                background_color: 'rgba(229, 232, 255, 0.35)'
            }),
            css('.leaderboard-stats .header .rank, .leaderboard-stats .content .rank', {
                width: '80px'
            }),
            css('.leaderboard-stats .content .rank', {
                font_weight: '800'
            }),
            css('.leaderboard-stats .header .holder, .leaderboard-stats .content .holder', {
                width: '200px',
                text_align: 'left',
                white_space: 'nowrap'
            }),
            css('.leaderboard-stats .header .stat, .leaderboard-stats .content .stat', {
                flex_grow: '1',
                text_align: 'right'
            }),
            css('.leaderboard-page', {
                display: 'flex',
                flex_direction: 'row',
                width: '100%',
                font_size: '14px',
                font_weight: '800'
            }),
            css('.leaderboard-page .time', {
                flex_grow: '1',
                width: '100%',
                white_space: 'nowrap'
            }),
            css('.leaderboard-page .page', {
                flex_grow: '1',
                width: '100%',
                text_align: 'right'
            })
        ];

        super({ html: html, styling: style }, {
            headerImage: details.headerImage,
            backgroundImageUrl: details.backgroundImageUrl || `data:image/png;base64,${imageToBase64('/assets/images/leaderboard-default.png')}`,
            mainHeader: details.mainHeader,
            detailsHeader: details.describeHeader,
            otherHeader: details.otherHeader,
            statNameOne: details.fields.holder,
            statNameTwo: details.fields.value,
            page: details.pageNumber,
            updated: new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(details.lastUpdated) + ` @ ` + new Intl.DateTimeFormat('en-US', { timeStyle: 'long' }).format(details.lastUpdated)
        });
    }
}