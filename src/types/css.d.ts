/**
 * Ambient declarations so TypeScript accepts the CSS imports used by the Expo
 * web target (Metro resolves them at bundle time; tsc only needs the shapes).
 */

declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
