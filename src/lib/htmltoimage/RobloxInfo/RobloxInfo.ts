import HTMLToImage from '#lib/htmltoimage/HTMLToImage';
import { css } from '#lib/util/html';

export class RobloxCard extends HTMLToImage {
	public constructor(page: string) {
		const PAGE = page;
		const STYLE = [
			css(':root', {
				'--background-primary': '#171717',
				'--background-secondary': '#222222',
				'--text-header': '#CBCBCB',
				'--text-normal': '#FFFFFF'
			}),
			css('body', {
				padding: '20px',
				color: 'var(--text-normal)',
				background_color: 'var(--background-primary)'
			}),
			css('.paper', {
				border_radius: '4px',
				background: 'var(--background-secondary)',
				box_shadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.20), 0px 1px 1px 0px rgba(0, 0, 0, 0.12), 0px 2px 1px -1px rgba(0, 0, 0, 0.12)'
			})
		];

		super(PAGE, STYLE);
	}
}
