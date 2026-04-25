"use client";

import React, { useEffect, useRef } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { API_URL } from "@/lib/apiEndPoints";
import {
  clearLegacyStoredToken,
  clearSecureAuthBootstrapped,
  hasSecureAuthBootstrap,
  isSecureAuthEnabled,
  markSecureAuthBootstrapped,
  normalizeAuthToken,
} from "@/lib/secureAuth";

type SessionUserWithToken = {
  token?: string;
};

const AuthTokenSync = () => {
  const { data, status } = useSession();
  const bootstrappingTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    const token = normalizeAuthToken(
      (data?.user as SessionUserWithToken | undefined)?.token ?? null,
    );

    if (!token) {
      if (status === "unauthenticated") {
        clearLegacyStoredToken();
        clearSecureAuthBootstrapped();
      }
      return;
    }

    if (!isSecureAuthEnabled() || hasSecureAuthBootstrap()) {
      return;
    }

    if (bootstrappingTokenRef.current === token) {
      return;
    }

    bootstrappingTokenRef.current = token;

    void axios
      .post(
        `${API_URL}/auth/session/bootstrap`,
        {},
        {
          withCredentials: true,
          headers: {
            Authorization: token.startsWith("Bearer ")
              ? token
              : `Bearer ${token}`,
          },
        },
      )
      .then(() => {
        markSecureAuthBootstrapped();
      })
      .catch(() => {
        bootstrappingTokenRef.current = null;
      });
  }, [data?.user, status]);

  return null;
};

export default AuthTokenSync;
