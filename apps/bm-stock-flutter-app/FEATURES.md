# BM Stock — Feature Guide

BM Stock (package `com.gelaglestock.gelaglestock`) is a Flutter inventory, sales, and
credit-management app for Ethiopian small businesses. It supports **multi-company**
ownership, **warehouse → shop** distribution, staff accounts with fine-grained
permissions, credit sales with repayment tracking, commissions, reporting/exports,
and subscription billing (Telebirr / CBE manual payments).

- **Platforms:** Android/iOS (also builds for web — conditional imports exist)
- **Languages:** English, Amharic (`am`), Afaan Oromo (`om`)
- **UI:** Material 3, Outfit font, brand blue `#025EA7`, ETB currency, `+251` phone format
- **Backend:** REST API under `/api/v1` (Bearer-token auth) + Firebase Cloud Messaging

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [App Bootstrap & Navigation](#app-bootstrap--navigation)
3. [Authentication & Account](#authentication--account)
4. [Home Dashboard](#home-dashboard)
5. [Company Switching (Multi-Company)](#company-switching-multi-company)
6. [Products](#products)
7. [Stock Management](#stock-management)
8. [Barcode Scanning](#barcode-scanning)
9. [Warehouses ("Store" Tab)](#warehouses-store-tab)
10. [Shops ("Shop" Tab)](#shops-shop-tab)
11. [Branches & Stock Transfers](#branches--stock-transfers)
12. [Sales & Invoicing](#sales--invoicing)
13. [Credit Management](#credit-management)
14. [Customers](#customers)
15. [Suppliers](#suppliers)
16. [Product Borrowing](#product-borrowing)
17. [Staff Management & Permissions](#staff-management--permissions)
18. [Commissions](#commissions)
19. [Reports & Exports](#reports--exports)
20. [Bank Accounts](#bank-accounts)
21. [Notifications (FCM + In-App)](#notifications-fcm--in-app)
22. [Subscription & Billing](#subscription--billing)
23. [Settings](#settings)
24. [Cross-Cutting Utilities](#cross-cutting-utilities)

---

## Architecture Overview

| Layer | Tech | Notes |
|---|---|---|
| State (domain) | `flutter_bloc` | BLoCs for auth, company, branch, product, warehouse, sale, transfer, borrowing, supplier, customer, notification, commission |
| State (UI-scoped) | `provider` (`ChangeNotifier`) | Dashboard, branch cache, staff, sale, product, report, bank accounts, locale |
| Networking | `core/api/api_client.dart` | REST wrapper, `/api/v1` base URL, `Authorization: Bearer` header, token persisted in `SharedPreferences`, auto sign-out on `401`, account-block detection, multipart uploads |
| Services | `core/services/*` | One service per domain (sale, product, inventory, transfer, warehouse, shop, customer, supplier, employee, borrowing, bank account, report export, FCM, notifications, bulk draft store, CSV templates) |
| Push | Firebase Messaging | Background handler registered in `main()`, token sync on login/logout |
| Localization | `core/localization` | Custom `AppLocalizations` delegate + `LocaleProvider`; every screen uses `context.tr('key')` |

### Permission model

`core/permissions/app_permissions.dart` defines module keys checked everywhere:

- **Stock group:** `stockIn`, `stockOut`
- **Location group:** `warehouse`, `shopStore`, `branch`
- **Sales group:** `viewSales`, `createSale`, `editSale`, `viewCredit`, `receiveCreditPayment`
- **Product group:** `viewProducts`, `addProduct`, `editProduct`, `deleteProduct`
- **Admin group:** `staffManagement`, `commission`, `reports`, `settings`, `branchTransfers`, `companies`, `bankAccounts`

Each module grants **view** and/or **edit** access (`canViewModule` / `canEditModule`).
Staff are additionally scoped to a single branch (`shop:` or `warehouse:` assignment,
enforced by `BranchAccessHelper`) and to a company (all data reloads when the active
company changes via `CompanyScopeListener`).

---

## App Bootstrap & Navigation

### Splash Screen (`/`)
- Animated logo fade-in while auth state resolves (`CheckAuthEvent`).
- Routing decision: first launch → **Onboarding**; valid session → **Home**;
  otherwise → **Login**. Blocked accounts land on Login with a blocking-reason dialog.

### Onboarding (`/onboarding`)
- Three illustrated slides with dot indicators and Next / Get Started.
- Completion flag (`hasSeenOnboarding`) persisted so it never shows again.

### Main Shell (`/home`)
Persistent bottom navigation with permission-gated tabs:

| Tab | Screen | Gate |
|---|---|---|
| Home | Dashboard | everyone |
| Store | Warehouse list | warehouse/stock access |
| Shop | Shop list | shop-store access |
| Credit | Outstanding credit | credit view/manage |
| More | Feature grid | everyone |

Tabs are kept alive with an `IndexedStack`; sub-screens can jump back to a specific
tab via `MainShell.goTo()`.

---

## Authentication & Account

### Login (`/auth`)
- **Two-step flow:** phone number first, then credential.
- Ethiopian phone validation/normalization (`+251…`) via `PhoneUtil`.
- Backend lookup (`/auth/staff-auth-method`) decides whether the account uses a
  **password** (owners/admins) or a **4-digit PIN** (staff) and adapts the form.
- **Subscription-expiry handling:** if the account's plan lapsed, an explanatory
  dialog appears with a **Renew Subscription** shortcut before login proceeds.
- Blocked accounts get a dedicated dialog explaining the reason.
- Language selector available pre-login; "Contact us" support dialog (phone/Telegram).

### Registration (`/register`)
Collects: company name, owner full name, **Fayda ID**, **TIN number**, address,
business sector (Retail, Wholesale & Distribution, Supermarket/Grocery,
Pharmacy/Healthcare, Services & Hospitality, Electronics/Hardware, Other),
phone, password + confirmation, and how many companies the owner needs.
- Checks phone uniqueness (`/auth/check-phone`) before sending an SMS **OTP**.

### OTP Verification (`/verify`)
- Six-digit code entry with auto-focus advance and countdown-gated **resend**.
- On success continues into plan selection/payment.

### Forgot Password
Three steps: enter phone → verify 6-digit OTP (`/auth/send-otp`,
`/auth/verify-otp`) → set new password (`/auth/reset-password`).

---

## Home Dashboard

- Personalized greeting and top bar with **Settings**, **Notifications bell**
  (live unread badge), and the **Company Switcher**.
- **Stats card** (per selected company):
  - Today's sales total + invoice count
  - Outstanding credit (customers with balance)
  - Stock reminder (low-stock item count / "Good")
  - Items expiring soon
- **Quick actions:** New Sale, Staff, Branch, Reports.
- **Recent activity feed:** completed sales (customer, amount, salesperson, store),
  stock in/out events (quantity, reason, performer), newly added products, and
  warehouse→shop transfers. Tapping an entry opens its detail screen
  (sale detail or stock-transaction detail). "View all" jumps to Sales History.
- Pull-to-refresh reloads stats scoped to the active company.

## Company Switching (Multi-Company)

- Bottom-sheet switcher listing the user's companies with search.
- Inline **Add company** form (name required).
- Switching emits through `CompanyBloc`/`CompanyScopeListener`, which reloads
  dashboard, lists, and reports for the newly selected company.

---

## Products

### Product List (`/products`)
- Search across **name, SKU, category**.
- Category dropdown filter plus quick filters for **Low stock** and **Expired**
  (also accepts a `filter` route argument, e.g. from dashboard reminders).
- App-bar actions: **Excel import** and **Add product**.

### Add / Edit Product (`/add_product`, `ProductEntryScreen`)
Fields: category, product name (required), SKU, barcode, description,
purchase price, selling price (thousand-separator input), **commission rate %**,
opening stock quantity, expiry date picker, supplier, and stocking warehouse.
- Banner shortcut to the **Excel import** dialog (with autofill of parsed rows).

### Product Detail
Price summary (selling vs purchase), SKU, barcode, expiry date, and stock info.

### Bulk Product Entry (`BulkProductsScreen`)
Spreadsheet-style grid for adding many products at once — rows for name, SKU,
barcode, purchase price, selling price, stock quantity — with add-row /
duplicate-row helpers and **CSV template export**.

### Excel / CSV Import (`ImportProductsScreen`, `ExcelImportDialog`)
- File picker accepting `.xlsx`, `.xls`, `.csv`.
- Parses sheets/CSV locally (excel + csv packages), maps columns against the
  documented template headers, and creates products in bulk.
- Downloadable/shareable **template** (`CsvTemplateBuilder`).

> Products have a **type**: physical goods track stock; **services** skip all
> stock validation (relevant in sales and the shop catalog).

---

## Stock Management

### Stock In (`/stock_in`)
Pick a product (shows current stock), set quantity with a stepper, choose a reason:
**Restocking, Return, Damaged Return, Correction, Other**. Optionally scoped to a
specific warehouse via route arguments.

### Stock Out (`/stock_out`)
Same UX with reasons **Damaged, Expired, Loss/Theft, Sold, Other**; quantity is
validated against available stock.

### Stock Overview (`/stock_overview`)
Tabbed overview of all products with quantity vs minimum level, plus **CSV export**
of the visible list (name, SKU, quantity, min level, price).

### Transaction Detail
Every movement records **previous quantity → new quantity**, the reason, and who
performed it — surfaced from the dashboard activity feed and warehouse history.

---

## Barcode Scanning (`/scan_item`)

- Live camera scanning (`mobile_scanner`) with alignment frame, or manual barcode
  typing as fallback.
- Looks the product up locally first, then via backend barcode search.
- Result card shows price, stock, min level, and **low-stock / expired** badges.
- Actions: **View details** or **Add to sale** (jumps straight into New Sale with
  the product pre-loaded).

---

## Warehouses ("Store" Tab)

### Warehouse List (`/warehouses`)
Searchable cards; **Add warehouse** dialog (name/address).

### Warehouse Dashboard (`/warehouse_dashboard`)
Per-warehouse control center:
- Mini stats: product count, total quantity, total sales, low-stock warnings.
- Search + filter chips: **All / In stock / Low stock / Out of stock / Expired /
  Expiring soon**, plus category and sort dropdowns (name A–Z, quantity ↑, price ↑)
  and clear-filters.
- Quick actions: **Stock In**, **Stock Out**, **Stock History**; FAB to add a
  product directly into this warehouse.

### Warehouse Product Detail
Full product info with one-tap **Stock In / Stock Out** and per-product movement
history (`WarehouseStockHistoryScreen`).

---

## Shops ("Shop" Tab)

- **Shop List** (`/shop_list`): searchable cards + Add-shop dialog.
- **Shop Store** (`/shop`): retail catalog for a shop including **service**
  products; stock badges (Service / Out of stock / Low stock); add-product entry.
- **Shop Dashboard** (`/shop_dashboard`) and **Shop Product Detail**
  (`/shop_product_detail`) mirror the warehouse experience for retail locations.

---

## Branches & Stock Transfers

### Branch Management (`/branch`)
Central administration of all branches; each branch is typed **Shop** or
**Warehouse**, with manager names shown/assigned.

### Create Transfer (`/create_transfer`)
Moves stock **from a warehouse to a shop**: destination branch dropdown, product
picker loaded from the source warehouse (`/warehouses/{id}/with-products`) showing
available quantity, quantity input, and optional note.

### Transfer Request (`/transfer_request`)
Two tabs — **Create Transfer** and **Pending** — supporting both directions
(**Warehouse → Shop** and **Shop → Warehouse**) as requests awaiting approval.

### Transfer History & Detail
History with direction icons and statuses; the detail screen lets authorized users
**Approve** or **Reject** a pending transfer.

---

## Sales & Invoicing

### New Sale (`/new_sale`) — the core workflow
- **Cart** with inline quantity steppers; add items by browsing or by **barcode
  scan** (camera scanner or backend barcode lookup).
- **Customer:** walk-in by default, pick an existing customer, or create one inline
  (name/phone/address) without leaving the flow.
- **Location:** sell from any warehouse or shop the user can access.
- **Payment types:** Cash, Bank transfer, Mobile money, Credit.
- **Discounts:** none, percentage (%), or fixed ETB amount.
- **Credit terms** (when paying on credit): advance payment, amount received with
  **quick-cash chips** (+50/+100/+500/+1000 ETB) and automatic change calculation,
  due date, and a **payment reminder** lead time (on due date, 1/3/7/10/14 days before).
- **Receipt proof:** attach a transaction screenshot (camera/gallery) uploaded with
  the sale.
- Auto metadata: invoice number `INV-YYYYMMDD-####`, timestamped sale date,
  salesperson and branch captured from the session.
- Services and non-stock-tracked products bypass stock availability checks.

### Sales History (`/sales`)
Filter chips: **All / Paid / Pending / Partially paid / Cancelled**; credit sales
are highlighted; tap through to details.

### Sale Detail
Line items, totals, payment method, originating warehouse/shop, customer info, and
a color-coded credit status badge (**Paid / Partially paid / Unpaid**).

### Credit Sales (`/credit_sales`)
Focused queue of pending credit sales with quick amount buttons for collecting
payments and recording the method used.

---

## Credit Management

### Outstanding Credit (bottom-nav tab)
Aggregated list of customers who owe money with their balances; drill into a
per-customer credit detail showing each credit invoice and a status breakdown.

### Record Payment (`/record_payment`)
Collect repayments against a sale: amount (with quick-amount buttons), payment
method chips, and notes; updates the sale's paid/partially-paid/unpaid status.

---

## Customers

- **Customer List** (`/customers`): searchable cards with contact details.
- **Add Customer** (`AddCustomerScreen`): name, phone (Ethiopian format), address.
- **Customer Detail:** tabbed history — **Purchases**, **Credit**, **Payments** —
  plus quick contact actions.

## Suppliers

- **Supplier List** (`/suppliers`) and **Add Supplier** form; suppliers link to
  products for procurement tracking.

---

## Product Borrowing

Track items lent out (e.g., to reps or partners):

- **Add Borrowing:** product, quantity, date taken, expected return date
  (validated not to precede the taken date), and source warehouse/shop.
- **Borrowing List** (`/borrowings`): table with status filters
  **Active / Partially returned / Fully returned** and quantities returned.
- **Borrowing Detail:** record returns incrementally (validated against quantity
  taken); status recalculates automatically.

---

## Staff Management & Permissions

### Staff Management (`/staff`)
- Add/edit employees: name, phone, **job title** (Staff / Manager / Admin),
  assigned branch (a specific shop or warehouse; some roles may be unassigned).
- The app generates login credentials — a **password and a 4-digit PIN** — shown
  once to the admin for handing to the employee.
- Invite flow and role badges (Manager/Admin highlighted); employees can be edited
  or removed.

### Staff Access (`/staff-access`)
Roster view summarizing each member's enabled permissions with counts per group
(stock / location / sales / products). Gated behind `staffManagement` **edit**.

### Permissions Editor (`PermissionsScreen`)
Matrix of all modules grouped into Stock / Location / Sales / Products / Admin with
**View / Edit / None** per module, plus per-branch permission assignments.
Legacy permission keys (e.g., combined `stockInOut`) are mapped onto the newer
split keys for backward compatibility.

---

## Commissions

### Commission Config (`CommissionConfigScreen`)
Two tabs — **Products** and **Staff**:
- Set a commission **rate %** per product and a **base rate %** per employee.
- Only changed rows are submitted; a **Save (n)** button batches updates with
  0–100 % validation.

### Commission Dashboard (`/commission`)
Period selector, product filter chips, and summary cards; toggle between
**Sale Entries** (each commissionable line with its rate) and **Staff Earnings**;
includes a rules panel (default 5 %, manager 8 %) and a printable report panel.

---

## Reports & Exports

### Reports Hub (`/reports`)
- KPI cards (total quantity sold / available) and a **period selector**.
- Filters: customer, seller (salesperson), warehouse, shop, and product pickers.
- Sections: **Top products** (units sold), **Top customers** (invoice counts),
  **Sales by location** (warehouse vs shop), **Sales by seller**, detailed sales
  list, warehouse/shop activity, and a **credit summary** with outstanding credit
  sales.
- Dedicated **low-stock** view with one-tap CSV download.

### Exports
Bottom-sheet export of the current report as **PDF**, **Excel (.xlsx)**, or
**CSV** (`ReportExportService`), delivered through the system share sheet.
A separate **Customer Report** screen exports per-customer purchase and payment
tables.

---

## Bank Accounts

`/bank_accounts` manages the business bank/mobile-money accounts used to receive
payments, alongside a today's-sales summary for reconciliation context.

---

## Notifications (FCM + In-App)

- **Push:** `FcmService` syncs device tokens on login/register and removes them on
  logout; a background handler processes messages while the app is closed.
- **In-app listener** refreshes lists/badges live; the home bell shows an unread
  count.
- **Notifications screen** (`/notifications`): typed entries — new sale, credit,
  low stock, payment, transfer, commission, borrowing — each with a colored icon,
  plus **Mark all read**.

---

## Subscription & Billing

BM Stock is subscription-based:

- **Choose Plan** (`/choose_plan`): plans come from the backend with offline
  fallbacks — **1 Month 399 ETB**, **6 Months 2,999 ETB**, **1 Year 7,999 ETB** —
  each advertising unlimited companies/staff/warehouses/products, analytics, a
  dedicated account manager, and 24/7 support. Pricing scales with the number of
  companies being licensed; used for initial signup, **renewal**, and **upgrade**.
- **Manual Payment Popup:** pay via **Telebirr** (account: Possible Tech PLC,
  0911 578 793) or **CBE** bank transfer, then **upload the payment screenshot**
  for verification; the chosen method is recorded with the subscription request.
- **Request More Companies** (`/request_more_companies`): ask for additional
  company slots on the current plan.
- Lapsed subscriptions block login until renewed (see Login).

---

## Settings

- **Subscription card:** selected plan, status, amount (ETB), start date, payment
  date, next payment date, expiry.
- **Company profile** editor.
- **Push notifications** toggle (synced to the user profile).
- **Language** selector (English / Amharic / Afaan Oromo), applied app-wide.
- **Logout** (confirmation dialog) and **Delete account** with a permanent-deletion
  warning covering all business data and staff assignments.

---

## Cross-Cutting Utilities

| Utility | Purpose |
|---|---|
| `AppToast` | Unified floating snackbars (success/error/info) |
| `RefreshableScroll` | Consistent pull-to-refresh physics everywhere |
| `AccountBlockedDialog` | Explains blocked-account reasons (e.g., expired subscription) with recovery paths |
| `MoneyInput` / `ThousandsInputFormatter` | Thousand-separator numeric entry for prices |
| `PhoneUtil` + `EthiopianPhoneField` | `+251` normalization and validation |
| `BarcodeScanScreen` | Reusable camera scanner embedded in sales and stock flows |
| `file_download*` | Platform-split download/share implementation (mobile/web/stub) |
| `BulkDraftStore` | Persists in-progress bulk import drafts between sessions |
