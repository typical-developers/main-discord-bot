import TypicalCard from './TypicalCard.js';
import { css, html } from '#lib/util/html';
import type { PresenceStatus } from 'discord.js';
import { BrandColors } from '#lib/types/constants';

interface UserDetails {
	name: string;
	avatarURL?: string;
	status?: PresenceStatus;
}

interface RankingDetails {
	title: string;
	titleColor?: string;
	rank?: number;
	points: {
		total: number;
		currentProgress: number;
		nextProgress: number;
	};
}

const STATUSCOLORS = {
	online: BrandColors.Spearmint.toString(16),
	dnd: BrandColors.CarminePink.toString(16),
	idle: BrandColors.Sunrise.toString(16),
	offline: BrandColors.Grey.toString(16),
	invisible: BrandColors.Grey.toString(16)
};

export default class ActivityCard extends TypicalCard {
	public constructor(user: UserDetails, ranking: RankingDetails) {
		const USERPROFILE = html('div', { class: 'user-profile' }, [
			html('div', { class: 'user-details' }, [
				html('div', { class: 'user-name' }, [user.name]),
				html('div', { class: 'user-title', style: `color: ${ranking.titleColor || 'var(--white); opacity: 0.5;'}` }, [ranking.title])
			]),
			html('div', { class: 'user-stats' }, [
				html('div', { class: 'stat-item' }, [
					html('div', { class: 'stat-item-header' }, ['Points']),
					html('div', { class: 'stat-item-content' }, [ranking.points.total.toString()])
				]),
				ranking.rank
					? html('div', { class: 'stat-item' }, [
							html('div', { class: 'stat-item-header' }, ['Rank']),
							html('div', { class: 'stat-item-content' }, [`#` + ranking.rank.toString()])
					  ])
					: ''
			])
		]);

		const PROGRESS = html('div', { class: 'activity-progress' }, [
			html('div', { class: 'activity-progress-bar' }, [
				html('div', {
					class: 'activity-progress-amount',
					style: `width: ${Math.floor((100 * ranking.points.currentProgress) / ranking.points.nextProgress)}%`
				})
			]),
			html(
				'div',
				{ class: 'activity-progress-text' },
				[ranking.points.currentProgress <= ranking.points.nextProgress
					? `${ranking.points.currentProgress} / ${ranking.points.nextProgress}`
					: ranking.points.total.toString()]
			)
		]);

		const CARD = html('div', { class: 'activity-card' }, [
			html('div', { class: 'activity-card-details' }, [
				html('img', { class: 'user-avatar', src: user.avatarURL }),
				html('div', { class: 'card-info' }, [USERPROFILE, PROGRESS])
			])
		]);

		const CARDSTYLE = [
			css('.activity-card', {
				display: 'flex',
				align_items: 'center',
				gap: '10px',
				width: '940px',
				height: '240px',
				padding: '30px',
				border_radius: '25px',
				background: 'var(--background)'
			}),
			css('.activity-card-details', {
				display: 'flex',
				align_items: 'center',
				align_self: 'stretch',
				gap: '25px',
				padding: '25px 35px',
				flex: '1 0 0',
				border_radius: '15px',
				border: '2px solid rgba(231, 228, 251, 0.10)',
				background: 'rgba(32, 25, 52, 0.35)'
			}),
			css('.user-avatar', {
				width: '190px',
				height: '190px',
				border_radius: '50%',
				outline: `7px solid #${STATUSCOLORS[user.status || 'offline']}`,
				outline_offset: '-7px'
			}),
			css('.card-info', {
				display: 'flex',
				flex_direction: 'column',
				justify_content: 'center',
				align_items: 'flex-start',
				gap: '10px',
				flex: '1 0 0',
				align_self: 'stretch'
			}),
			css('.user-profile', {
				display: 'flex',
				align_items: 'center',
				gap: '10px',
				align_self: 'stretch'
			}),
			css('.user-details', {
				display: 'flex',
				flex_direction: 'column',
				justify_content: 'center',
				align_items: 'flex-start',
				flex: '1 0 0'
			}),
			css('.user-name', {
				color: 'var(--white)',
				font_size: '20px',
				font_weight: '350',
				line_height: 'normal'
			}),
			css('.user-title', {
				color: 'var(--sunrise)',
				font_size: '14px',
				font_weight: '400',
				line_height: 'normal'
			}),
			css('.user-stats', {
				display: 'flex',
				justify_content: 'center',
				align_items: 'flex-start',
				gap: '5px'
			}),
			css('.stat-item', {
				display: 'flex',
				padding: '10px 15px',
				flex_direction: 'column',
				justify_content: 'center',
				align_items: 'center',
				gap: '5px',
				border_radius: '5px',
				background: '#090614'
			}),
			css('.stat-item-header', {
				color: 'var(--white)',
				opacity: '0.5',
				font_size: '14px',
				font_weight: '350',
				line_height: 'normal'
			}),
			css('.stat-item-content', {
				color: 'var(--white)',
				font_size: '16px',
				font_weight: '400',
				line_height: 'normal'
			}),
			css('.activity-progress', {
				display: 'flex',
				flex_direction: 'column',
				align_items: 'flex-end',
				gap: '5px',
				align_self: 'stretch'
			}),
			css('.activity-progress-bar', {
				height: '8px',
				align_self: 'stretch',
				border_radius: '15px',
				background: '#090614'
			}),
			css('.activity-progress-amount', {
				max_width: '100%',
				height: '8px',
				flex_shrink: '0',
				border_radius: '15px',
				background: 'linear-gradient(90deg, #8936E1 0%, #E46D45 100%)'
			}),
			css('.activity-progress-text', {
				color: 'var(--white)',
				text_align: 'right',
				font_size: '14px',
				font_weight: '350',
				line_height: 'normal'
			})
		];

		super(CARD, CARDSTYLE);
	}
}
