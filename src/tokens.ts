/**
 * Design tokens matching the editor's CSS variables.
 * Used across all Remotion components for consistent rendering.
 */

export const tokens = {
  navy900: '#051A2D',
  navy700: '#002B54',
  navy500: '#003B73',
  blue400: '#0183FF',
  accent: '#1F8AFF',
  white: '#FFFFFF',
  textDim: '#8B92A3',
  canvasW: 1920,
  canvasH: 1080,
  // ─── New SVG-extracted tokens ───
  bgOuter: '#002B54',      // outer canvas bg for slides
  bgOuterAlt: '#032444',   // outer canvas bg for focus v1
  bgInnerOverlay: 'rgba(0,0,0,0.2)',
  cardInsetX: 10,
  cardInsetY: 113.5,
  cardW: 1900,
  cardH: 853,
  cardRadius: 20,
  cyan: '#7ABEFF',         // designation color, connector line, tick stroke
  cyanGlow: '#7ABEFF',     // halo glow color
  tickInactive: '#032444', // empty tick fill
  tickActive: '#0183FF',   // active tick fill (with glow)
  avatarPlaceholder: '#1B4369',
  bluePillBase: '#0183FF',
  blueNote: '#006ACF',     // journey footer note card
  customerStatsBg: '#ECF6FF',
  customerCardBorder: '#0183FF',
  customerBodyText: '#1F2431',
  customerLogoText: '#444444',
} as const;

/**
 * Satoshi font-face CSS for embedding in Remotion.
 * Remotion loads these via <style> in the composition.
 */
export function satoshiFontFaceCSS(fonts: Record<string, string>): string {
  return `
    @font-face { font-family: 'Satoshi'; font-weight: 400; font-style: normal; src: url('${fonts.regular}') format('opentype'); }
    @font-face { font-family: 'Satoshi'; font-weight: 500; font-style: normal; src: url('${fonts.medium}') format('opentype'); }
    @font-face { font-family: 'Satoshi'; font-weight: 700; font-style: normal; src: url('${fonts.bold}') format('opentype'); }
    @font-face { font-family: 'Satoshi'; font-weight: 900; font-style: normal; src: url('${fonts.black}') format('opentype'); }
    @font-face { font-family: 'Satoshi'; font-weight: 400; font-style: italic; src: url('${fonts.italic}') format('opentype'); }
    @font-face { font-family: 'Satoshi'; font-weight: 700; font-style: italic; src: url('${fonts.boldItalic}') format('opentype'); }
  `;
}
