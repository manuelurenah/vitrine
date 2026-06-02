CREATE TYPE "public"."generation_media_type" AS ENUM('image', 'video');--> statement-breakpoint
ALTER TYPE "public"."generation_source" ADD VALUE 'upscale';--> statement-breakpoint
ALTER TYPE "public"."generation_source" ADD VALUE 'animate';--> statement-breakpoint
ALTER TABLE "campaign_tiles" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "reference_asset_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "variants_per_preset" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "enhanced_prompts" jsonb;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "parent_workflow_id" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "parent_image_index" integer;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "media_type" "generation_media_type" DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "photoshoot_tiles" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "photoshoots" ADD COLUMN "reference_asset_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "photoshoots" ADD COLUMN "enhanced_prompts" jsonb;--> statement-breakpoint
CREATE INDEX "generations_parent_idx" ON "generations" USING btree ("parent_workflow_id");