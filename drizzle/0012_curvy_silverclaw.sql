-- Collapse any pre-existing duplicate `submit` charges (produced by the
-- pre-fix concurrent-poll race / the animate+upscale double-record) down to a
-- single row per workflow, keeping the one with the largest `charged` value
-- (the authoritative terminal charge; the racy/inline rows recorded 0).
DELETE FROM "buzz_events" a
USING "buzz_events" b
WHERE a."kind" = 'submit'
  AND b."kind" = 'submit'
  AND a."workflow_id" = b."workflow_id"
  AND a."workflow_id" IS NOT NULL
  AND (a."charged" < b."charged" OR (a."charged" = b."charged" AND a."id" < b."id"));
--> statement-breakpoint
CREATE UNIQUE INDEX "buzz_events_submit_once" ON "buzz_events" USING btree ("workflow_id") WHERE "buzz_events"."kind" = 'submit';