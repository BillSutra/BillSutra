import { PurchaseDraftProvider } from "./PurchaseDraftContext";

const PurchasesLayout = ({ children }: LayoutProps<"/purchases">) => (
  <PurchaseDraftProvider>{children}</PurchaseDraftProvider>
);

export default PurchasesLayout;
