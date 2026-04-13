import { ValidationField } from "@/components/ui/ValidationField";
import { INDIAN_STATES, type BusinessAddressInput } from "@/lib/indianAddress";
import {
  validateIndianPincode,
  validateIndianState,
  validateRequired,
} from "@/lib/validation";
import { useI18n } from "@/providers/LanguageProvider";

type AutofillStatus = {
  tone: "success" | "neutral" | "error";
  message: string;
};

type BusinessAddressFieldsProps = {
  value: BusinessAddressInput;
  onFieldChange: (field: keyof BusinessAddressInput, value: string) => void;
  onAddressPaste?: (rawText: string) => void;
  autofillStatus?: AutofillStatus | null;
  autofillPending?: boolean;
};

const statusToneClassName: Record<AutofillStatus["tone"], string> = {
  success: "text-emerald-600",
  neutral: "text-slate-500",
  error: "text-amber-700",
};

const BusinessAddressFields = ({
  value,
  onFieldChange,
  onAddressPaste,
  autofillStatus,
  autofillPending = false,
}: BusinessAddressFieldsProps) => {
  const { t } = useI18n();

  return (
    <div className="md:col-span-2">
      <div className="grid gap-x-5 gap-y-5">
        <ValidationField
          id="addressLine1"
          label={t("businessProfilePage.fields.addressLine1")}
          value={value.addressLine1}
          onChange={(next) => onFieldChange("addressLine1", next)}
          onPaste={(event) => {
            if (!onAddressPaste) return;
            const pastedText = event.clipboardData?.getData("text") ?? "";
            onAddressPaste(pastedText);
          }}
          validate={validateRequired}
          required
          placeholder={t("businessProfilePage.placeholders.addressLine1")}
          success
          autoComplete="street-address"
          className="mb-0"
        />

        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
          <ValidationField
            id="city"
            label={t("businessProfilePage.fields.city")}
            value={value.city}
            onChange={(next) => onFieldChange("city", next)}
            validate={validateRequired}
            required
            placeholder={t("businessProfilePage.placeholders.city")}
            success
            autoComplete="address-level2"
            className="mb-0"
          />

          <ValidationField
            id="state"
            label={t("businessProfilePage.fields.state")}
            as="select"
            value={value.state}
            onChange={(next) => onFieldChange("state", next)}
            validate={validateIndianState}
            required
            success
            autoComplete="address-level1"
            className="mb-0"
          >
            <option value="">{t("common.selectOption")}</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </ValidationField>
        </div>

        <ValidationField
          id="pincode"
          label={t("businessProfilePage.fields.pincode")}
          value={value.pincode}
          onChange={(next) => onFieldChange("pincode", next)}
          validate={validateIndianPincode}
          required
          placeholder={t("businessProfilePage.placeholders.pincode")}
          success
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={6}
          className="mb-0 md:max-w-[280px]"
        />

        {autofillPending ? (
          <p className="text-xs text-slate-500" role="status">
            {t("businessProfilePage.messages.autofillLoading")}
          </p>
        ) : null}

        {autofillStatus?.message ? (
          <p
            className={`text-xs ${statusToneClassName[autofillStatus.tone]}`}
            role="status"
          >
            {autofillStatus.message}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default BusinessAddressFields;
