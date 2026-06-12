import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const teamRoleEnum = pgEnum("team_role", [
  "admin",
  "copywriter",
  "editor",
  "suporte",
  "gestor_trafego",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "escalou",
  "nao_escalou",
  "em_teste",
  "rodando",
  "pausado",
]);

export const projectTypeEnum = pgEnum("project_type", [
  "vsl",
  "tsl",
]);

export const platformEnum = pgEnum("platform", [
  "meta",
  "tiktok",
  "google",
  "kwai",
]);

export const creativeFormatEnum = pgEnum("creative_format", [
  "especialista",
  "ugc_masc",
  "ugc_fem",
  "famoso",
  "youtuber",
  "autoridade",
  "podcast",
]);

export const creativeStatusEnum = pgEnum("creative_status", [
  "rascunho",
  "validou",
  "nao_validou",
  "escalou",
  "nao_escalou",
]);

export const funnelNodeTypeEnum = pgEnum("funnel_node_type", [
  "checkout",
  "upsell",
  "downsell",
]);

export const changeActionEnum = pgEnum("change_action", [
  "create",
  "update",
  "delete",
]);

export const metricSourceEnum = pgEnum("metric_source", [
  "manual",
  "utmify",
  "meta_api",
  "tiktok_api",
]);

// ============================================================
// 1. TEAM MEMBERS
// ============================================================

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: teamRoleEnum("role").notNull(),
  avatarUrl: text("avatar_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  writtenVsls: many(vsls, { relationName: "vslCopywriter" }),
  writtenCreatives: many(creatives, { relationName: "creativeCopywriter" }),
  editedCreatives: many(creatives, { relationName: "creativeEditor" }),
  managedCampaigns: many(campaigns, { relationName: "campaignManager" }),
}));

// ============================================================
// 2. PROJECTS
// ============================================================

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: projectTypeEnum("type").notNull().default("vsl"),
  niche: text("niche").notNull(),
  language: text("language").notNull(),
  status: projectStatusEnum("status").notNull().default("em_teste"),
  scaleStartDate: timestamp("scale_start_date", { withTimezone: true }),
  scaleEndDate: timestamp("scale_end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  vsls: many(vsls),
  funnels: many(funnels),
  creatives: many(creatives),
  campaigns: many(campaigns),
}));

// ============================================================
// 3. VSLS
// ============================================================

export const vsls = pgTable("vsls", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  copywriterId: integer("copywriter_id").references(() => teamMembers.id),
  btubeLink: text("btube_link"),
  duration: integer("duration"),
  priceRevealSecond: integer("price_reveal_second"),
  buttonAppearSecond: integer("button_appear_second"),
  backRedirectActive: boolean("back_redirect_active").notNull().default(false),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("vsls_project_id_idx").on(t.projectId),
]);

export const vslsRelations = relations(vsls, ({ one }) => ({
  project: one(projects, { fields: [vsls.projectId], references: [projects.id] }),
  copywriter: one(teamMembers, {
    fields: [vsls.copywriterId],
    references: [teamMembers.id],
    relationName: "vslCopywriter",
  }),
}));

// ============================================================
// 4. FUNNELS
// ============================================================

