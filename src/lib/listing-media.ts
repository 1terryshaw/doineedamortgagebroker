// Returns string[] of photo URLs from a listing's `cached_photos`, regardless
// of shape. Accepts: string[], Array<{ url: string }>, null, undefined, or
// anything else. Always returns an array (empty on unrecognized shape) — never
// throws. NOTE: the shape is unverified — every `cached_photos` value in
// mortgage_listings was NULL at write time (TDL #612), so this helper is written
// defensively to tolerate whatever an enrichment pass (TDL #613) eventually
// lands.
export function getPhotoUrls(cached: unknown): string[] {
  if (!Array.isArray(cached)) return [];
  return cached
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "url" in item) {
        const url = (item as { url: unknown }).url;
        return typeof url === "string" ? url : null;
      }
      return null;
    })
    .filter((u): u is string => u !== null && u.length > 0);
}
