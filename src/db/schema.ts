import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  boolean,
  text,
  numeric

} from "drizzle-orm/pg-core";


/* =========================
   USERS
========================= */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),

  email: varchar("email", { length: 255 })
    .notNull()
    .unique(),

  passwordHash: varchar("password_hash", {
    length: 255,
  }),

  role: varchar("role", {
    length: 20,
  })
    .notNull()
    .default("VIEWER"),

  provider: varchar("provider", {
    length: 50,
  })
    .notNull()
    .default("local"),

  providerId: varchar("provider_id", {
    length: 255,
  }),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

/* =========================
   REFRESH TOKENS
========================= */

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),

  userId: integer("user_id")
  .notNull()
  .references(() => users.id),

  tokenHash: varchar("token_hash", {
  length: 255,
  }).notNull(),

  deviceId: varchar("device_id", {
    length: 255,
  }),

  expiresAt: timestamp("expires_at")
    .notNull(),

  revokedAt: timestamp("revoked_at"),
});

/* =========================
   API KEYS
========================= */

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),

  userId: integer("user_id")
  .notNull()
  .references(() => users.id),

  keyHash: varchar("key_hash", {
    length: 255,
  }).notNull(),

  label: varchar("label", {
    length: 255,
  }).notNull(),

  role: varchar("role", {
    length: 20,
  })
    .notNull()
    .default("VIEWER"),

  lastUsedAt: timestamp("last_used_at"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

/* =========================
   CATEGORIES
========================= */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),

  name: varchar("name", {
    length: 255,
  }).notNull(),

  slug: varchar("slug", {
    length: 255,
  })
    .notNull()
    .unique(),
});

/* =========================
   PRODUCTS
========================= */

export const products = pgTable("products", {
  id: serial("id").primaryKey(),

  categoryId: integer("category_id")
  .notNull()
  .references(() => categories.id),

  name: varchar("name", {
    length: 255,
  }).notNull(),

  description: text("description"),

  price: numeric("price", {
  precision: 10,
  scale: 2,
}).notNull(),

  stock: integer("stock")
    .notNull()
    .default(0),

  imageUrl: varchar("image_url", {
    length: 500,
  }),

  isDeleted: boolean("is_deleted")
    .notNull()
    .default(false),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});