export const funnels = pgTable("funnels", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  salesPageUrl: text("sales_page_url"),
  checkoutUrl: text("checkout_url"),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const funnelsRelations = relations(funnels, ({ one, many }) => ({
  project: one(projects, { fields: [funnels.projectId], references: [projects.id] }),
  nodes: many(funnelNodes),
  orderBumps: many(orderBumps),
}));

// ============================================================
// 5. FUNNEL NODES (árvore upsell/downsell - self-referencing)
// ============================================================

export const funnelNodes = pgTable("funnel_nodes", {
  id: serial("id").primaryKey(),
  funnelId: integer("funnel_id").notNull().references(() => funnels.id, { onDelete: "cascade" }),
  parentNodeId: integer("parent_node_id").references((): AnyPgColumn => funnelNodes.id),
  nodeType: funnelNodeTypeEnum("node_type").notNull(),
  offerName: text("offer_name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  url: text("url"),
  acceptDestinationId: integer("accept_destination_id").references((): AnyPgColumn => funnelNodes.id),
  declineDestinationId: integer("decline_destination_id").references((): AnyPgColumn => funnelNodes.id),
  contentType: text("content_type"),
  textLength: text("text_length"),
  position: integer("position").notNull().default(0),
  acceptanceRate: numeric("acceptance_rate", { precision: 8, scale: 4 }),
  revenuePerCustomer: numeric("revenue_per_customer", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const funnelNodesRelations = relations(funnelNodes, ({ one }) => ({
  funnel: one(funnels, { fields: [funnelNodes.funnelId], references: [funnels.id] }),
  parentNode: one(funnelNodes, {
    fields: [funnelNodes.parentNodeId],
    references: [funnelNodes.id],
    relationName: "parentChild",
  }),
  acceptDestination: one(funnelNodes, {
    fields: [funnelNodes.acceptDestinationId],
    references: [funnelNodes.id],
    relationName: "acceptDest",
  }),
  declineDestination: one(funnelNodes, {
    fields: [funnelNodes.declineDestinationId],
    references: [funnelNodes.id],
    relationName: "declineDest",
  }),
}));

// ============================================================
// 6. ORDER BUMPS
// ============================================================

export const orderBumps = pgTable("order_bumps", {
  id: serial("id").primaryKey(),
  funnelId: integer("funnel_id").notNull().references(() => funnels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderBumpsRelations = relations(orderBumps, ({ one }) => ({
  funnel: one(funnels, { fields: [orderBumps.funnelId], references: [funnels.id] }),
}));

// ============================================================
// 7. CREATIVES / ANÚNCIOS
// ============================================================

export const creatives = pgTable("creatives", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  format: creativeFormatEnum("format").notNull(),
  copyScript: text("copy_script"),
  copywriterId: integer("copywriter_id").references(() => teamMembers.id),
  editorId: integer("editor_id").references(() => teamMembers.id),
  videoLink: text("video_link"),
  publishDate: timestamp("publish_date", { withTimezone: true }),
  status: creativeStatusEnum("status").notNull().default("rascunho"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("creatives_project_id_idx").on(t.projectId),
]);

export const creativesRelations = relations(creatives, ({ one, many }) => ({
  project: one(projects, { fields: [creatives.projectId], references: [projects.id] }),
  copywriter: one(teamMembers, {
    fields: [creatives.copywriterId],
    references: [teamMembers.id],
    relationName: "creativeCopywriter",
  }),
  editor: one(teamMembers, {
    fields: [creatives.editorId],
    references: [teamMembers.id],
    relationName: "creativeEditor",
  }),
  campaignCreatives: many(campaignCreatives),
}));

// ============================================================
// 8. CAMPAIGNS
// ============================================================

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  name: text("name").notNull(),
  objective: text("objective"),
  dailyBudget: numeric("daily_budget", { precision: 10, scale: 2 }),
  managerId: integer("manager_id").references(() => teamMembers.id),
  status: text("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("campaigns_project_id_idx").on(t.projectId),
]);

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  project: one(projects, { fields: [campaigns.projectId], references: [projects.id] }),
  manager: one(teamMembers, {
    fields: [campaigns.managerId],
    references: [teamMembers.id],
    relationName: "campaignManager",
  }),
  campaignCreatives: many(campaignCreatives),
}));

// ============================================================
// 9. CAMPAIGN_CREATIVES (junction N:N)
// ============================================================

export const campaignCreatives = pgTable("campaign_creatives", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  creativeId: integer("creative_id").notNull().references(() => creatives.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("campaign_creatives_campaign_id_creative_id_idx").on(t.campaignId, t.creativeId),
]);

export const campaignCreativesRelations = relations(campaignCreatives, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignCreatives.campaignId], references: [campaigns.id] }),
  creative: one(creatives, { fields: [campaignCreatives.creativeId], references: [creatives.id] }),
}));

