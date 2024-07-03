import { HTMLToImage } from "#lib/structures/HTMLToImage"
import { htmlFunctions } from '#lib/util/html';
import { css } from '#lib/util/css';

const { div } = htmlFunctions;

export interface OaklandsLeaderboardStatsDetails {
    header: string;
    resetTime: Date;
    fields: {
        holder: string;
        value: string;
    };
    stats: {
        holder: string;
        value: string;
    }[];
}

export class OaklandsLeaderboardStats extends HTMLToImage {
    constructor(details: OaklandsLeaderboardStatsDetails) {
        const html = div({
            class: "leaderboard"
        },
        [
            // div({ class: "halftone" }),
            div({ class: "header" }, [
                div({ class: "main" }, ['{{mainHeaderText}}']),
                div({ class: "timer" }, ['Resets in {{timeRemaining}}'])
            ]),
            div({ class: "info" }, [
                div({ class: "values" }, [
                    div({ style: "width: 70px;" }, ['RANK']),
                    div({ style: "width: 512px;" }, [details.fields.holder]),
                    div({ style: "width: 512px; text-align: right;" }, [details.fields.value]),
                ]),
                div({ class: "rows" }, 
                    details.stats.map(({ holder, value }, index) =>
                        div({ class: "row" }, [
                            div({ class: "rank" }, [(() => {
                                const rank = index + 1;

                                switch (rank) {
                                    case 1:
                                        return `1st`;
                                    case 2:
                                        return `2nd`;
                                    case 3:
                                        return `3rd`;
                                    default:
                                        return `${rank}th`
                                }
                            })()]),
                            div({ class: "user" }, [holder]),
                            div({ class: "value" }, [value])
                        ])
                    )
                )
            ])
        ])

        const styling = [
            css('body', {
                position: 'absolute',
                margin: '0',
                width: '1150px',
                color: 'white',
                background_color: 'black',
                font_family: 'Inter',
                font_size: '20px',
                font_weight: '700'
            }),
            // css('.halftone', {
            //     position: 'absolute',
            //     width: '1150px',
            //     height: '2000px',
            //     background_image: `radial-gradient(
            //         circle at center,
            //         transparent 0.08rem,
            //         black 0
            //     )`,
            //     background_size: '3px 3px',
            //     background_position: `0 0, 0.15rem 0.15rem`
            // }),
            css('.leaderboard', {
                display: 'flex',
                flex_direction: 'column',
                align_items: 'center',
                justify_content: 'center',
                box_sizing: 'border-box',
                padding: '15px',
                width: '1150px',
                background_color: '#090D2D',
                background_image: 'linear-gradient(to bottom, rgba(78, 122, 207, 0.0) 0%, rgba(78, 122, 207, 0.05) 25%, rgba(78, 122, 207, 0.25) 50%, rgba(78, 122, 207, 0.05) 75%, rgba(78, 122, 207, 0.0) 100%)'
            }),
            css('.leaderboard .header', {
                display: 'flex',
                flex_direction: 'column',
                align_items: 'center',
                gap: '3px'
            }),
            css('.leaderboard .header .timer', {
                font_size: '14px',
                font_weight: '500'
            }),
            css('.leaderboard .info', {
                width: '100%'
            }),
            css('.leaderboard .info .values', {
                display: 'flex',
                padding: '5px 10px'
            }),
            css('.leaderboard .info .rows', {}),
            css('.leaderboard .info .rows .row', {
                display: 'flex',
                padding: '5px 10px'
            }),
            css('.leaderboard .info .rows .row:nth-child(1)', {
                color: '#ECD400'
            }),
            css('.leaderboard .info .rows .row:nth-child(2)', {
                color: '#B1B1B1'
            }),
            css('.leaderboard .info .rows .row:nth-child(3)', {
                color: '#F67600'
            }),
            css('.leaderboard .info .rows .row:nth-child(2n+1)', {
                background_color: 'rgba(255, 255, 255, 0.15)'
            }),
            css('.leaderboard .info .rows .row .rank', {
                width: '70px'
            }),
            css('.leaderboard .info .rows .row .user', {
                width: '512px'
            }),
            css('.leaderboard .info .rows .row .value', {
                width: '512px',
                color: '#37FF91',
                text_align: 'right'
            })
        ];

        super({ html, styling: styling }, {
            mainHeaderText: details.header,
            timeRemaining: () => {
                const nowEpoch = new Date().getTime() / 1000;
                const resetEpoch = details.resetTime.getTime() / 1000;

                const remainingSeconds = resetEpoch - nowEpoch;

                const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
                const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
                const seconds = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');
            
                return `${hours}:${minutes}:${seconds}`;
            }
        });
    }
}