import HTMLToImage from '#lib/htmltoimage/HTMLToImage';
import { css } from '#lib/util/html';

export default class RobloxCard extends HTMLToImage {
	public constructor(page: string, style: string[]) {
		const PAGE = page;

		const TEXTSTYLES = [
			css('body', {
				color: '#FFF',
				font_family: 'Gotham',
				font_size: '16px',
				font_style: 'normal',
				font_weight: '325',
				line_height: '150%'
			}),
			css('h1', {
				font_size: '40px',
				font_weight: '400',
				line_height: 'normal'
			}),
			css('h2', {
				font_size: '28px',
				font_weight: '350',
				line_height: 'normal'
			}),
			css('h3', {
				font_size: '24px',
				font_weight: '350',
				line_height: 'normal'
			}),
			css('h4', {
				font_size: '16px',
				font_weight: '350',
				line_height: 'normal'
			}),
			css('span', {
				font_size: '12px',
				font_weight: '350',
				line_height: 'normal'
			}),
			css('span.details', {
				font_size: '24px'
			})
		];

		const CHIPSTYLES = [
			css('.chip', {
				display: 'inline-flex',
				padding: '5.5px 12px',
				align_items: 'flex-start',
				gap: '10px',

				border_radius: '50px',
				background_color: '#EDEDED',

				color: '#171717',
				font_family: 'Gotham',
				font_size: '14px',
				font_style: 'normal',
				font_weight: '350',
				line_height: '150%',
				letter_spacing: '0.15px'
			}),
			css('.chip.outline', {
				background_color: 'transparent !important',
				border: '1px solid #EDEDED',

				color: '#EDEDED'
			}),
			css('.chip.small', {
				padding: '1.5px 8px'
			}),
			css('.chip.blue', {
				background_color: '#2BB1FF'
			}),
			css('.chip.outline.blue', {
				border_color: '#2BB1FF',
				color: '#2BB1FF'
			}),
			css('.chip.grey', {
				background_color: '#383838',

				color: '#EDEDED'
			}),
			css('.chip.outline.grey', {
				border_color: '#383838'
			}),
			css('.chip.red', {
				background_color: '#F4645D'
			}),
			css('.chip.outline.red', {
				border_color: '#F4645D',
				color: '#F4645D'
			})
		];

		const PAPERSTYLES = [
			css('.paper-container', {
				display: 'inline-flex',
				padding: '8px',
				flex_direction: 'column',
				align_items: 'flex-start',
				align_self: 'stretch',

				border_radius: '4px',
				background_color: '#222',
				box_shadow: '0px 2px 1px -1px rgba(0, 0, 0, 0.12), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.20)',

				color: '#FFF',

				font_size: '16px',
				font_weight: '325',
				line_height: '150%'
			}),
			css('.paper-container > span', {
				color: '#CBCBCB',
				font_size: '12px',
				font_weight: '350',
				line_height: 'normal',
				letter_spacing: '0.15px'
			}),
			css('.paper-container .paper-content', {
				display: 'inline-block',
				gap: '5px',
				align_self: 'stretch',

				color: '#FFF',
				word_break: 'break-all',
				overflow: 'auto'
			}),
			css('.paper-container .paper-content img.emoji', {
				margin_top: '3px',
				width: '16px',
				height: '16px'
			}),
			css('.paper-container.details', {
				align_items: 'center',
				gap: '5px',

				font_family: 'Gotham',
				font_size: '24px',
				font_weight: '350',
				line_height: 'normal'
			})
		];

		const STATSTYLES = [
			css('.stats', {
				display: 'flex',
				align_items: 'flex-end',
				gap: '15px',
				flex: '1 0 0',
				align_self: 'stretch'
			}),
			css('.stats-item', {
				display: 'flex',
				align_items: 'flex-end',
				gap: '5px',

				color: '#CBCBCB'
			}),
			css('.stats-item span', {
				color: '#FFF',

				font_family: 'Gotham',
				font_size: '24px',
				font_style: 'normal',
				font_weight: '350',
				line_height: 'normal'
			})
		];

		const STYLE = [
			css('.content', {
				display: 'inline-flex',
				padding: '20px',
				flex_direction: 'column',
				align_items: 'flex-start',
				gap: '15px',

				border_radius: '4px',
				background: '#171717'
			}),
			...TEXTSTYLES,
			...CHIPSTYLES,
			...PAPERSTYLES,
			...STATSTYLES,
			...style
		];

		super(PAGE, STYLE);
	}
}

export function abbreviate(number: any) {
	let decPlaces = Math.pow(10, 1);
	let abbrev = ['K+', 'M+', 'B+', 'T+'];

	for (let i = abbrev.length - 1; i >= 0; i--) {
		let size = Math.pow(10, (i + 1) * 3);
		if (size <= number) {
			number = Math.round((number * decPlaces) / size) / decPlaces;
			number += abbrev[i];
			break;
		}
	}

	return number;
}
