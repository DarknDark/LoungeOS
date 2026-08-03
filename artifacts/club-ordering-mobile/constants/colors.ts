/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#f7f0e7',
    tint: '#d9a441',

    background: '#0b090a',
    foreground: '#f7f0e7',

    card: '#171214',
    cardForeground: '#f7f0e7',

    primary: '#d9a441',
    primaryForeground: '#17100a',

    secondary: '#251c1c',
    secondaryForeground: '#f7f0e7',

    muted: '#21191b',
    mutedForeground: '#a79a91',

    accent: '#3b2420',
    accentForeground: '#f3c35d',

    destructive: '#c95b55',
    destructiveForeground: '#fff7f2',

    border: '#322526',
    input: '#382829',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
