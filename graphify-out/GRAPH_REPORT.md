# Graph Report - lms-drive  (2026-06-22)

## Corpus Check
- 292 files · ~449,369 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1164 nodes · 2169 edges · 85 communities (70 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea9edfd3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 93 edges
2. `formatDate()` - 36 edges
3. `formatPrice()` - 32 edges
4. `CalendarEvent` - 21 edges
5. `createAdminClient()` - 17 edges
6. `DamageEntry` - 16 edges
7. `createClient()` - 16 edges
8. `compilerOptions` - 16 edges
9. `syncReservationToCalendar()` - 15 edges
10. `CalendarResource` - 15 edges

## Surprising Connections (you probably didn't know these)
- `ClientPage()` --calls--> `formatDate()`  [INFERRED]
  app/(dashboard)/clients/[id]/page.tsx → lib/utils/index.ts
- `OperationDetailPage()` --calls--> `formatDate()`  [INFERRED]
  app/(dashboard)/partnerships/[id]/page.tsx → lib/utils/index.ts
- `GET()` --calls--> `getAgencySettings()`  [EXTRACTED]
  app/(dashboard)/accounting/export/pdf/route.ts → lib/contracts/agency.ts
- `InfractionDetailPage()` --calls--> `formatDate()`  [INFERRED]
  app/(dashboard)/incidents/infractions/[id]/page.tsx → lib/utils/index.ts
- `SinistreDetailPage()` --calls--> `formatDate()`  [INFERRED]
  app/(dashboard)/incidents/sinistres/[id]/page.tsx → lib/utils/index.ts

## Import Cycles
- None detected.

## Communities (85 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (10): ContractPDF(), DamagedZone, fmtDate(), fmtDT(), fmtMoney(), InspectionPage(), InspectionPDFData, s (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (6): NotificationsPage(), syncAlertsToCalendar(), GET(), ResourceRow, createAdminClient(), AppAlert

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (10): closeInfraction(), createAccident(), createInfraction(), lookupDriver(), markInfractionPaid(), num(), transmitInfractionToClient(), Driver (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (11): AccountingTransactions(), COLORS, ICONS, NotificationsList(), Toast, ToastContext, ToastProvider(), ToastType (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (41): dependencies, class-variance-authority, clsx, date-fns, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, framer-motion (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (25): Badge(), BadgeProps, badgeVariants, Button, ButtonProps, buttonVariants, Card, CardContent (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.21
Nodes (12): generateInvoiceDraft(), nextInvoiceNumber(), sendInvoice(), SupabaseServer, updateInvoiceLines(), InvoiceData, InvoiceLineItem, InvoicePDF() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (38): createMaintenanceRecord(), GARAGE_TYPES, loadFlags(), NewIssue, reportVehicleIssues(), resolveVehicleIssue(), setVehicleRepairStatus(), buildLastByType() (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (8): applyDiscount(), buildBasePayload(), createClientAction(), parseDiscount(), updateClientAction(), updateClientStatus(), uploadClientDoc(), ClientStatus

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (13): deleteDocument(), sendDocumentByEmail(), uploadDocument(), DOCUMENT_SUBCATEGORIES, DocumentCategory, isExpiringSoon(), SENSITIVE_SUBCATEGORIES, Client (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (14): deleteClient(), deleteContract(), deleteVehicle(), updateDepositStatus(), PAYMENT_LABELS, DOCS, Props, Props (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (3): OperationDetailPage(), OPERATION_FLOW, OPERATION_STATUS

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (11): logout(), managerItems, navItems, SidebarProps, adminModules, MenuPage(), modules, ROLE_LABELS (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (8): deleteTask(), STATUSES, TYPES, updateTask(), createTask(), TYPES, createClient(), DriverResult

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (50): AlertPanelProps, CalendarBottomBarProps, CalendarGrid(), CalendarGridProps, rangeFor(), SlotContext, CalendarSidebarProps, CalendarToolbar() (+42 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (24): closeCampaign(), createCampaign(), updateCampaignStatus(), AnimatedList(), AnimatedListItem(), AnimatedTabsProps, Tab, SwipeableRowProps (+16 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (19): AuditLog, Contract, ContractStatus, DamagedZone, DepositStatus, Document, DocumentCategory, Incident (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (9): DOCUMENT_CATEGORIES, ALL_DOC_KEYS, Props, ALL_TAB_KEYS, APP_TABS, AppTab, ALL_DOC_KEYS, COLORS (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.20
Nodes (10): compressImageToBase64(), EDL_ZONES, Zone2D, zoneBox(), DAMAGE_TYPES, DamageSeverity, damageTypeLabel(), GRAVITES (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): DamageDrawerProps, SEVERITY_ACTIVE, SEVERITY_STYLES, DamageZone

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (7): addAccidentToVehicle(), updateAccidentStatus(), Incident, STATUS_COLORS, STATUSES, Vehicle, SINISTRE_FLOW

### Community 22 - "Community 22"
Cohesion: 0.20
Nodes (9): updateAgencySettings(), AGENCY_DEFAULTS, AgencySettings, getAgencySettings(), ConventionPage(), IaDepartureInspectionPage(), ContractPreviewPage(), SettingsPage() (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (6): conventionClauses(), ConventionPreviewClient(), formatDateTime(), formatPrice(), Props, SignatureCanvasProps

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (8): POST(), buildContractPdfData(), BuiltContractData, fetchPhotoAsDataUrl(), loadEdlSchemaDataUrl(), loadLogoDataUrl(), SupabaseServer, ContractData

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (15): bookOperationTransaction(), createAgency(), createOperation(), num(), parseExternalVehicle(), recordReturn(), startEntrantRental(), updateOperationStatus() (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.23
Nodes (5): createVehicle(), updateVehicle(), updateVehicleStatus(), VehicleStatus, STATUSES

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (11): aliases, components, utils, rsc, style, tailwind, baseColor, config (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (11): background_color, categories, description, display, icons, name, orientation, short_name (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.06
Nodes (49): deleteReservation(), resetInspection(), createReservation(), DIACRITICS_RE, isNameBlacklisted(), normalizeName(), postRentalRevenue(), prolongReservation() (+41 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (9): calculateExtraKm(), calculateLateFee(), FuelGaugeProps, CLEANLINESS_LEVELS, ComputedFees, Props, Step, buildDamageFlag() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (13): ALL, EXPENSE_CATEGORIES, getCategoryLabel(), PAYMENT_METHODS, REVENUE_CATEGORIES, createTransaction(), createDueDate(), deleteDueDate() (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (7): BODY_OUTLINE, LABEL, LAYOUT, VIEW_VB, VIEWS, ZONE_COORDS, ZoneCoord

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (8): Tx, closeAnnualAccounting(), closeDailyAccounting(), closeMonthlyAccounting(), toggleTransparence(), updateTransactionNotes(), MONTHS, MONTHS

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (12): GET(), DashboardLayout(), ALERT_GROUPS, AlertGroup, DashboardPage(), getVehicle(), TASK_STATUS_BADGE, TASK_STATUS_LABEL (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (9): lunette-arriere, label, points, lunette-avant, label, points, toit, label (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (10): devDependencies, dotenv, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (9): 1. Variables d'environnement, 2. Base de données Supabase, 3. Premier utilisateur (gérant), 4. Lancer en développement, Configuration, LMS Drive — Phase 1 MVP, Modules Phase 1, Rôles (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (5): Vehicle, CATEGORIES, FUEL_TYPES, TRANSMISSIONS, VehicleFormProps

### Community 39 - "Community 39"
Cohesion: 0.17
Nodes (7): InfractionDetailPage(), Vehicle, INFRACTION_STATUS, infractionTypeLabel(), SINISTRE_STATUS, BackButtonProps, formatPrice()

### Community 40 - "Community 40"
Cohesion: 0.21
Nodes (3): TYPE_LABELS, TYPES, ROLE_CONFIG

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (3): inter, metadata, viewport

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 43 - "Community 43"
Cohesion: 0.19
Nodes (9): DamageComparisonProps, VEHICLE_ZONES, VehicleView, VIEW_LABELS, BODY_OUTLINE, VehicleViewSVGProps, VIEWBOX, ZONE_COORDS (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (4): VehicleInspection3DProps, ZoneDef, ZoneMeshProps, ZONES

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (6): endTrip(), startTrip(), DrawerProps, PURPOSES, Trip, Vehicle

### Community 46 - "Community 46"
Cohesion: 0.43
Nodes (5): Props, ZONE_COLORS, DamagedZone, VEHICLE_ZONES, ZoneId

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (3): COLORS, Member, ROLES

### Community 48 - "Community 48"
Cohesion: 0.38
Nodes (5): EmailType, logEmail(), LogEmailParams, POST(), resend

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (8): ALL_HOURS, CalEvent, computeColumns(), durPx(), EVENT_COLORS, RESA_STATUS, TASK_LABELS, toPx()

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (3): ROLE_CONFIG, STATUS_BADGE, STATUS_LABEL

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (5): drawerSpring, fadeIn, listItem, listStagger, slideUp

### Community 52 - "Community 52"
Cohesion: 0.40
Nodes (3): supabase, INITIAL_VEHICLES, SeedVehicle

### Community 53 - "Community 53"
Cohesion: 0.22
Nodes (4): setWeeklyAvailability(), DAYS, Profile, Slot

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (8): Props, METHOD_LABELS, Props, DepositSettlement(), fmt(), Props, SEIZURE, createClient()

### Community 57 - "Community 57"
Cohesion: 0.22
Nodes (4): ClientFormProps, DOC_TYPES, PAYMENT_METHODS, Client

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (3): Driver, Vehicle, INFRACTION_TYPES

### Community 75 - "Community 75"
Cohesion: 0.67
Nodes (3): config, matchTab(), proxy()

### Community 76 - "Community 76"
Cohesion: 0.39
Nodes (7): getFeesTable(), getLegalArticles(), LegalArticlesParams, ContractPreviewClient(), formatDateTime(), formatPrice(), Props

### Community 77 - "Community 77"
Cohesion: 0.29
Nodes (5): PAYMENT_METHODS, PAYMENT_STATUSES, PaymentMethodType, PaymentStatus, Props

### Community 79 - "Community 79"
Cohesion: 0.36
Nodes (6): AccountingPdf(), AccountingPdfData, fmt(), s, GET(), MONTHS

### Community 80 - "Community 80"
Cohesion: 0.24
Nodes (6): DEPARTURE_DEMO, RETURN_DEMO, DamageEntry, VehicleInspectionMapProps, Props, Props

### Community 83 - "Community 83"
Cohesion: 0.16
Nodes (10): DailyClosingPage(), SinistreDetailPage(), VehiclePage(), COLUMNS, Task, TaskCard(), formatDate(), formatDateRange() (+2 more)

## Knowledge Gaps
- **372 isolated node(s):** `version`, `configurations`, `PreToolUse`, `PERIODS`, `Tx` (+367 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 14` to `Community 1`, `Community 2`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 13`, `Community 16`, `Community 22`, `Community 24`, `Community 25`, `Community 26`, `Community 29`, `Community 31`, `Community 33`, `Community 34`, `Community 39`, `Community 40`, `Community 45`, `Community 47`, `Community 48`, `Community 50`, `Community 53`, `Community 56`, `Community 78`, `Community 79`, `Community 82`, `Community 83`, `Community 91`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 54` to `Community 2`, `Community 3`, `Community 77`, `Community 15`, `Community 16`, `Community 49`, `Community 83`, `Community 30`, `Community 25`, `Community 62`, `Community 31`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `formatDate()` connect `Community 83` to `Community 33`, `Community 39`, `Community 40`, `Community 9`, `Community 10`, `Community 11`, `Community 7`, `Community 13`, `Community 16`, `Community 21`, `Community 25`, `Community 31`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `formatDate()` (e.g. with `CampaignDetailPage()` and `ClientPage()`) actually correct?**
  _`formatDate()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `version`, `configurations`, `PreToolUse` to the rest of the system?**
  _372 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.06439393939393939 - nodes in this community are weakly interconnected._