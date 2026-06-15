ALTER TABLE "campaign_tiles" ADD COLUMN "variant_group_id" uuid;--> statement-breakpoint
ALTER TABLE "campaign_tiles" ADD COLUMN "variant_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "campaign_tiles_variant_group_idx" ON "campaign_tiles" USING btree ("campaign_id","variant_group_id","variant_index");