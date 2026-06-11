CREATE TABLE "tile_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tile_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"workflow_id" text NOT NULL,
	"prompt" text NOT NULL,
	"ad_copy" jsonb,
	"asset_id" uuid,
	"change_note" text,
	"generation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tile_versions" ADD CONSTRAINT "tile_versions_tile_id_campaign_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."campaign_tiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_versions" ADD CONSTRAINT "tile_versions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tile_versions_tile_idx" ON "tile_versions" USING btree ("tile_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "tile_versions_tile_version_uidx" ON "tile_versions" USING btree ("tile_id","version");