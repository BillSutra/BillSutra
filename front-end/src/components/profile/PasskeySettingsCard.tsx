"use client";

import React, { useMemo, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchPasskeys,
  removePasskey,
  requestPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from "@/lib/authClient";
import { useHydrated } from "@/hooks/useHydrated";

const formatDate = (value?: string | null) => {
  if (!value) return "Never";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return parsed.toLocaleString();
};

const PasskeySettingsCard = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn: fetchPasskeys,
  });
  const [label, setLabel] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const hydrated = useHydrated();

  const supportsPasskeys = useMemo(
    () =>
      hydrated &&
      typeof window.PublicKeyCredential !== "undefined",
    [hydrated],
  );

  const handleAddPasskey = async () => {
    if (!supportsPasskeys) {
      toast.error("Passkeys are not supported in this browser.");
      return;
    }

    setIsRegistering(true);
    try {
      const optionsResponse =
        await requestPasskeyRegistrationOptions<Record<string, unknown>>(
          label.trim() || undefined,
        );

      const browserResponse = await startRegistration({
        optionsJSON: optionsResponse.options as unknown as Parameters<
          typeof startRegistration
        >[0]["optionsJSON"],
      });

      await verifyPasskeyRegistration(
        optionsResponse.challenge_id,
        browserResponse,
        label.trim() || undefined,
      );

      setLabel("");
      toast.success("Passkey added successfully.");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to register a passkey.";
      toast.error(message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (id: number) => {
    setDeletingId(id);
    try {
      await removePasskey(id);
      toast.success("Passkey removed.");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to remove passkey.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Passkeys</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-[#5c4b3b]">
          Add a passkey to this account to sign in with Face ID, fingerprint,
          or your device PIN.
        </p>
        <p className="text-xs text-[#8a6d56]">
          Passkeys saved here are linked only to the currently signed-in
          account.
        </p>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Optional label, e.g. Office laptop"
            maxLength={191}
            disabled={isRegistering}
          />
          <Button
            type="button"
            onClick={handleAddPasskey}
            disabled={!supportsPasskeys || isRegistering}
          >
            {isRegistering ? "Adding..." : "Add passkey"}
          </Button>
        </div>

        {!supportsPasskeys ? (
          <p className="text-xs text-[#8a6d56]">
            This browser does not support passkeys.
          </p>
        ) : null}

        <div className="grid gap-3">
          {isLoading ? (
            <p className="text-sm text-[#8a6d56]">Loading your passkeys...</p>
          ) : data && data.length > 0 ? (
            data.map((credential) => (
              <div
                key={credential.id}
                className="rounded-2xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#1f1b16]">
                      {credential.label}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      Device type: {credential.device_type}
                      {credential.backed_up ? " | Synced passkey" : ""}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      Added: {formatDate(credential.created_at)}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      Last used: {formatDate(credential.last_used_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => void handleDeletePasskey(credential.id)}
                    disabled={deletingId === credential.id}
                  >
                    {deletingId === credential.id ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#ecdccf] bg-[#fff9f2] p-4 text-sm text-[#8a6d56]">
              No passkeys added yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PasskeySettingsCard;
