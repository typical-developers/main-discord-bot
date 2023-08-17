// This utility is inspired from cook.js
// https://cook.rajnathani.com

export enum HTMLTags {
	'span',
	'div',
	'p',
	'ul',
	'li',
	'th',
	'blockquote',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'pre',
	'b',
	'i',
	'u',
	'strike',
	'strong',
	'a',
	'col',
	'style',
	'script',
	'html',
	'head',
	'body',
	'img'
}

export type HTMLTag = keyof typeof HTMLTags;

export function html(tag: HTMLTag, attributes: Object, content?: string | Array<Object>) {
	attributes = Object.entries(attributes)
		.map(([attribute, value]) => `${attribute}="${value}"`)
		.join(' ');

	if (Array.isArray(content)) {
		content = content.join('');
	}

	return `<${tag}${attributes !== '' ? ' ' + attributes : ''}>${content || ''}</${tag}>`;
}

export function root(values: Object, override: string = ':root') {
	values = Object.entries(values)
		.map(([property, value]) => `${property.replaceAll('_', '-')}:${value};`)
		.join('');

	return `${override}{${values}}`;
}

// add onto these as they are used. exists since it's easier to fill.
export enum CSSDeclarations {
	'display',
	'position',
	'margin',
	'padding',
	'align_items',
	'align_content',
	'flex_wrap',
	'gap',
	'border',
	'border_color',
	'border_radius',
	'text_overflow',
	'background',
	'background_color',
	'box_shadow',
	'color',
	'font_family',
	'font_size',
	'font_style',
	'font_weight',
	'line_height',
	'overflow',
	'word_break',
	'letter_spacing',
	'white_space',
	'text_rendering',
	'margin_top',
	'width',
	'height',
	'align_self',
	'flex',
	'float',
	'outline',
	'outline_offset',
	'flex_direction',
	'justify_content',
	'opacity',
	'max_width',
	'flex_shrink',
	'text_align'
}

export type CSSDeclaration = {
	[key in keyof typeof CSSDeclarations]?: string;
};

export function css(className: string, declarations: CSSDeclaration) {
	declarations = Object.entries(declarations)
		.map(([property, value]) => `${property.replaceAll('_', '-')}:${value};`)
		.join('');

	return `${className}{${declarations}}`;
}
