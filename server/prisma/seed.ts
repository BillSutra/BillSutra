import prisma from "../src/config/db.config.js";

type TemplateSeed = {
  name: string;
  description: string;
  layoutConfig: {
    primaryColor: string;
    font: string;
    tableStyle: "minimal" | "grid" | "modern";
    layout: "stacked" | "split";
  };
  sections: Array<{
    key: string;
    order: number;
    isDefault: boolean;
  }>;
};

const templates: TemplateSeed[] = [
  {
    name: "Minimal",
    description: "Clean grid layout with quiet typography.",
    layoutConfig: {
      primaryColor: "#2563eb",
      font: "Geist Sans",
      tableStyle: "minimal",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "payment_info", order: 5, isDefault: true },
      { key: "footer", order: 6, isDefault: true },
    ],
  },
  {
    name: "Modern",
    description: "Gradient accents with bold totals.",
    layoutConfig: {
      primaryColor: "#0f766e",
      font: "Sora",
      tableStyle: "modern",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "discount", order: 6, isDefault: true },
      { key: "payment_info", order: 7, isDefault: true },
      { key: "notes", order: 8, isDefault: true },
      { key: "footer", order: 9, isDefault: true },
    ],
  },
  {
    name: "Professional",
    description: "Structured for enterprise clients.",
    layoutConfig: {
      primaryColor: "#1f2937",
      font: "Geist Mono",
      tableStyle: "grid",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "footer", order: 7, isDefault: true },
    ],
  },
  {
    name: "Retail",
    description: "Balanced table and POS friendly totals.",
    layoutConfig: {
      primaryColor: "#b45309",
      font: "Fraunces",
      tableStyle: "minimal",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "discount", order: 6, isDefault: true },
      { key: "payment_info", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Compact",
    description: "Slim spacing for quick billing flows.",
    layoutConfig: {
      primaryColor: "#4338ca",
      font: "Geist Sans",
      tableStyle: "minimal",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "payment_info", order: 5, isDefault: true },
      { key: "footer", order: 6, isDefault: true },
    ],
  },
  {
    name: "Slate",
    description: "Muted tones with sharp dividers.",
    layoutConfig: {
      primaryColor: "#0f172a",
      font: "Geist Mono",
      tableStyle: "grid",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "footer", order: 7, isDefault: true },
    ],
  },
  {
    name: "Apex",
    description: "Crisp layout with premium contrast.",
    layoutConfig: {
      primaryColor: "#7c2d12",
      font: "Fraunces",
      tableStyle: "modern",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "discount", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Receipt",
    description: "Compact POS layout for faster billing.",
    layoutConfig: {
      primaryColor: "#0f766e",
      font: "Geist Sans",
      tableStyle: "minimal",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "items", order: 3, isDefault: true },
      { key: "tax", order: 4, isDefault: true },
      { key: "payment_info", order: 5, isDefault: true },
      { key: "footer", order: 6, isDefault: true },
    ],
  },
  {
    name: "Luxe",
    description: "Elegant spacing for high-end services.",
    layoutConfig: {
      primaryColor: "#4c1d95",
      font: "Sora",
      tableStyle: "modern",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "service_items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Studio",
    description: "Creative layout with summary highlights.",
    layoutConfig: {
      primaryColor: "#0e7490",
      font: "Geist Sans",
      tableStyle: "modern",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "service_items", order: 4, isDefault: true },
      { key: "discount", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Ledgerline",
    description: "Editorial spacing with confident totals.",
    layoutConfig: {
      primaryColor: "#1f2937",
      font: "Geist Sans",
      tableStyle: "grid",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Atlas",
    description: "Balanced columns for global accounts.",
    layoutConfig: {
      primaryColor: "#0f766e",
      font: "Sora",
      tableStyle: "modern",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "discount", order: 6, isDefault: true },
      { key: "payment_info", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Harbor",
    description: "Calm layout for service studios.",
    layoutConfig: {
      primaryColor: "#1d4ed8",
      font: "Geist Sans",
      tableStyle: "minimal",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "service_items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Verity",
    description: "Clear hierarchy with minimal chrome.",
    layoutConfig: {
      primaryColor: "#111827",
      font: "Geist Mono",
      tableStyle: "grid",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Kite",
    description: "Lightweight editorial tone for startups.",
    layoutConfig: {
      primaryColor: "#7c3aed",
      font: "Geist Sans",
      tableStyle: "minimal",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "discount", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "footer", order: 7, isDefault: true },
    ],
  },
  {
    name: "Cascade",
    description: "Editorial rhythm for long service lists.",
    layoutConfig: {
      primaryColor: "#0f172a",
      font: "Fraunces",
      tableStyle: "modern",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "service_items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Civic",
    description: "Trustworthy grid for enterprise billing.",
    layoutConfig: {
      primaryColor: "#0c4a6e",
      font: "Geist Mono",
      tableStyle: "grid",
      layout: "stacked",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "items", order: 4, isDefault: true },
      { key: "tax", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
  {
    name: "Monarch",
    description: "Polished editorial look for premium clients.",
    layoutConfig: {
      primaryColor: "#7c2d12",
      font: "Sora",
      tableStyle: "modern",
      layout: "split",
    },
    sections: [
      { key: "header", order: 1, isDefault: true },
      { key: "company_details", order: 2, isDefault: true },
      { key: "client_details", order: 3, isDefault: true },
      { key: "service_items", order: 4, isDefault: true },
      { key: "discount", order: 5, isDefault: true },
      { key: "payment_info", order: 6, isDefault: true },
      { key: "notes", order: 7, isDefault: true },
      { key: "footer", order: 8, isDefault: true },
    ],
  },
];

const run = async () => {
  await prisma.$transaction(async (tx) => {
    for (const template of templates) {
      const existing = await tx.template.findFirst({
        where: { name: template.name },
      });

      const record = existing
        ? await tx.template.update({
            where: { id: existing.id },
            data: {
              description: template.description,
              layout_config: template.layoutConfig,
            },
          })
        : await tx.template.create({
            data: {
              name: template.name,
              description: template.description,
              layout_config: template.layoutConfig,
            },
          });

      await tx.templateSection.deleteMany({
        where: { template_id: record.id },
      });

      await tx.templateSection.createMany({
        data: template.sections.map((section) => ({
          template_id: record.id,
          section_key: section.key,
          section_order: section.order,
          is_default: section.isDefault,
        })),
      });
    }
  });
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
