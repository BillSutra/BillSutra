'use client'

import React from "react";
// import { Button } from "../ui/button";
import {Button} from "@/components/ui/button";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/providers/LanguageProvider";

const SubmitBtn = () => {
    const { pending } = useFormStatus()
    const { t } = useI18n();
  return (

      <div className="mt-4">
        <Button className="w-full" disabled={pending}>
          {pending ? t("common.processing") : t("common.submit")}
        </Button>
      </div>
   
  );
};

export default SubmitBtn;
