export const DEFAULT_PAGE_SIZE = 20;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const emptyPagination = (limit = DEFAULT_PAGE_SIZE): PaginationMeta => ({
  page: 1,
  limit,
  total: 0,
  pages: 1
});

export function parsePagination(
  value: Partial<PaginationMeta> | null | undefined,
  limit = DEFAULT_PAGE_SIZE
): PaginationMeta {
  if (!value) return emptyPagination(limit);
  return {
    page: value.page || 1,
    limit: value.limit || limit,
    total: value.total ?? 0,
    pages: Math.max(value.pages || 1, 1)
  };
}
