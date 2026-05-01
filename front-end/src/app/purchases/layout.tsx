import type { ReactNode } from "react";
import { PurchaseDraftProvider } from "./PurchaseDraftContext";

type PurchasesLayoutProps = {
  children: ReactNode;
};

const PurchasesLayout = ({ children }: PurchasesLayoutProps) => (
  <PurchaseDraftProvider>{children}</PurchaseDraftProvider>
);

export default PurchasesLayout;
