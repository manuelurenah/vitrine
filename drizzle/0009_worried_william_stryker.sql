ALTER TYPE "public"."generation_source" ADD VALUE 'ad_campaign' BEFORE 'adhoc';--> statement-breakpoint
CREATE TABLE "ad_campaign_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_campaign_id" uuid NOT NULL,
	"size_id" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"aspect_ratio" text NOT NULL,
	"workflow_id" text NOT NULL,
	"prompt" text NOT NULL,
	"seed" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" "tile_status" DEFAULT 'queued' NOT NULL,
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"actual_buzz" integer DEFAULT 0 NOT NULL,
	"asset_id" uuid,
	"ad_copy" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"brand_id" uuid,
	"product_id" uuid,
	"title" text NOT NULL,
	"brief" jsonb NOT NULL,
	"size_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"reference_asset_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"enhanced_prompts" jsonb,
	"ad_copy" jsonb,
	"audience" text,
	"aesthetics" text,
	"estimated_buzz" integer DEFAULT 0 NOT NULL,
	"actual_buzz" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_campaign_tiles" ADD CONSTRAINT "ad_campaign_tiles_ad_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaign_tiles" ADD CONSTRAINT "ad_campaign_tiles_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_brand_id_brand_profiles_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_campaign_tiles_campaign_idx" ON "ad_campaign_tiles" USING btree ("ad_campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_campaign_tiles_workflow_uidx" ON "ad_campaign_tiles" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "ad_campaigns_user_created_idx" ON "ad_campaigns" USING btree ("user_id","created_at");