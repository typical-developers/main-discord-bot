// Functionality is inspired from cook.js
// https://cook.rajnathani.com

export enum HTMLTags {
    'span',
    'div',
    'p',
    'ul',
    'li',
    'th',
    'tr',
    'td',
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
    'img',
    'meta'
}

export type HTMLTag = keyof typeof HTMLTags;

export function html(tag: HTMLTag, attributes: Object, content: string[] = ['']) {
    const attributeString = Object.entries(attributes)
        .map(([attribute, value]) => `${attribute}="${value}"`)
        .join(' ');

    const contentString = content.join('');

    return `<${tag}${!attributeString.length ? '' : ' ' + attributeString}>${contentString}</${tag}>`;
}

/** All individual tag types so you dont have to keep providing them in the html function. */
export const htmlFunctions = Object.keys(HTMLTags).reduce(
    (obj, tag) => ({
        ...obj,
        [tag]: (attributes: Object, content: string[] = ['']) => html(tag as HTMLTag, attributes, content)
    }),
    {} as { readonly [key in HTMLTag]: (attributes: Object, content?: string[]) => string }
);