type ListContainer<T> = {
  items?: T[];
};

export const normalizeListResponse = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const container = payload as ListContainer<T>;
    if (Array.isArray(container.items)) {
      return container.items;
    }
  }

  return [];
};
