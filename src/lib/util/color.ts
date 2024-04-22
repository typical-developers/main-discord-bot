/**
 * Turn a hex value into an RGB value.
 * @param hex The hex value you want to convert.
 * @returns {`${string}, ${string}, ${string}`} The r, g, b value.
 */
export function hexToRGB(hex: `#${string}`): `${string}, ${string}, ${string}` {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `255, 255, 255`;

    const { r, g, b } = {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };

    return `${r}, ${g}, ${b}`;
}