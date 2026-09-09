import { boolean, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, varchar, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const orderStatus = pgEnum("order_status", ["pending", "paid", "filled", "signed", "cancelled"]);
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(), lang: varchar("lang", { length: 2 }).notNull().default("it"),
  name: text("name").notNull(), email: text("email").notNull(), phone: text("phone"),
  subject: text("subject").notNull(), message: text("message").notNull(), consent: boolean("consent").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(), publicId: varchar("public_id", { length: 64 }).notNull().unique(),
  email: text("email").notNull(), phone: text("phone"), service: text("service").notNull(),
  durationMonths: integer("duration_months").notNull(), amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("eur"),
  provider: varchar("provider", { length: 16 }), providerReference: text("provider_reference"),
  paymentMethod: varchar("payment_method", { length: 20 }),
  accessTokenHash: text("access_token_hash"), quoteData: jsonb("quote_data"),
  termsVersion: text("terms_version"), termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsText: text("terms_text"), requestEmailSentAt: timestamp("request_email_sent_at", { withTimezone: true }),
  adminEmailSentAt: timestamp("admin_email_sent_at", { withTimezone: true }), checkoutUrl: text("checkout_url"),
  status: orderStatus("status").notNull().default("pending"), formData: jsonb("form_data"), signaturePath: text("signature_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const otpVerifications = pgTable("otp_verifications", {
  id: serial("id").primaryKey(), orderPublicId: varchar("order_public_id", { length: 64 }).notNull(),
  phone: text("phone").notNull(), codeHash: text("code_hash").notNull(), sends: integer("sends").notNull().default(1), sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(), attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Customer accounts are provisioned by staff, never inferred from a public email address.
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(), email: text("email").notNull().unique(),
  name: text("name").notNull(), companyName: text("company_name"), phone: text("phone").notNull(),
  passwordHash: text("password_hash"), locale: varchar("locale", { length: 2 }).notNull().default("it"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});
export const customerChallenges = pgTable("customer_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0), sends: integer("sends").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});
export const customerSessions = pgTable("customer_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const customerPasswordTokens = pgTable("customer_password_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
export const customerContracts = pgTable("customer_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  title: text("title").notNull(), titleEn: text("title_en").notNull(),
  reference: text("reference").notNull(), storageKey: text("storage_key").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const customerAudit = pgTable("customer_audit", {
  id: serial("id").primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  event: varchar("event", { length: 60 }).notNull(), documentId: uuid("document_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const authLimits = pgTable("auth_limits", {
  key: varchar("key", { length: 64 }).primaryKey(), count: integer("count").default(1).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// All published and charged prices are read from these tables, never from UI constants.
export const serviceCatalog = pgTable("service_catalog", {
  code: varchar("code", { length: 30 }).primaryKey(),
  vatBps: integer("vat_bps").notNull().default(2200),
  additionalDiscountBps: integer("additional_discount_bps").notNull().default(1000),
  newActivationDiscountBps: integer("new_activation_discount_bps").notNull().default(0),
  offerValidUntil: timestamp("offer_valid_until", { withTimezone: true }),
  termsRevision: text("terms_revision").notNull(), active: boolean("active").notNull().default(true),
});
export const servicePrices = pgTable("service_prices", {
  id: serial("id").primaryKey(), service: varchar("service", { length: 30 }).notNull().references(() => serviceCatalog.code),
  months: integer("months").notNull(), listCents: integer("list_cents").notNull(), offerCents: integer("offer_cents"),
  newActivation: boolean("new_activation").notNull().default(false), active: boolean("active").notNull().default(true),
}, table => [uniqueIndex("service_duration_unique").on(table.service, table.months)]);
export const serviceAddons = pgTable("service_addons", {
  code: varchar("code", { length: 50 }).primaryKey(), service: varchar("service", { length: 30 }).notNull().references(() => serviceCatalog.code),
  titleIt: text("title_it").notNull(), titleEn: text("title_en").notNull(),
  priceCents: integer("price_cents").notNull(), annualCents: integer("annual_cents").notNull().default(0),
  billing: varchar("billing", { length: 20 }).notNull(), maxQuantity: integer("max_quantity").notNull().default(1),
  selectable: boolean("selectable").notNull().default(false), sortOrder: integer("sort_order").notNull().default(0),
});
export const standardOfferRequests = pgTable("standard_offer_requests", {
  id: uuid("id").primaryKey(), service: varchar("service", { length: 30 }).notNull(),
  title: varchar("title", { length: 4 }).notNull(), firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  email: text("email").notNull(), lang: varchar("lang", { length: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("sending"), payloadHash: text("payload_hash").notNull(),
  attachmentHash: text("attachment_hash"), catalogSnapshot: jsonb("catalog_snapshot"), messageId: text("message_id"), errorCode: text("error_code"),
  consentAt: timestamp("consent_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
