/** True when at least one line has a non-empty description. */
export function hasEnteredLineItems(
  items: Array<{ description?: string }> | null | undefined
): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.some(
    (item) => typeof item?.description === 'string' && item.description.trim().length > 0
  );
}
