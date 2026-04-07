import type { QueryClient } from "@tanstack/react-query";
import {
  createCustomer,
  createInvoice,
  createProduct,
  fetchCustomers,
  fetchInvoices,
  fetchProducts,
  fetchBusinessProfile,
  saveBusinessProfile,
} from "@/lib/apiClient";

export const BEGINNER_STATE_STORAGE_KEY = "billsutra.beginner-state.v1";
export const BEGINNER_HINTS_STORAGE_KEY = "billsutra.beginner-hints.v1";

export type BeginnerState = {
  onboardingSeen: boolean;
  demoSeeded: boolean;
};

const DEFAULT_BEGINNER_STATE: BeginnerState = {
  onboardingSeen: false,
  demoSeeded: false,
};

const canUseStorage = () => typeof window !== "undefined";

const readJson = <T,>(key: string, fallback: T): T => {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
};

export const getBeginnerState = () =>
  readJson<BeginnerState>(BEGINNER_STATE_STORAGE_KEY, DEFAULT_BEGINNER_STATE);

export const updateBeginnerState = (patch: Partial<BeginnerState>) => {
  const next = {
    ...getBeginnerState(),
    ...patch,
  };
  writeJson(BEGINNER_STATE_STORAGE_KEY, next);
  return next;
};

export const markOnboardingSeen = () =>
  updateBeginnerState({ onboardingSeen: true });

export const markDemoSeeded = () => updateBeginnerState({ demoSeeded: true });

export const getSeenHints = () =>
  readJson<string[]>(BEGINNER_HINTS_STORAGE_KEY, []);

export const hasSeenHint = (id: string) => getSeenHints().includes(id);

export const markHintSeen = (id: string) => {
  const current = getSeenHints();
  if (current.includes(id)) return current;
  const next = [...current, id];
  writeJson(BEGINNER_HINTS_STORAGE_KEY, next);
  return next;
};

export const resetBeginnerExperience = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(BEGINNER_STATE_STORAGE_KEY);
  window.localStorage.removeItem(BEGINNER_HINTS_STORAGE_KEY);
};

export const invalidateBeginnerQueries = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["business-profile"] }),
    queryClient.invalidateQueries({ queryKey: ["products"] }),
    queryClient.invalidateQueries({ queryKey: ["customers"] }),
    queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
};

const DEMO_BILL_NOTE = "Bill Sutra demo bill";

const normalizeValue = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const seedDemoWorkspace = async () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const suffix = String(now.getTime()).slice(-5);

  const existingProfile = await fetchBusinessProfile();
  if (!existingProfile) {
    await saveBusinessProfile({
      business_name: "Sharma Kirana Store",
      address: "Main Road, Ward 8, Indore",
      phone: "9876543210",
      currency: "INR",
      show_logo_on_invoice: false,
      show_tax_number: false,
      show_payment_qr: false,
    });
  }

  const [customers, productsPage, invoices] = await Promise.all([
    fetchCustomers(),
    fetchProducts({ page: 1, limit: 100 }),
    fetchInvoices(),
  ]);

  const customer =
    customers.find(
      (entry) =>
        normalizeValue(entry.name) === normalizeValue("Ravi Kumar") ||
        normalizeValue(entry.phone) === "9898989898",
    ) ??
    (await createCustomer({
      name: "Ravi Kumar",
      phone: "9898989898",
      address: "Nearby market, Indore",
    }));

  const existingProducts = productsPage.products;
  const demoProductConfigs = [
    {
      name: "Tea Packet",
      skuPrefix: "SAMPLE-TEA-",
      price: 120,
      gst_rate: 5,
      stock_on_hand: 24,
      reorder_level: 5,
    },
    {
      name: "Sugar 1kg",
      skuPrefix: "SAMPLE-SUGAR-",
      price: 48,
      gst_rate: 5,
      stock_on_hand: 30,
      reorder_level: 6,
    },
    {
      name: "Biscuits Pack",
      skuPrefix: "SAMPLE-BISCUIT-",
      price: 20,
      gst_rate: 12,
      stock_on_hand: 42,
      reorder_level: 8,
    },
  ] as const;

  const products = await Promise.all(
    demoProductConfigs.map(async (config) => {
      const existingProduct = existingProducts.find(
        (entry) =>
          normalizeValue(entry.name) === normalizeValue(config.name) ||
          entry.sku.startsWith(config.skuPrefix),
      );

      if (existingProduct) {
        return existingProduct;
      }

      return createProduct({
        name: config.name,
        sku: `${config.skuPrefix}${suffix}`,
        price: config.price,
        gst_rate: config.gst_rate,
        stock_on_hand: config.stock_on_hand,
        reorder_level: config.reorder_level,
      });
    }),
  );

  const invoice =
    invoices.find(
      (entry) =>
        normalizeValue(entry.notes) === normalizeValue(DEMO_BILL_NOTE) ||
        normalizeValue(entry.customer?.name) === normalizeValue(customer.name),
    ) ??
    (await createInvoice({
      customer_id: customer.id,
      date,
      due_date: date,
      discount: 0,
      discount_type: "FIXED",
      status: "SENT",
      notes: DEMO_BILL_NOTE,
      sync_sales: false,
      items: [
        {
          product_id: products[0]?.id,
          name: products[0]?.name ?? "Tea Packet",
          quantity: 2,
          price: Number(products[0]?.price ?? 120),
          tax_rate: Number(products[0]?.gst_rate ?? 5),
        },
        {
          product_id: products[1]?.id,
          name: products[1]?.name ?? "Sugar 1kg",
          quantity: 1,
          price: Number(products[1]?.price ?? 48),
          tax_rate: Number(products[1]?.gst_rate ?? 5),
        },
      ],
    }));

  markDemoSeeded();

  return {
    customer,
    products,
    invoice,
  };
};
