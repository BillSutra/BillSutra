"use client";

import React from "react";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

type NextAuthSessionProviderProps = React.ComponentProps<
  typeof NextAuthSessionProvider
>;

const SessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <NextAuthSessionProvider
      refetchOnWindowFocus={false}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      {children as NextAuthSessionProviderProps["children"]}
    </NextAuthSessionProvider>
  );
};

export default SessionProvider;
