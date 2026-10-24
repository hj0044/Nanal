import { getApprovedAppearanceSet, getPortrait } from "./portrait-catalog";

export type PortraitWidth = 160 | 320 | 640 | 1024;

/** Only URLs that have already passed the manifest approval/trusted-CDN gate are optimized. */
export function portraitUrl(id: string | undefined, width: PortraitWidth): string | undefined {
  const approvedUrl = getPortrait(id)?.imageUrl;
  if (!approvedUrl) return undefined;
  // Live approved assets use same-origin /api/... URLs and must not be sent to ImageKit.
  if (approvedUrl.startsWith("/api/appearance/assets/")) {
    const requested = new URL(approvedUrl,"https://nanal.local");
    requested.searchParams.set("w",String(width));
    return requested.pathname+requested.search;
  }
  if (approvedUrl.startsWith("/")) return approvedUrl;
  const image = new URL(approvedUrl);
  const quality = width <= 320 ? 75 : width <= 640 ? 82 : 85;
  image.searchParams.set("tr", `w-${width},q-${quality},f-auto`);
  return image.href;
}

/** Full-body rendering requires both approved AP slots and matching locked body metrics. */
export function fullBodyUrl(portraitId: string | undefined, heightCm: number | undefined, weightKg: number | undefined, width: PortraitWidth): string | undefined {
  const set = getApprovedAppearanceSet(portraitId);
  if (!set?.physicalVerified || !set.fullBody || heightCm !== set.portrait.heightCm || weightKg !== set.portrait.weightKg) return undefined;
  const approvedUrl = set.fullBody.imageUrl;
  if (!approvedUrl) return undefined;
  if (approvedUrl.startsWith("/api/appearance/assets/")) return `${approvedUrl}?w=${width}`;
  const image = new URL(approvedUrl);
  image.searchParams.set("tr", `w-${width},q-82,f-auto`);
  return image.href;
}
