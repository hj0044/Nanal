import { getPortrait } from "./portrait-catalog";

export type PortraitWidth = 160 | 320 | 640 | 1024;

/** Only URLs that have already passed the manifest approval/trusted-CDN gate are optimized. */
export function portraitUrl(id: string | undefined, width: PortraitWidth): string | undefined {
  const approvedUrl = getPortrait(id)?.imageUrl;
  if (!approvedUrl) return undefined;
  const image = new URL(approvedUrl);
  const quality = width <= 320 ? 75 : width <= 640 ? 82 : 85;
  image.searchParams.set("tr", `w-${width},q-${quality},f-auto`);
  return image.href;
}
