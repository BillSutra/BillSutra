-- CreateTable
CREATE TABLE "user_saved_templates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "base_template_id" INTEGER,
    "enabled_sections" TEXT[] NOT NULL,
    "section_order" TEXT[] NOT NULL,
    "theme_color" TEXT,
    "design_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_saved_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_saved_templates_user_id_idx" ON "user_saved_templates"("user_id");

-- CreateIndex
CREATE INDEX "user_saved_templates_base_template_id_idx" ON "user_saved_templates"("base_template_id");

-- AddForeignKey
ALTER TABLE "user_saved_templates" ADD CONSTRAINT "user_saved_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_templates" ADD CONSTRAINT "user_saved_templates_base_template_id_fkey" FOREIGN KEY ("base_template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
