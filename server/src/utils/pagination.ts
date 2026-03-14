type PaginationInput = {
  page?: unknown;
  limit?: unknown;
};

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : fallback;
};

export const parsePagination = (
  input: PaginationInput,
  options?: { defaultPage?: number; defaultLimit?: number; maxLimit?: number },
) => {
  const defaultPage = options?.defaultPage ?? 1;
  const defaultLimit = options?.defaultLimit ?? 10;
  const maxLimit = options?.maxLimit ?? 100;

  const page = toPositiveInt(input.page, defaultPage);
  const rawLimit = toPositiveInt(input.limit, defaultLimit);
  const limit = Math.min(rawLimit, maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const getTotalPages = (total: number, limit: number) =>
  limit > 0 ? Math.ceil(total / limit) : 0;
