import type { CSSProperties } from "react";
import {
  InvoiceSectionRenderer,
  type InvoiceSectionRendererProps,
} from "@/components/invoice/InvoiceRenderer";
import styles from "./InvoiceTemplateVariants.module.css";

export type InvoiceTemplateVariant =
  | "classic"
  | "modern"
  | "gst"
  | "headerLeft"
  | "banner"
  | "split"
  | "compact"
  | "bold"
  | "halfPage"
  | "mini"
  | "thermal";

const variantClassMap: Record<InvoiceTemplateVariant, string> = {
  classic: styles.classic,
  modern: styles.modern,
  gst: styles.gst,
  headerLeft: styles.headerLeft,
  banner: styles.banner,
  split: styles.split,
  compact: styles.compact,
  bold: styles.bold,
  halfPage: styles.halfPage,
  mini: styles.mini,
  thermal: styles.thermal,
};

type TemplateFrameProps = InvoiceSectionRendererProps & {
  variant: InvoiceTemplateVariant;
};

const TemplateFrame = ({
  variant,
  theme,
  ...rendererProps
}: TemplateFrameProps) => {
  return (
    <div
      className={`${styles.templateShell} ${variantClassMap[variant]}`}
      data-template-frame="true"
      style={
        {
          "--template-primary": theme.primaryColor,
        } as CSSProperties
      }
    >
      <InvoiceSectionRenderer {...rendererProps} theme={theme} />
    </div>
  );
};

export default TemplateFrame;
