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
