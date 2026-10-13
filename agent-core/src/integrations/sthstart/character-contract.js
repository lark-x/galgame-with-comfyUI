/**
 * Normalize the public character catalog response at the SthStart boundary.
 * SthStart currently returns camelCase fields in `items`; older integrations
 * used `characters` and snake_case fields, so keep both shapes readable here.
 */
export function normalizePublicCharacterList(payload) {
  const source = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.characters)
      ? payload.characters
      : [];

  return source
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = String(item.id ?? '').trim();
      const slug = String(item.slug ?? '').trim();
      const displayName = String(item.displayName ?? item.display_name ?? '').trim();
      const avatar = item.avatarUrl ?? item.avatar_url;
      const version = Number(item.latestVersion ?? item.latest_version ?? 0);

      return {
        id,
        slug,
        display_name: displayName,
        avatar_url: typeof avatar === 'string' && avatar.trim() ? avatar : null,
        latest_version: Number.isFinite(version) ? Math.max(0, Math.trunc(version)) : 0,
      };
    })
    .filter((item) => item.id && item.display_name);
}
