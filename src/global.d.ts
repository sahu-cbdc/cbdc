/**
 * Global type declarations for the ported application.
 *
 * The original HTML files shared their state through a `window.CBDCShared`
 * global and also exposed a few page-level helpers on `window` (used by
 * inline `onclick` handlers generated with innerHTML). This declaration keeps
 * the ported code compiling while preserving the exact runtime behavior.
 */
declare global {
  var CBDCShared: any;
  interface Window {
    CBDCShared: any;
    [key: string]: any;
  }
}

export {};
