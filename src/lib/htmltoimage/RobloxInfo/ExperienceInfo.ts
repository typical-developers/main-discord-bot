import RobloxCard, { abbreviate } from './RobloxInfo.js';
import { css, html } from '#lib/util/html';

export interface ExperienceDetails {
	name: string;
	creator: string;
	rating?: string;
	thumbnail: string;
	description?: string;
	dates: {
		created: Date;
		updated: Date;
	};
	stats: {
		active: number;
		visits: number;
		favorites: number;
	};
}

export default class ExperiencePage extends RobloxCard {
	public constructor(experience: ExperienceDetails) {
		const STYLE = [
			css('.game-info', {
				display: 'flex',
				width: '1150px',
				align_items: 'flex-start',
				gap: '15px'
			}),
			css('.icon', {
				width: '576px',
				height: '324px',
				flex_shrink: '0',

				border_radius: '4px'
			}),
			css('.details', {
				display: 'flex',
				padding: '10px 0px',
				flex_direction: 'column',
				align_items: 'flex-start',
				gap: '10px',
				flex: '1 0 0',
				align_self: 'stretch'
			}),
			css('.name', {
				display: 'flex',
				flex_direction: 'column',
				align_items: 'flex-start',

				color: '#FFF',

				font_family: 'Gotham',
				font_size: '28px',
				font_style: 'normal',
				font_weight: '400',
				line_height: 'normal'
			}),
			css('.title', {
				display: 'flex',
				align_items: 'flex-start',
				gap: '5px'
			}),
			css('.title img.emoji', {
				width: '34px',
				height: '34px'
			}),
			css('.creator', {
				display: 'flex',
				align_items: 'flex-start',
				gap: '5px',

				color: '#CBCBCB;',

				font_size: '16px',
				font_style: 'normal',
				font_weight: '325',
				line_height: '150%'
			}),
			css('.creator > span', {
				color: '#2BB1FF',

				font_size: '16px',
				font_style: 'normal',
				font_weight: '350',
				line_height: '150%'
			}),
			css('.dates', {
				display: 'flex',
				align_items: 'flex-start',
				gap: '10px',
				align_self: 'stretch'
			}),
			css('.dates .paper-container', {
				flex: '1 0 0'
			})
		];

		const EXPERIENCEINFO = html('div', { class: 'game-info' }, [
			html('img', { class: 'icon', src: experience.thumbnail }),
			html('div', { class: 'details' }, [
				html('div', { class: 'name' }, [
					html('div', { class: 'title' }, experience.name),
					html('div', { class: 'creator' }, ['By', html('span', {}, experience.creator)])
				]),
				experience.rating
					? html('div', { class: 'chip outline' }, experience.rating)
					: '',
				html('div', { class: 'stats' }, [
					html('div', { class: 'stats-item' }, [html('span', { class: 'number' }, abbreviate(experience.stats.active)), 'active']),
					html('div', { class: 'stats-item' }, [html('span', { class: 'number' }, abbreviate(experience.stats.visits)), 'visits']),
					html('div', { class: 'stats-item' }, [html('span', { class: 'number' }, abbreviate(experience.stats.favorites)), 'favorites'])
				])
			])
		]);

		const DESCRIPTION = html('div', { class: 'paper-container' }, [
			html('span', {}, 'Description'),
			html(
				'div',
				{},
				experience.description?.length
					? html('div', { class: 'paper-content' }, experience.description.replaceAll('\n', '<br/>'))
					: 'No description for experience.'
			)
		]);

		const DATES = html('div', { class: 'dates' }, [
			html('div', { class: 'paper-container details' }, [
				html('span', {}, 'CREATED'),
				Intl.DateTimeFormat('en-US', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}).format(experience.dates.created)
			]),
			html('div', { class: 'paper-container details' }, [
				html('span', {}, 'UPDATED'),
				Intl.DateTimeFormat('en-US', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}).format(experience.dates.updated)
			])
		]);

		const EXPERIENCE = html('div', { class: 'content', style: 'width: 1190px' }, [EXPERIENCEINFO, DESCRIPTION, DATES]);

		super(EXPERIENCE, STYLE);
	}
}
