import { HTMLToImage } from "#lib/structures/HTMLToImage";
import { htmlFunctions, css } from "#lib/util/html";
import { imageToBase64 } from "#lib/util/files";
import { abbreviateNumber } from "#lib/util/abbreviate";

const { div, img } = htmlFunctions;

interface ProfileCardDetails {
    /** The @ username of the user. */
    username: string;
    /** The global display name of the user. */
    displayName: string;
    /** The user's avatar. */
    avatarUrl: string;
    /** A custom background iamge to apply to the user. */
    backgroundImageUrl?: string;
    /** The rank of the user. */
    rank: number;
    /** Tags that will appear on the user's profile. */
    tags?: {
        /** The name of the tag */
        name: string;
        /** This should be an rgb value. */
        color: `${string}, ${string}, ${string}`;
    }[];
    /** Server profile stats/ */
    stats: {
        /** Activity points and progression. */
        activityProgression: {
            /** The total amount of points the user has for the server. */
            totalPoints: number;
            /** How many points they needed total from all the previous rannks. */
            currentProgress: number;
            /** How many points they need total for the next rank. */
            requiredProgress: number;
        }
    }
}

export class ProfileCard extends HTMLToImage {
    constructor(details: ProfileCardDetails) {
        const html = div(
            {
                class: "profile-card",
                style: "background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 20%, rgba(0,0,0,0.75) 100%), url('{{backgroundImageUrl}}') center/cover  no-repeat, #0E0911;"
            },
            [
                div({ class: "profile-details" }, [
                    div({ class: "profile-user-info" }, [
                        img({ class: "avatar", src: "{{avatarUrl}}" }),
                        div({ class: "details" }, [
                            div({}, [
                                div({ class: "username" }, ['{{displayName}}']),
                                div({ class: "displayname" }, ['@{{username}}'])
                            ]),
                            div({ class: "tags" }, details.tags?.length
                                ? details.tags?.map((tag) => (div({ class: 'tag', style: `color: rgba(${tag.color}); background: linear-gradient(rgba(0,0,0,0.8) 100%, rgba(0,0,0,0.8) 0%), rgba(${tag.color});` }, [tag.name])))
                                : []
                            )
                        ]),
                    ]),
                    div({ class: "profile-user-stats" }, [
                        div({ class: "rank" }, ['#{{rank}}']),
                        div({ class: "points" }, ['{{abbreviatedPoints}} points'])
                    ])
                ]),
                div({ class: "profile-activity-progress" }, [
                    div({ class: "progression" }, [
                        div({ class: "progress-bar" }, ['{{progressBar}}']),
                        div({ class: "progress-fill-bar", style: "width: {{progressBarLength}}%; background: linear-gradient(to right, #A44DFA, #FD9C66);" })
                    ]),
                    div({ class: "info-text" }, ['Activity Progression'])
                ])
            ]
        );

        const styling = [
            css('.profile-card', {
                display: 'flex',
                flex_direction: 'column',
                align_items: 'center',
                justify_content: 'center',
                box_sizing: 'border-box',
                padding: '30px',
                border_radius: '20px',
                gap: '15px',
                width: '650px',
                height: '200px',
                background_color: '#0E0911'
            }),
            css('.profile-details', {
                display: 'flex',
                flex_direction: 'row',
                gap: '10px',
                width: '100%'
            }),
            css('.profile-user-info', {
                display: "flex",
                flex_direction: "row",
                align_items: "center",
                gap: "10px",
                width: "100%",
                height: "100%"
            }),
            css('.profile-user-info .avatar', {
                border_radius: '15px',
                width: '80px',
                height: '80px',
                filter: 'drop-shadow(1px 1px 7px rgba(0, 0, 0, 0.45))'
            }),
            css('.profile-user-info .details', {
                display: 'flex',
                flex_direction: 'column',
                gap: '5px',
                overflow: 'hidden',
            }),
            css('.profile-user-info .details .username', {
                overflow: 'hidden',
                text_overflow: 'ellipsis',
                max_width: '250px',
                font_size: '24px',
                font_weight: '700',
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-user-info .details .displayname', {
                overflow: 'hidden',
                text_overflow: 'ellipsis',
                max_width: '250px',
                font_size: '14px',
                font_weight: '600',
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-user-info .details .tags', {
                display: 'flex',
                flex_direction: 'row'
            }),
            css('.profile-user-info .details .tags .tag', {
                padding: '4px 8px',
                border_radius: '25px',
                font_weight: '600'
            }),
            css('.profile-user-stats', {
                display: 'flex',
                flex_direction: 'column',
                align_items: 'flex-end',
                justify_content: 'flex-end',
                width: '100%'
            }),
            css('.profile-user-stats .rank', {
                font_size: '24px',
                font_weight: '900',
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-user-stats .points', {
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-user-stats', {
                display: 'flex',
                flex_direction: 'column',
                align_items: 'flex-end',
                justify_content: 'flex-end',
                width: '100%'
            }),
            css('.profile-user-stats .rank', {
                font_size: '24px',
                font_weight: '900',
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-user-stats .points', {
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-activity-progress', {
                position: 'relative',
                display: 'flex',
                flex_direction: 'column',
                gap: '5px',
                width: '100%',
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            }),
            css('.profile-activity-progress .progression', {
                display: 'flex',
                overflow: 'hidden',
                border_radius: '5px'
            }),
            css('.profile-activity-progress .progress-bar', {
                z_index: '1',
                position: 'relative',
                display: 'flex',
                justify_content: 'center',
                align_items: 'center',
                width: '100%',
                height: '26px',
                background_color: 'rgba(229, 232, 255, 0.35)',
                font_size: '14px'
            }),
            css('.profile-activity-progress .progress-fill-bar', {
                position: 'absolute',
                z_index: '0',
                top: '0',
                border_radius: '5px',
                height: '26px'
            }),
            css('.profile-activity-progress .info-text', {
                font_weight: '600',
                text_shadow: '1px 1px 7px rgba(0, 0, 0, 0.45)'
            })
        ];

        super({ html: html, styling: styling },
            {
                username: details.username,
                displayName: details.displayName,
                avatarUrl: details.avatarUrl,
                backgroundImageUrl: details.backgroundImageUrl || `data:image/png;base64,${imageToBase64('/assets/images/profile-default.png')}`,
                rank: details.rank,
                abbreviatedPoints: abbreviateNumber(details.stats.activityProgression.totalPoints),
                currentProgress: details.stats.activityProgression.currentProgress,
                nextProgress: details.stats.activityProgression.requiredProgress,
                progressBar: details.stats.activityProgression.requiredProgress > details.stats.activityProgression.currentProgress
                    ? `${details.stats.activityProgression.currentProgress} / ${details.stats.activityProgression.requiredProgress}`
                    : details.stats.activityProgression.totalPoints,
                progressBarLength: details.stats.activityProgression.requiredProgress > details.stats.activityProgression.currentProgress
                    ? Math.ceil((100 * details.stats.activityProgression.currentProgress) / details.stats.activityProgression.requiredProgress)
                    : 100
            }
        );
    }
}