// ============================================================
// 10. TAGS
// ============================================================

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("custom"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tagsRelations = relations(tags, ({ many }) => ({
  entityTags: many(entityTags),
}));

// ============================================================
// 11. ENTITY_TAGS (polymorphic junction)
// ============================================================

export const entityTags = pgTable("entity_tags", {
  id: serial("id").primaryKey(),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
}, (t) => [
  uniqueIndex("entity_tags_tag_id_entity_type_entity_id_idx").on(t.tagId, t.entityType, t.entityId),
]);

export const entityTagsRelations = relations(entityTags, ({ one }) => ({
  tag: one(tags, { fields: [entityTags.tagId], references: [tags.id] }),
}));

// ============================================================
// 12. CHANGE LOG
// ============================================================

export const changeLog = pgTable("change_log", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: changeActionEnum("action").notNull(),
  changesJson: jsonb("changes_json"),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("change_log_entity_type_entity_id_idx").on(t.entityType, t.entityId),
]);

// ============================================================
// 13. METRICS SNAPSHOTS (Fase 3 - já preparando a tabela)
// ============================================================

export const metricsSnapshots = pgTable("metrics_snapshots", {
  id: serial("id").primaryKey(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  source: metricSourceEnum("source").notNull().default("manual"),
  // Tráfego
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  ctr: numeric("ctr", { precision: 8, scale: 4 }),
  cpc: numeric("cpc", { precision: 10, scale: 2 }),
  cpm: numeric("cpm", { precision: 10, scale: 2 }),
  spend: numeric("spend", { precision: 12, scale: 2 }),
  // Página de vendas
  pageVisits: integer("page_visits"),
  playRate: numeric("play_rate", { precision: 8, scale: 4 }),
  buttonClickRate: numeric("button_click_rate", { precision: 8, scale: 4 }),
  // Checkout
  checkoutVisits: integer("checkout_visits"),
  conversionRate: numeric("conversion_rate", { precision: 8, scale: 4 }),
  avgTicket: numeric("avg_ticket", { precision: 10, scale: 2 }),
  bumpAcceptanceRate: numeric("bump_acceptance_rate", { precision: 8, scale: 4 }),
  // Consolidados
  cpa: numeric("cpa", { precision: 10, scale: 2 }),
  roas: numeric("roas", { precision: 10, scale: 2 }),
  revenue: numeric("revenue", { precision: 12, scale: 2 }),
  ltv: numeric("ltv", { precision: 10, scale: 2 }),
  margin: numeric("margin", { precision: 10, scale: 2 }),
  // Extra
  videoRetentionJson: jsonb("video_retention_json"),
  extraData: jsonb("extra_data"),
  // Colunas de idempotência do sync UTMify (0006).
  // NULL para todos os outros entityTypes — o índice parcial só cobre as linhas UTMify.
  utmifyCampaignId: text("utmify_campaign_id"),
  utmifyDashboardId: text("utmify_dashboard_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("metrics_snapshots_entity_type_idx").on(t.entityType),
  index("metrics_snapshots_entity_type_entity_id_date_idx").on(t.entityType, t.entityId, t.date),
  // Índices parciais de idempotência: garantem que um retry do Vercel não duplique.
  // PARCIAIS (WHERE entity_type = '...') → não afetam os outros entityTypes.
  uniqueIndex("metrics_snapshots_utmify_campaign_daily_uniq")
    .on(t.date, t.utmifyCampaignId)
    .where(sql`entity_type = 'utmify_campaign_daily'`),
  uniqueIndex("metrics_snapshots_utmify_dashboard_uniq")
    .on(t.date, t.utmifyDashboardId)
    .where(sql`entity_type = 'dashboard'`),
]);

// ============================================================
// 14. EXTERNAL MAPPINGS (para integração UTMify - Fase 3)
// ============================================================

export const externalMappings = pgTable("external_mappings", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  platform: text("platform").notNull(),
  externalId: text("external_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // (platform, external_id): cada nome externo aponta pra UMA oferta — e uma oferta
  // pode ter N campanhas/produtos. O unique antigo (entity_type, entity_id, platform)
  // limitava a 1 mapeamento por oferta, o que inviabilizava a central de mapeamento.
  uniqueIndex("external_mappings_platform_external_id_idx").on(t.platform, t.externalId),
]);

// ============================================================
// 15. A/B TESTS
// ============================================================

export const abTestStatusEnum = pgEnum("ab_test_status", [
  "running",
  "completed",
  "cancelled",
]);

export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: abTestStatusEnum("status").notNull().default("running"),
  winnerId: integer("winner_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const abTestVariants = pgTable("ab_test_variants", {
  id: serial("id").primaryKey(),
  abTestId: integer("ab_test_id").notNull().references(() => abTests.id, { onDelete: "cascade" }),
  variantName: text("variant_name").notNull(),
  description: text("description"),
  metricsJson: jsonb("metrics_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const abTestsRelations = relations(abTests, ({ many }) => ({
  variants: many(abTestVariants),
}));

export const abTestVariantsRelations = relations(abTestVariants, ({ one }) => ({
  abTest: one(abTests, { fields: [abTestVariants.abTestId], references: [abTests.id] }),
}));

// ============================================================
// 16. ALERTS
// ============================================================

export const alertOperatorEnum = pgEnum("alert_operator", [
  "gt",
  "lt",
  "eq",
]);

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  metric: text("metric").notNull(),
  operator: alertOperatorEnum("operator").notNull(),
  threshold: numeric("threshold", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alertHistory = pgTable("alert_history", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  currentValue: numeric("current_value", { precision: 12, scale: 2 }),
  message: text("message"),
});

// ============================================================
// 17. OFFER TRACKING (substitui planilha de acompanhamento)
// ============================================================

export const offerTracking = pgTable("offer_tracking", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  copyVsl: text("copy_vsl"),
  copyAds: text("copy_ads"),
  editorAds: text("editor_ads"),
  editorVsl: text("editor_vsl"),
  ticket: text("ticket"),
  language: text("language").notNull().default("EN"),
  copyVslStatus: text("copy_vsl_status").default("NAO"),
  copyCriativosStatus: text("copy_criativos_status").default("NAO"),
  vslInVturb: text("vsl_in_vturb").default("NAO"),
  adsCopyByPerson: jsonb("ads_copy_by_person"),
  adsEditedCount: integer("ads_edited_count").default(0),
  adsEditedByPerson: jsonb("ads_edited_by_person"),
  adsRejectedCount: integer("ads_rejected_count").default(0),
  editorStatus: jsonb("editor_status"),
  campaignsActive: text("campaigns_active").default("NAO"),
  validation: text("validation").default("EM ANDAMENTO"),
  preScale: text("pre_scale").default("NAO"),
  scale: text("scale").default("NAO"),
  productCreated: text("product_created").default("NAO"),
  productApproved: text("product_approved").default("NAO"),
  siteCreated: text("site_created").default("NAO"),
  // siteUrl: deprecated. Mantido por compat (espelha siteUrls.vsl one-way).
  // Não está no allowlist de updateOfferField; toda escrita passa por updateOfferSiteUrls.
  siteUrl: text("site_url"),
  // siteUrls: fonte de verdade pros domínios da oferta — shape em src/lib/site-urls.ts
  siteUrls: jsonb("site_urls"),
  gender: text("gender"),
  adFormat: creativeFormatEnum("ad_format"),
  observations: text("observations"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 18. AGENT APPROVALS (aba Agentes — decisões dos agentes Black/White)
// ============================================================

export const agentApprovals = pgTable("agent_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: text("task_id").notNull(),
  agente: text("agente").notNull(),
  acao: text("acao").notNull(),
  feedback: text("feedback"),
  feedbackAudioUrl: text("feedback_audio_url"),
  executionId: text("execution_id"),
  sessionId: text("session_id"),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// 19. AGENT PRODUCTS (histórico PERSISTENTE dos produtos gerados pelos agentes)
// O n8n faz prune das executions antigas — sem esta tabela, score do revisor e
// link do Drive somem do dash quando a execution expira. Upsert idempotente
// feito pelo aggregate (onConflictDoNothing no unique abaixo).
// ============================================================

export const agentProducts = pgTable("agent_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: text("task_id").notNull(),
  agente: text("agente").notNull(), // black | white
  executionId: text("execution_id").notNull(),
  revisorScore: numeric("revisor_score", { precision: 5, scale: 2 }),
  revisorAprovado: boolean("revisor_aprovado"),
  driveFileId: text("drive_file_id"),
  driveUrl: text("drive_url"),
  driveFilename: text("drive_filename"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("agent_products_task_agente_exec_uniq").on(t.taskId, t.agente, t.executionId),
  index("agent_products_task_id_idx").on(t.taskId),
]);
