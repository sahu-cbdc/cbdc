import { appBase } from "../lib/router";

const LOGO_FILE = "https://i.ibb.co.com/vvQH0zKr/logo.jpg";

function isAbsolute(src: string): boolean {
  return /^(https?:)?\/\//i.test(src) || src.startsWith("data:");
}

export function logoUrl(): string {
  if (isAbsolute(LOGO_FILE)) return LOGO_FILE;
  let base = "/";
  try {
    base = appBase() || "/";
  } catch {
    base = "/";
  }
  if (!base.endsWith("/")) base += "/";
  return base + LOGO_FILE.replace(/^\.?\//, "");
}

export const LOGO_URL = /*#__PURE__*/ logoUrl();

export function applyLogo(root: ParentNode = document): void {
  const src = logoUrl();
  root.querySelectorAll<HTMLImageElement>("[data-logo]").forEach((img) => {
    if (img.getAttribute("src") !== src) img.src = src;
  });
}

export default LOGO_URL;
