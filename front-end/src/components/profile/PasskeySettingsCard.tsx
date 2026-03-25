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
import { useI18n } from "@/providers/LanguageProvider";

const PasskeySettingsCard = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn: fetchPasskeys,
  });
  const [label, setLabel] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const hydrated = useHydrated();
  const { t, formatDate } = useI18n();

  const formatPasskeyDate = (value?: string | null) => {
    if (!value) return t("passkeys.never");

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t("passkeys.unknown");

    return formatDate(parsed, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const supportsPasskeys = useMemo(
    () =>
      hydrated &&
      typeof window.PublicKeyCredential !== "undefined",
    [hydrated],
  );

  const handleAddPasskey = async () => {
    if (!supportsPasskeys) {
      toast.error(t("passkeys.unsupported"));
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
      toast.success(t("passkeys.addedToast"));
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t("passkeys.registerError");
      toast.error(message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (id: number) => {
    setDeletingId(id);
    try {
      await removePasskey(id);
      toast.success(t("passkeys.removedToast"));
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : t("passkeys.removeError");
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">{t("passkeys.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-[#5c4b3b]">
          {t("passkeys.description")}
        </p>
        <p className="text-xs text-[#8a6d56]">
          {t("passkeys.linkedNote")}
        </p>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("passkeys.placeholder")}
            maxLength={191}
            disabled={isRegistering}
          />
          <Button
            type="button"
            onClick={handleAddPasskey}
            disabled={!supportsPasskeys || isRegistering}
          >
            {isRegistering ? t("passkeys.adding") : t("passkeys.add")}
          </Button>
        </div>

        {!supportsPasskeys ? (
          <p className="text-xs text-[#8a6d56]">{t("passkeys.unsupported")}</p>
        ) : null}

        <div className="grid gap-3">
          {isLoading ? (
            <p className="text-sm text-[#8a6d56]">{t("passkeys.loading")}</p>
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
                      {t("passkeys.deviceType", {
                        type: credential.device_type,
                      })}
                      {credential.backed_up ? ` | ${t("passkeys.synced")}` : ""}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      {t("passkeys.added", {
                        date: formatPasskeyDate(credential.created_at),
                      })}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      {t("passkeys.lastUsed", {
                        date: formatPasskeyDate(credential.last_used_at),
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => void handleDeletePasskey(credential.id)}
                    disabled={deletingId === credential.id}
                  >
                    {deletingId === credential.id
                      ? t("passkeys.removing")
                      : t("passkeys.remove")}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#ecdccf] bg-[#fff9f2] p-4 text-sm text-[#8a6d56]">
              {t("passkeys.empty")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PasskeySettingsCard;
