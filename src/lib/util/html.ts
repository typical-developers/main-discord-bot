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

export function css(className: string, declarations: Object) {
	declarations = Object.entries(declarations)
		.map(([property, value]) => `${property.replaceAll('_', '-')}:${value};`)
		.join('');

	return `${className}{${declarations}}`;
}
