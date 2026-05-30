CREATE TYPE "public"."asset_kind" AS ENUM('upload', 'generated', 'reference');--> statement-breakpoint
CREATE TYPE "public"."asset_owner" AS ENUM('user', 'brand', 'product', 'tile');--> statement-breakpoint
CREATE TYPE "public"."buzz_event_kind" AS ENUM('estimate', 'submit', 'refund');--> statement-breakpoint
CREATE TYPE "public"."generation_source" AS ENUM('campaign', 'photoshoot', 'adhoc');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('welcome', 'input', 'generating', 'dna', 'next');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('live', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tile_status" AS ENUM('queued', 'cooking', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('queued', 'cooking', 'done', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"owner_type" "asset_owner",
	"brand_id" uuid,
	"product_id" uuid,
	"bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text,
	"content_type" text,
	"byte_size" integer,
	"width" integer,
	"height" integer,
	"sha256" text,
	"dominant_color" text,
	"palette" jsonb,
	"vlm_tags" jsonb,
	"workflow_id" text,
	"source_tile_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_url" text,
	"palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone" text,
	"industry" text,
	"audience" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buzz_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workflow_id" text,
	"kind" "buzz_event_kind" NOT NULL,
	"estimated" integer DEFAULT 0 NOT NULL,
	"charged" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"preset_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"prompt" text NOT NULL,
	"seed" text,
	"status" "tile_status" DEFAULT 'cooking' NOT NULL,
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"actual_buzz" integer DEFAULT 0 NOT NULL,
	"asset_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"brand_id" uuid,
	"product_id" uuid,
	"title" text NOT NULL,
	"brief" jsonb NOT NULL,
	"preset_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"audience" text,
	"industry" text,
	"goal" text,
	"channels" text[],
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"actual_buzz" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"workflow_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" "generation_source" NOT NULL,
	"source_id" uuid,
	"tile_id" uuid,
	"status" "workflow_status" DEFAULT 'queued' NOT NULL,
	"prompt" text,
	"input" jsonb NOT NULL,
	"snapshot" jsonb,
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"charged_buzz" integer DEFAULT 0 NOT NULL,
	"error" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_step" "onboarding_step" DEFAULT 'welcome' NOT NULL,
	"completed_at" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photoshoot_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photoshoot_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"variant_index" integer DEFAULT 0 NOT NULL,
	"workflow_id" text NOT NULL,
	"prompt" text NOT NULL,
	"seed" text,
	"status" "tile_status" DEFAULT 'cooking' NOT NULL,
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"actual_buzz" integer DEFAULT 0 NOT NULL,
	"asset_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photoshoots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid,
	"title" text NOT NULL,
	"brief" jsonb NOT NULL,
	"ratio" text NOT NULL,
	"variants_per_template" integer DEFAULT 1 NOT NULL,
	"template_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"actual_buzz" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_assets" (
	"product_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" text DEFAULT 'reference' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_assets_product_id_asset_id_pk" PRIMARY KEY("product_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"brand_id" uuid,
	"hero_asset_id" uuid,
	"name" text NOT NULL,
	"sku" text,
	"notes" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"used_in_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"civitai_id" integer,
	"username" text,
	"display_name" text,
	"email" text,
	"avatar_url" text,
	"tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_brand_id_brand_profiles_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buzz_events" ADD CONSTRAINT "buzz_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tiles" ADD CONSTRAINT "campaign_tiles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tiles" ADD CONSTRAINT "campaign_tiles_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brand_profiles_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photoshoot_tiles" ADD CONSTRAINT "photoshoot_tiles_photoshoot_id_photoshoots_id_fk" FOREIGN KEY ("photoshoot_id") REFERENCES "public"."photoshoots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photoshoot_tiles" ADD CONSTRAINT "photoshoot_tiles_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photoshoots" ADD CONSTRAINT "photoshoots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photoshoots" ADD CONSTRAINT "photoshoots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_assets" ADD CONSTRAINT "product_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brand_profiles_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assets_brand_idx" ON "assets" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "assets_product_idx" ON "assets" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "assets_workflow_idx" ON "assets" USING btree ("workflow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_bucket_key_uidx" ON "assets" USING btree ("bucket","storage_key");--> statement-breakpoint
CREATE INDEX "brand_profiles_user_idx" ON "brand_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "buzz_events_user_idx" ON "buzz_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "buzz_events_workflow_idx" ON "buzz_events" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "campaign_tiles_campaign_idx" ON "campaign_tiles" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_tiles_workflow_uidx" ON "campaign_tiles" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "campaigns_user_created_idx" ON "campaigns" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generations_user_idx" ON "generations" USING btree ("user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "generations_source_idx" ON "generations" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "photoshoot_tiles_shoot_idx" ON "photoshoot_tiles" USING btree ("photoshoot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photoshoot_tiles_workflow_uidx" ON "photoshoot_tiles" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "photoshoots_user_created_idx" ON "photoshoots" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "product_assets_asset_idx" ON "product_assets" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "products_user_idx" ON "products" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_user_sku_uidx" ON "products" USING btree ("user_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "users_civitai_id_uidx" ON "users" USING btree ("civitai_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uidx" ON "users" USING btree ("username");