import RobloxCard, { abbreviate } from './RobloxInfo.js';
import { css, html } from '#lib/util/html';

export interface ProfileDetails {
	username: string;
	globalName?: string;
	avatarURL: string;
	flags: {
		isVerified: boolean;
		isAdmin: boolean;
		isBanned: boolean;
	};
	stats: {
		friends: number;
		followers: number;
		following: number;
	};
	about: string;
	previousNames: string[] | never[];
	created: Date;
}

export default class UserProfile extends RobloxCard {
	public constructor(profile: ProfileDetails) {
		const STYLE = [
			css('.profile-info', {
				display: 'flex',
				width: '660px',
				align_items: 'flex-start',
				gap: '10px'
			}),
			css('.avatar', {
				width: '150px',
				height: '150px',
				flex_shrink: '0',

				border_radius: '150px',
				background: '#222222'
			}),
			css('.details', {
				display: 'flex',
				padding: '10px 0px',
				flex_direction: 'column',
				align_items: 'flex-start',
				gap: '10px',
				align_self: 'stretch'
			}),
			css('.info', {
				display: 'flex',
				flex_direction: 'column',
				align_items: 'flex-start',
				gap: '5px',
				align_self: 'stretch'
			}),
			css('.name', {
				display: 'flex',
				flex_direction: 'column',
				align_items: 'flex-start',

				color: '#CBCBCB',

				font_size: '16px',
				font_style: 'normal',
				font_weight: '325',
				line_height: '150%'
			}),
			css('.with-badge', {
				display: 'flex',
				align_items: 'center',
				gap: '10px',

				color: '#FFF',

				font_size: '28px',
				font_weight: '400',
				line_height: 'normal'
			}),
			css('.flags', {
				display: 'flex',
				align_items: 'flex-start',
				gap: '5px',
				align_self: 'stretch'
			})
		];

		const PROFILEINFO = html('div', { class: 'profile-info' }, [
			html('img', { class: 'avatar', src: profile.avatarURL }),
			html('div', { class: 'details' }, [
				html('div', { class: 'info' }, [
					html('div', { class: 'name' }, [
						html('div', { class: 'with-badge' }, [
							`${profile.globalName || profile.username}`,
							profile.flags.isVerified
								? html('img', {
										src: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28' fill='none'%3E%3Cg clip-path='url(%23clip0_8_46)'%3E%3Crect x='5.88818' width='22.89' height='22.89' transform='rotate(15 5.88818 0)' fill='%230066FF'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M20.543 8.7508L20.549 8.7568C21.15 9.3578 21.15 10.3318 20.549 10.9328L11.817 19.6648L7.45 15.2968C6.85 14.6958 6.85 13.7218 7.45 13.1218L7.457 13.1148C8.058 12.5138 9.031 12.5138 9.633 13.1148L11.817 15.2998L18.367 8.7508C18.968 8.1498 19.942 8.1498 20.543 8.7508Z' fill='white'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_8_46'%3E%3Crect width='28' height='28' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E"
								  })
								: ''
						]),
						`@${profile.username}`
					]),
					html('div', { class: 'flags' }, [
						profile.flags.isAdmin ? html('div', { class: 'chip small outline grey' }, 'Administrator') : '',
						profile.flags.isBanned ? html('div', { class: 'chip small outline red' }, 'Banned') : ''
					])
				]),
				html('div', { class: 'stats' }, [
					html('div', { class: 'stats-item' }, [html('span', { class: 'number' }, abbreviate(profile.stats.friends)), 'friends']),
					html('div', { class: 'stats-item' }, [html('span', { class: 'number' }, abbreviate(profile.stats.followers)), 'followers']),
					html('div', { class: 'stats-item' }, [html('span', { class: 'number' }, abbreviate(profile.stats.following)), 'following'])
				])
			])
		]);

		const ABOUT = html('div', { class: 'paper-container' }, [
			html('span', {}, 'About'),
			html(
				'div',
				{},
				profile.about.length ? html('div', { class: 'paper-content' }, profile.about.replaceAll('\n', '<br/>')) : 'No about found.'
			)
		]);
		const PASTUSERNAMES = html('div', { class: 'paper-container' }, [
			html('span', {}, 'Previous Usernames'),
			profile.previousNames.length ? profile.previousNames.join(', ') : 'No previous names on record.'
		]);
		const CREATED = html('div', { class: 'paper-container details' }, [
			html('span', {}, 'CREATED'),
			Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			}).format(profile.created)
		]);

		const PROFILE = html('div', { class: 'content', style: 'width: 700px' }, [...PROFILEINFO, ...ABOUT, ...PASTUSERNAMES, ...CREATED]);

		super(PROFILE, STYLE);
	}
}
