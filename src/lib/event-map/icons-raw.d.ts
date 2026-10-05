/**
 * `~icons/lucide/<name>?raw` imports are SVG markup strings (unplugin-icons),
 * used where icons go into plain DOM nodes (calendar cards, map markers).
 * The longer prefix wins over unplugin-icons' `~icons/*` component typing.
 */
declare module '~icons/lucide/*?raw' {
  const svg: string;
  export default svg;
}
