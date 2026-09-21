import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
export const lists = sqliteTable("lists", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), name: text("name").notNull(),
  description: text("description").notNull(), allowUrls: integer("allow_urls", { mode: "boolean" }), creatorHandle: text("creator_handle"),
  approvalId: text("approval_id").notNull(), model: text("model").notNull(), createdAt: integer("created_at").notNull(),
}, t => [index("idx_lists_created").on(t.createdAt, t.id)]);
export const items = sqliteTable("list_items", {
  id: text("id").primaryKey(), listId: text("list_id").notNull().references(() => lists.id),
  submissionHash: text("submission_hash").notNull(), contentHash: text("content_hash").notNull(),
  title: text("title").notNull(), content: text("content").notNull(), sourceUrl: text("source_url"), sourceHost: text("source_host"), author: text("author"),
  score: integer("score").notNull(), rawScore: text("raw_score").notNull(), approvalId: text("approval_id").notNull(), scoreId: text("score_id").notNull(), model: text("model").notNull(), createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("idx_list_items_submission").on(t.listId, t.submissionHash), uniqueIndex("idx_list_items_content").on(t.listId, t.contentHash), index("idx_list_items_rank").on(t.listId, t.score, t.createdAt, t.id), check("items_score_bounds", sql`${t.score} BETWEEN 0 AND 1000`)]);
export const operationLocks = sqliteTable("operation_locks", { key: text("key").primaryKey(), token: text("token").notNull(), expiresAt: integer("expires_at").notNull() });
export const rateLimits = sqliteTable("rate_limits", { key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull() }, t => [index("idx_rate_limits_expiry").on(t.expiresAt)]);
