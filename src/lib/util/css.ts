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
    'text_align',
    'box_sizing',
    'filter',
    'text_shadow',
    'z_index',
    'top',
    '_webkit_background_clip',
    '_webkit_text_fill_color',
    '_webkit_mask_image'
}

export type CSSDeclaration = {
    [key in keyof typeof CSSDeclarations]?: string;
};

export function declarations(declarations: CSSDeclaration) {
    const declarationsString = Object.entries(declarations)
        .map(([property, value]) => `${property.replaceAll('_', '-')}:${value};`)
        .join('');

    return declarationsString;
}

export function css(className: string, declarations: CSSDeclaration) {
    const declarationsString = Object.entries(declarations)
        .map(([property, value]) => `${property.replaceAll('_', '-')}:${value};`)
        .join('');

    return `${className}{${declarationsString}}`;
}
