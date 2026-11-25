# Store Privacy & Finance-Review Compliance Kit — BM Stock

This file is the operating checklist for App Store / Google Play submissions. It documents
what the app actually collects, exactly what to declare in Apple's App Privacy
("nutrition label") and Google Play's Data Safety form, the public privacy-policy URL,
and what to have ready if reviewers ask for business verification because of the
credit/commission features.

---

## 1. What was implemented in code (already done)

| Concern | Fix |
|---|---|
| No accessible privacy policy | Policy served publicly as HTML at `GET /api/v1/legal/privacy-policy` (backend `src/modules/legal/`) and mirrored in-app (`lib/core/legal/privacy_policy_content.dart` + `PrivacyPolicyScreen`) |
| Fayda ID / TIN collected with no disclosure | Registration screen shows a "why we ask" notice next to the fields, plus a required consent checkbox ("I have read and agree…") that gates account creation |
| Sensitive IDs stored in plain text | `faydaId` / `tin` columns now encrypted at rest with AES-256-GCM (`src/common/crypto/encrypted-value.transformer.ts`, key = `DATA_ENCRYPTION_KEY`). Legacy plaintext rows are readable and re-encrypted on next write |
| Retention / deletion unclear | Policy states 30-day deletion after account deletion (in-app: Settings → Delete Account), 90-day backup purge; Fayda/TIN deletable on request once verification completes |

**Use this URL everywhere a store form asks for a privacy policy:**
`https://<your-api-domain>/api/v1/legal/privacy-policy`

> Whenever data practices change, update BOTH copies of the policy
> (`legal-content.ts` backend + `privacy_policy_content.dart` Flutter) and bump the version string.

---

## 2. Actual data collected (source of truth for both forms)

Collected **before login** (registration) and during use:

- **Identity/contact:** owner full name, business name, sector, address, phone number (login ID), derived service email, password (bcrypt hash only)
- **Government identifiers (optional):** Ethiopian Fayda Digital ID (FIN, 12 digits), Tax Identification Number (TIN, 10 digits) — encrypted at rest
- **Financial:** plan selection, amount, payment-method name (Telebirr/CBE/bank), transaction reference number, optional payment-confirmation screenshot upload. **Never:** card numbers, PINs, bank credentials
- **Business records (user-created, stored on behalf of the business):** products, stock, customers/suppliers (names+phones), sales/purchases, customer credit balances & repayments, staff commissions, expenses
- **Technical:** Firebase Cloud Messaging device token (push notifications, opt-in), server request logs

Not collected: location, contacts, browsing/search history, biometrics, health data, advertising IDs.
No ads, no analytics/tracking SDKs, no data sales.

## 3. Apple App Privacy label answers

Answer **Yes — we collect data** for these types (all "linked to identity", used for
*App Functionality*, *Analytics*→none, *Developer Advertising*→none):

| Apple category | Data types | Notes |
|---|---|---|
| Contact Info | Name, Phone Number, Email Address, Physical Address | registration + profile |
| Identifiers | User ID | phone-based account identifier |
| Financial Info | Purchase History | subscription plan, amount, payment reference; payment-proof screenshot also fits here |
| Other Data Types | Other User Content | payment screenshots; business records created by the user |
| Diagnostics | Crash data / Performance (only if Crashlytics etc. ever added) | currently **do not declare** — no diagnostics SDK present |

Sensitive Info: **do not tick** (Apple's list covers biometrics/health etc., not national-ID numbers);
national IDs are covered by "Other User Content"/Contact Info declarations above.

Also ship an App Store **Privacy Manifest** (`PrivacyInfo.xcprivacy`) declaring required-reason APIs if Xcode warns about them (e.g. `UserDefaults`, file timestamps).

## 4. Google Play Data Safety form answers

- Does your app collect or share any required user data? → **Yes**
- Encrypted in transit? → **Yes**
- Deletion mechanism? → **Yes** (Settings → Delete Account)

Declare as **collected**, not shared:

| Play category | Data type | Purpose |
|---|---|---|
| Personal info | Name | Account management |
| Personal info | Email address | Account management |
| Personal info | Phone number | Account management, app functionality (login/OTP via SMS provider) |
| Personal info | IDs (Fayda FIN, TIN) | Fraud prevention, legal compliance, account management |
| Financial info | Other user financial info | Payment verification (plan/reference/payment proof) |
| Photos and videos | Photos (optional payment screenshot) | App functionality (payment verification) |
| Device or other IDs | Device or other IDs (FCM token) | Messaging (push notifications, opt-in) |

Sharing: **No** — GeezSMS and FCM act as processors on our behalf, not independent controllers.
Optional user actions like uploading a receipt are still "collection" — keep them declared.

## 5. Finance-adjacent scrutiny (credit balances, commissions)

The app's credit ledger, repayments and staff commissions are **bookkeeping tools inside B2B
inventory software** — we are not a lender, do not issue credit, charge interest, or assess
creditworthiness. Say this proactively:

**Review-notes template (paste into App Review information / Play Console notes):**

> BM Stock is a business inventory management tool for registered businesses (B2B SaaS).
> The "customer credit" feature is a simple receivables ledger for a merchant's own
> sales-on-credit bookkeeping; it does not provide loans, credit, interest, or financing of
> any kind. Staff commission fields are internal payroll record-keeping. Demo account:
> Phone +251911000001, password `ChangeMe-Reviewer-2026!` (if an SMS code is requested,
> enter 123456). Privacy policy: https://<your-api-domain>/api/v1/legal/privacy-policy

**Keep these ready to submit quickly if requested (business verification):**

- [ ] Ethiopian commercial registration / business licence for the operating company (Gelagle)
- [ ] TIN certificate for the operating company
- [ ] Owner/director government ID matching the developer-account holder
- [ ] Proof of domain ownership for the API/website domain used in the privacy-policy URL
- [ ] (Apple org accounts) D-U-N-S number consistency with legal entity name
- [ ] One-page explanation of revenue model: subscription fees (ETB plans), not financial services

## 6. Pre-submission checklist

- [ ] Privacy-policy URL live and reachable **without login** (test in incognito)
- [ ] In-app policy screen reachable from registration AND Settings
- [ ] Consent checkbox blocks submission when unchecked (test it)
- [ ] Nutrition label / Data Safety match section 2 above exactly
- [ ] `DATA_ENCRYPTION_KEY` set in production secrets — same value across restarts, backed up securely (rows become unreadable without it)
- [ ] Delete Account flow tested end-to-end
