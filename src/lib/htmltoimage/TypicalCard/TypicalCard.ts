import HTMLToImage from '#lib/htmltoimage/HTMLToImage';
import { BrandColors } from '#lib/types/constants';
import { css, root } from '#lib/util/html';

export default class TypicalCard extends HTMLToImage {
	public constructor(page: string, style: Array<string>) {
		const PAGE = page;
		const STYLE = [
			root({
				'--carmine-pink': BrandColors.CarminePink.toString(16),
				'--sunrise': BrandColors.Sunrise.toString(16),
				'--spearmint': BrandColors.Spearmint.toString(16),
				'--royal-blue': BrandColors.RoyalBlue.toString(16),
				'--dark-orchid': BrandColors.DarkOrchid.toString(16),
				'--violet': BrandColors.Violet.toString(16),
				'--white': BrandColors.White.toString(16),
				'--grey': BrandColors.Grey.toString(16),
				'--background':
					'radial-gradient(80.38% 80.38% at 16.67% 26.86%, #11001F 0%, rgba(19, 0, 39, 0.00) 100%), radial-gradient(80.28% 80.28% at 38.73% 51.86%, #320133 0%, rgba(10, 7, 21, 0.00) 100%), radial-gradient(101.42% 101.42% at 71.18% 72.25%, #250900 0%, rgba(10, 7, 21, 0.00) 100%), radial-gradient(101.85% 101.85% at 72.94% 28.92%, #0D0041 0%, rgba(10, 7, 21, 0.00) 100%), #0A0715'
			}),
			css('body', {
				color: 'var(--white)'
			}),
			...style
		];

		super(PAGE, STYLE);
	}
}
