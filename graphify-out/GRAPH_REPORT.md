# Graph Report - lms-drive  (2026-07-02)

## Corpus Check
- 353 files · ~574,873 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1382 nodes · 2640 edges · 112 communities (100 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2756f6be`
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
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 105 edges
2. `formatPrice()` - 40 edges
3. `formatDate()` - 38 edges
4. `CalendarEvent` - 24 edges
5. `createAdminClient()` - 22 edges
6. `CalendarResource` - 17 edges
7. `getAgencySettings()` - 16 edges
8. `createClient()` - 16 edges
9. `compilerOptions` - 16 edges
10. `DamageEntry` - 15 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `getAgencySettings()`  [INFERRED]
  app/(dashboard)/accounting/export/pdf/route.ts → lib/contracts/agency.ts
- `ClientPage()` --calls--> `formatDate()`  [INFERRED]
  app/(dashboard)/clients/[id]/page.tsx → lib/utils/index.ts
- `OperationDetailPage()` --calls--> `formatDate()`  [INFERRED]
  app/(dashboard)/partnerships/[id]/page.tsx → lib/utils/index.ts
- `NewTransactionPage()` --calls--> `expenseCategoriesByFamily()`  [INFERRED]
  app/(dashboard)/accounting/new/page.tsx → lib/accounting/categories.ts
- `TaskCard()` --calls--> `formatDate()`  [EXTRACTED]
  app/(dashboard)/calendar/tasks/page.tsx → lib/utils/index.ts

## Import Cycles
- None detected.

## Communities (112 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (16): getFeesTable(), getLegalArticles(), LegalArticlesParams, ContractPDF(), DamagedZone, fmtDate(), fmtDT(), fmtMoney() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (8): NotificationsPage(), GET(), syncAlertsToCalendar(), GET(), ResourceRow, createAdminClient(), AppAlert, fetchAllAlerts()

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (31): addAccidentToVehicle(), closeInfraction(), createAccident(), createInfraction(), lookupDriver(), markInfractionPaid(), num(), transmitInfractionToClient() (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (7): deleteClient(), PAYMENT_LABELS, DOCS, Props, ClientPage(), STATUS_LABELS, STATUS_RES

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (43): dependencies, class-variance-authority, clsx, date-fns, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, framer-motion (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (8): Badge(), BadgeProps, badgeVariants, Input, Label, labelVariants, Textarea, cn()

### Community 6 - "Community 6"
Cohesion: 0.31
Nodes (8): sendDocumentByEmail(), markRestitutionInvoiceSent(), renderContractInvoiceAttachment(), resendTo(), EmailType, logEmail(), LogEmailParams, POST()

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (24): Candidate, computeVehicleNeeds(), dateCandidate(), fmtKm(), groupNeedsForBadges(), kmCandidate(), LastByType, LastIntervention (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (15): applyDiscount(), buildBasePayload(), createClientAction(), parseDiscount(), updateClientAction(), updateClientNotes(), updateClientStatus(), uploadClientDoc() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (16): deleteDocument(), uploadDocument(), DOCUMENT_SUBCATEGORIES, DocumentCategory, isExpiringSoon(), SENSITIVE_SUBCATEGORIES, ActiveTab, Client (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.36
Nodes (13): aggregate(), buildAnalysisData(), dateLabel(), pctDelta(), previousRange(), Tx, getFamilyLabel(), periodRange() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (6): GARAGE_TYPES, overlapDays(), PANNE_TYPES, PERIODS, RENTED_STATUSES, VehicleKpiPage()

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (9): calculateExtraKm(), calculateLateFee(), FuelGaugeProps, CLEANLINESS_LEVELS, ComputedFees, Props, Step, buildDamageFlag() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (7): STATUS_CONFIG, ROLE_CONFIG, deleteTask(), STATUSES, TYPES, updateTask(), createClient()

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (60): AlertPanelProps, CalendarBottomBarProps, CalendarGrid(), CalendarGridProps, rangeFor(), SlotContext, CalendarSidebarProps, CalendarToolbar() (+52 more)

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (7): createReservation(), DIACRITICS_RE, isNameBlacklisted(), normalizeName(), postRentalRevenue(), validateContract(), logAudit()

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (19): AuditLog, Contract, ContractStatus, DamagedZone, DepositStatus, Document, DocumentCategory, Incident (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (11): deleteContract(), deleteReservation(), deleteVehicle(), resetInspection(), updateDepositStatus(), removeReservationFromCalendar(), Props, DEPOSIT_STATUSES (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (14): PhotoLightbox(), PhotoLightboxProps, compressImageToBase64(), EDL_ZONES, Zone2D, zoneBox(), DamageSeverity, graviteLabel() (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): DamageDrawerProps, SEVERITY_ACTIVE, SEVERITY_STYLES, DamageZone

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (13): prolongReservation(), updateReservationDates(), EditDatesPanel(), Props, toInputValue(), ProlongReservation(), Props, Client (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (14): closeCampaign(), createCampaign(), updateCampaignStatus(), Props, CampaignDetailPage(), TRANSITIONS, calcCAC(), calcROI() (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (12): DOCUMENT_CATEGORIES, ALL_DOC_KEYS, Props, ALL_TAB_KEYS, APP_TABS, AppTab, ALL_DOC_KEYS, COLORS (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.07
Nodes (19): bookOperationTransaction(), createAgency(), createOperation(), num(), parseExternalVehicle(), recordReturn(), startEntrantRental(), updateOperationStatus() (+11 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (14): ActionMeta, ACTIONS, auditActionLabel(), auditActionTone(), auditEntityLabel(), AuditLog, AuditTone, ENTITIES (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (11): aliases, components, utils, rsc, style, tailwind, baseColor, config (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (11): background_color, categories, description, display, icons, name, orientation, short_name (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (8): ALERT_GROUPS, AlertGroup, CAL_EVENT_COLORS, DashboardPage(), getVehicle(), TASK_STATUS_BADGE, TASK_STATUS_LABEL, TASK_TYPE_LABELS

### Community 30 - "Community 30"
Cohesion: 0.36
Nodes (6): loadFlags(), NewIssue, reportVehicleIssues(), resolveVehicleIssue(), setVehicleRepairStatus(), MaintenanceFlag

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (15): ALL, CostNature, EXPENSE_CAT_BY_ID, EXPENSE_CATEGORIES, EXPENSE_FAMILIES, expenseCategoriesByFamily(), ExpenseCategory, expenseFamily (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (6): AnimatedList(), AnimatedListItem(), SwipeableRowProps, SwipeAction, STATUS_CONFIG, STATUS_CONFIG

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): Button, ButtonProps, buttonVariants

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (7): Toast, ToastContext, ToastProvider(), ToastType, NO_PADDING_ROUTES, DashboardLayout(), PageHeaderProps

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
Cohesion: 0.20
Nodes (9): 1. OBJECTIF GLOBAL, 2. DÉCISIONS PRISES (rappel des cadrages clés), 3. TRAVAUX RÉALISÉS — LES 18 DEMANDES SONT TOUTES TRAITÉES, 4. TRAVAUX EN COURS / NON TERMINÉS, 5. FICHIERS ET RÉFÉRENCES, 6. CONTRAINTES ET PRÉFÉRENCES, 7. PROCHAINES ÉTAPES (ordre de reprise), 8. POINTS DE VIGILANCE (+1 more)

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (6): fmt(), fmtDate(), s, SinistrePDF(), SinistrePDFData, STATUS_LABELS

### Community 40 - "Community 40"
Cohesion: 0.20
Nodes (13): generateInvoiceDraft(), nextInvoiceNumber(), sendInvoice(), SupabaseServer, updateInvoiceLines(), loadLogoDataUrl(), InvoiceData, InvoiceLineItem (+5 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (3): inter, metadata, viewport

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 43 - "Community 43"
Cohesion: 0.43
Nodes (4): VehiclePage(), buildLastByType(), getVehicleStatusColor(), getVehicleStatusLabel()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (4): VehicleInspection3DProps, ZoneDef, ZoneMeshProps, ZONES

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (8): endTrip(), startTrip(), PURPOSE_LABELS, syncTripToCalendar(), DrawerProps, PURPOSES, Trip, Vehicle

### Community 46 - "Community 46"
Cohesion: 0.23
Nodes (5): createVehicle(), updateVehicle(), updateVehicleStatus(), VehicleStatus, STATUSES

### Community 47 - "Community 47"
Cohesion: 0.15
Nodes (12): createMaintenanceRecord(), expenseCategoryFor(), GARAGE_TYPES, markMaintenancePaid(), IMMOBILISES_STATUSES, OpenAccident, RecentMaintenance, STATUS_LABEL (+4 more)

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (3): COLUMNS, Task, TaskCard()

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (8): ALL_HOURS, CalEvent, computeColumns(), durPx(), EVENT_COLORS, RESA_STATUS, TASK_LABELS, toPx()

### Community 50 - "Community 50"
Cohesion: 0.14
Nodes (6): COLORS, Member, ROLES, DEFAULTS, Settings, ToggleProps

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
Cohesion: 0.22
Nodes (8): updateAgencySettings(), AGENCY_DEFAULTS, AgencySettings, getAgencySettings(), ConventionPage(), ContractPreviewPage(), SettingsPage(), formatDateTime()

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (5): Vehicle, CATEGORIES, FUEL_TYPES, TRANSMISSIONS, VehicleFormProps

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (6): conventionClauses(), ConventionPreviewClient(), formatDateTime(), formatPrice(), Props, SignatureCanvasProps

### Community 57 - "Community 57"
Cohesion: 0.36
Nodes (6): Props, ZONE_COLORS, DamagedZone, MANDATORY_PHOTOS, VEHICLE_ZONES, ZoneId

### Community 60 - "Community 60"
Cohesion: 0.19
Nodes (10): DamageComparisonProps, VIEW_BOXES, DAMAGE_TYPE_PRICES, DAMAGE_TYPES, damageTypeLabel(), defaultDamagePrice(), VEHICLE_ZONES, VehicleView (+2 more)

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (3): permissions, allow, defaultMode

### Community 70 - "Community 70"
Cohesion: 0.21
Nodes (4): Props, METHOD_LABELS, Props, createClient()

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (7): AnimatedTabsProps, Tab, AccountingReportPage(), periodRange(), PERIODS, ReservationRow, VehicleSource

### Community 77 - "Community 77"
Cohesion: 0.31
Nodes (8): POST(), buildContractPdfData(), BuiltContractData, fetchPhotoAsDataUrl(), loadEdlSchemaDataUrl(), SupabaseServer, ContractData, InspectionPDFData

### Community 80 - "Community 80"
Cohesion: 0.29
Nodes (4): ReservationStatusButtons(), PopoverContent, getReservationStatusColor(), getReservationStatusLabel()

### Community 81 - "Community 81"
Cohesion: 0.15
Nodes (5): getCategoryLabel(), AccountingPage(), PERIODS, Props, M

### Community 83 - "Community 83"
Cohesion: 0.25
Nodes (7): AccountingTransactions(), COLORS, ICONS, NotificationsList(), useToast(), Notification, formatRelative()

### Community 84 - "Community 84"
Cohesion: 0.39
Nodes (6): createDueDate(), createRecurringDueDates(), deleteDueDate(), markDuePaid(), DueDate, Vehicle

### Community 85 - "Community 85"
Cohesion: 0.18
Nodes (5): EmailLog, TYPE_CONTENT, TYPE_LABELS, TYPE_LABELS, TYPES

### Community 87 - "Community 87"
Cohesion: 0.40
Nodes (4): managerItems, navItems, SidebarProps, Profile

### Community 88 - "Community 88"
Cohesion: 0.22
Nodes (3): Props, MONTHS, VehicleSchedule

### Community 89 - "Community 89"
Cohesion: 0.21
Nodes (12): PATCH(), enrichEvents(), generateAlertsForEvent(), ReservationForSync, statusesFor(), syncReservationToCalendar(), syncWashTask(), upsertEvent() (+4 more)

### Community 90 - "Community 90"
Cohesion: 0.15
Nodes (13): addDays(), formatAmount(), formatDate(), GET(), OVERDUE_DAYS, UPCOMING_DAYS, createTask(), TYPES (+5 more)

### Community 91 - "Community 91"
Cohesion: 0.36
Nodes (6): AccountingPdf(), AccountingPdfData, fmt(), s, GET(), MONTHS

### Community 92 - "Community 92"
Cohesion: 0.38
Nodes (4): AlertCountContext, useAlertCount(), BottomNav(), TABS

### Community 93 - "Community 93"
Cohesion: 0.24
Nodes (6): logout(), adminModules, MenuPage(), modules, ROLE_LABELS, allowedHrefSet()

### Community 94 - "Community 94"
Cohesion: 0.29
Nodes (5): PAYMENT_METHODS, PAYMENT_STATUSES, PaymentMethodType, PaymentStatus, Props

### Community 95 - "Community 95"
Cohesion: 0.22
Nodes (7): updateReservationStatus(), PAYMENT_LABELS, DEPOSIT_STATUS_LABELS, ReservationPage(), STATUS_CONFIG, PaymentMethod, PaymentStatus

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (4): DepositSettlement(), fmt(), Props, SEIZURE

### Community 97 - "Community 97"
Cohesion: 0.16
Nodes (14): Tx, assertPeriodOpen(), SB, closeAnnualAccounting(), closeDailyAccounting(), closeMonthlyAccounting(), createTransaction(), reopen() (+6 more)

### Community 101 - "Community 101"
Cohesion: 0.18
Nodes (8): BODY_OUTLINE, LABEL, LAYOUT, Props, VIEW_VB, VIEWS, ZONE_COORDS, ZoneCoord

### Community 104 - "Community 104"
Cohesion: 0.53
Nodes (4): DELETE(), PATCH(), POST(), requireManager()

### Community 107 - "Community 107"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 108 - "Community 108"
Cohesion: 0.17
Nodes (7): expenseNature(), paymentMethodLabel(), MONTHS, MonthlyClosingPage(), MONTHS, BackButtonProps, formatPrice()

### Community 112 - "Community 112"
Cohesion: 0.40
Nodes (4): MemberProfilePage(), ROLE_CONFIG, STATUS_BADGE, STATUS_LABEL

### Community 113 - "Community 113"
Cohesion: 0.31
Nodes (5): DEPARTURE_DEMO, RETURN_DEMO, DamageEntry, VehicleInspectionMapProps, PreviousZone

### Community 114 - "Community 114"
Cohesion: 0.48
Nodes (4): IaDepartureInspectionPage(), DepartureInspectionPage(), generateContractNumber(), recomputeVehicleStatus()

## Knowledge Gaps
- **428 isolated node(s):** `version`, `configurations`, `PreToolUse`, `defaultMode`, `allow` (+423 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 14` to `Community 1`, `Community 2`, `Community 3`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 16`, `Community 18`, `Community 23`, `Community 25`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 34`, `Community 39`, `Community 40`, `Community 43`, `Community 45`, `Community 46`, `Community 47`, `Community 53`, `Community 54`, `Community 77`, `Community 81`, `Community 84`, `Community 85`, `Community 88`, `Community 89`, `Community 90`, `Community 91`, `Community 93`, `Community 95`, `Community 97`, `Community 99`, `Community 104`, `Community 108`, `Community 112`, `Community 114`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Community 70` to `Community 96`, `Community 2`, `Community 76`, `Community 13`, `Community 15`, `Community 48`, `Community 49`, `Community 83`, `Community 25`, `Community 94`, `Community 31`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `formatDate()` connect `Community 2` to `Community 97`, `Community 3`, `Community 7`, `Community 9`, `Community 43`, `Community 108`, `Community 76`, `Community 47`, `Community 48`, `Community 80`, `Community 18`, `Community 84`, `Community 85`, `Community 23`, `Community 88`, `Community 25`, `Community 93`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `formatDate()` (e.g. with `CampaignDetailPage()` and `ClientPage()`) actually correct?**
  _`formatDate()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `version`, `configurations`, `PreToolUse` to the rest of the system?**
  _428 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1452991452991453 - nodes in this community are weakly interconnected._