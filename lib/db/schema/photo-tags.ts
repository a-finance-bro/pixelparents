import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// People tagged in a family's photos. Each row tags one person (a parent or a
// child) in one photo (identified by its Blob pathname within the owning
// family's `signups.photos`). Admin-only feature.
export const photoTags = pgTable("photo_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // The family whose photo this is (scopes tags to a family's gallery).
  signupId: uuid("signup_id").notNull(),
  // Which photo — the private Blob pathname stored in signups.photos[].pathname.
  photoPathname: text("photo_pathname").notNull(),
  // Who is tagged: 'parent' (a signups row) or 'child' (a children row).
  taggedType: text("tagged_type").notNull(),
  taggedId: uuid("tagged_id").notNull(),
  taggedName: text("tagged_name").notNull(),
  createdBy: text("created_by"),
});

export type PhotoTagRow = typeof photoTags.$inferSelect;
