import { ValidationField } from "@/components/ui/ValidationField";
import { INDIAN_STATES, type BusinessAddressInput } from "@/lib/indianAddress";
import {
  sanitizeBusinessAddressLine,
  sanitizeBusinessCity,
  sanitizeBusinessPincode,
  sanitizeBusinessState,
  validateBusinessAddressLine,
  validateBusinessCity,
  validateBusinessPincode,
  validateBusinessState,
} from "@/lib/businessProfileValidation";
import { useI18n } from "@/providers/LanguageProvider";

type AutofillStatus = {
  tone: "success" | "neutral" | "error";
  message: string;
};

type BusinessAddressFieldsProps = {
  value: BusinessAddressInput;
  onFieldChange: (field: keyof BusinessAddressInput, value: string) => void;
  onFieldBlur?: (field: keyof BusinessAddressInput) => void;
  onAddressPaste?: (rawText: string) => void;
  autofillStatus?: AutofillStatus | null;
  autofillPending?: boolean;
  forceTouched?: boolean;
};

const statusToneClassName: Record<AutofillStatus["tone"], string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-zinc-500 dark:text-zinc-400",
  error: "text-amber-700 dark:text-amber-400",
};

const BusinessAddressFields = ({
  value,
  onFieldChange,
  onFieldBlur,
  onAddressPaste,
  autofillStatus,
  autofillPending = false,
  forceTouched = false,
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
          onBlur={() => onFieldBlur?.("addressLine1")}
          normalizeOnBlur={sanitizeBusinessAddressLine}
          validate={validateBusinessAddressLine}
          required
          placeholder={t("businessProfilePage.placeholders.addressLine1")}
          success
          forceTouched={forceTouched}
          maxLength={200}
          autoComplete="street-address"
          className="mb-0"
        />

        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
          <ValidationField
            id="city"
            label={t("businessProfilePage.fields.city")}
            value={value.city}
            onChange={(next) => onFieldChange("city", next)}
            onBlur={() => onFieldBlur?.("city")}
            normalizeOnBlur={sanitizeBusinessCity}
            validate={validateBusinessCity}
            required
            placeholder={t("businessProfilePage.placeholders.city")}
            success
            forceTouched={forceTouched}
            maxLength={100}
            autoComplete="address-level2"
            className="mb-0"
          />

          <ValidationField
            id="state"
            label={t("businessProfilePage.fields.state")}
            as="select"
            value={value.state}
            onChange={(next) => onFieldChange("state", next)}
            onBlur={() => onFieldBlur?.("state")}
            normalizeOnBlur={sanitizeBusinessState}
            validate={validateBusinessState}
            required
            success
            forceTouched={forceTouched}
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
          onBlur={() => onFieldBlur?.("pincode")}
          normalizeOnBlur={sanitizeBusinessPincode}
          validate={validateBusinessPincode}
          required
          placeholder={t("businessProfilePage.placeholders.pincode")}
          success
          forceTouched={forceTouched}
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
