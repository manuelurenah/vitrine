ALTER TABLE "brand_profiles" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "font" text;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "aesthetics" text;--> statement-breakpoint
ALTER TABLE "brand_profiles" DROP COLUMN "audience";