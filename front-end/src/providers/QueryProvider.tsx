"use client";

import React, { useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { captureReactQueryError } from "@/lib/observability/shared";

const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            captureReactQueryError("query", error, {
              queryKey: query.queryKey,
              meta: query.meta,
            });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, variables, _context, mutation) => {
            captureReactQueryError("mutation", error, {
              mutationKey: mutation.options.mutationKey,
              meta: mutation.meta,
              variables,
            });
          },
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 60_000,
            gcTime: 5 * 60_000,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

export default QueryProvider;
