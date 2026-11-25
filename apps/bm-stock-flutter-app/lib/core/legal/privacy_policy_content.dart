/// In-app mirror of the BM Stock privacy policy served at
/// /api/v1/legal/privacy-policy. Keep in sync with
/// apps/Inventory-backend/src/modules/legal/legal-content.ts.

class PolicySection {
  final String title;
  final List<String> blocks;
  const PolicySection({required this.title, required this.blocks});
}

const kPrivacyPolicyVersion = '2026-08-22';

const kPrivacyPolicySections = <PolicySection>[
  PolicySection(
    title: 'About this policy',
    blocks: [
      'BM Stock is a business-to-business inventory management service. Business owners register an account to manage their own companies, warehouses, shops, staff, products, sales and customer records.',
      'This policy explains what personal data we collect, why, how we protect it, how long we keep it, and the choices you have.',
    ],
  ),
  PolicySection(
    title: 'Account & identity data',
    blocks: [
      'Owner/manager full name, business name, business sector, business address.',
      'Phone number (your login identifier) and a password (stored only as a bcrypt hash).',
    ],
  ),
  PolicySection(
    title: 'National ID & tax identifiers (Fayda ID / TIN)',
    blocks: [
      'What: Ethiopian Fayda Digital ID number (FIN) and Tax Identification Number (TIN). Both are optional at registration.',
      'Why: to verify the identity of business registrants, prevent fraudulent accounts, and meet Ethiopian tax/KYC expectations that apply when a business registers on a commercial platform.',
      'Protection: stored encrypted with AES-256 authenticated encryption, transmitted over TLS, visible only to authorised BM Stock compliance staff via an admin console — never shared with other users or third parties, never used for marketing.',
    ],
  ),
  PolicySection(
    title: 'Subscription payment data',
    blocks: [
      'Plan selection and amount, payment method name (e.g. Telebirr, CBE, bank transfer), transaction reference number, and optionally a screenshot of your payment confirmation.',
      'Payment proofs are stored privately and visible only to authorised staff who verify payments. We never receive or store your bank card numbers, Telebirr PINs, or bank credentials.',
    ],
  ),
  PolicySection(
    title: 'Business operational data',
    blocks: [
      'To provide the service we store the records you and your staff create: products and stock levels, customers and suppliers, sales and purchase records, customer credit balances and repayment history, staff commissions, expenses and reports.',
      'This data belongs to your business; we process it only to run the service. The customer credit ledger is a record-keeping tool for your own sales on credit — we do not run credit checks or consumer lending, and we do not assess anyone\'s creditworthiness.',
    ],
  ),
  PolicySection(
    title: 'Technical data',
    blocks: [
      'Firebase Cloud Messaging device tokens for push notifications you enable, and server logs (requests, timestamps) kept for security and troubleshooting.',
    ],
  ),
  PolicySection(
    title: 'What we do NOT do',
    blocks: [
      'We do not sell or rent personal data.',
      'We show no advertising and include no ad networks or third-party analytics/tracking SDKs.',
    ],
  ),
  PolicySection(
    title: 'Who receives data',
    blocks: [
      'SMS provider (GeezSMS): phone numbers are sent to deliver OTP verification codes and service notifications.',
      'Google Firebase Cloud Messaging: anonymised device tokens, to deliver push notifications you opt into.',
      'Authorised BM Stock staff: strictly for payment verification, identity verification, and support, under confidentiality obligations.',
      'Legal authorities: where compelled by valid legal process.',
    ],
  ),
  PolicySection(
    title: 'Security',
    blocks: [
      'TLS encryption for all data in transit; passwords hashed with bcrypt.',
      'National ID (Fayda) and tax (TIN) numbers encrypted at rest with AES-256-GCM.',
      'Role-based access control inside the app (owner/admin/staff permissions) and restricted admin-console access on our side.',
    ],
  ),
  PolicySection(
    title: 'Retention',
    blocks: [
      'Account and business data: kept while your subscription is active.',
      'Fayda ID / TIN: kept only as long as needed to verify your registration and satisfy tax-record obligations, then deleted on request once verification is complete.',
      'If you delete your account (Settings → Delete Account), personal data including Fayda ID/TIN and payment proofs is deleted within 30 days; residual backups purge automatically within 90 days.',
    ],
  ),
  PolicySection(
    title: 'Your rights',
    blocks: [
      'You may access and correct your profile details in Settings, delete individual records inside your business account, request export or deletion of your data, and withdraw optional identifiers by asking us to erase them. Contact us below; we respond within 30 days.',
    ],
  ),
  PolicySection(
    title: 'Children',
    blocks: ['BM Stock is a tool for businesses and is not directed to anyone under 18. We do not knowingly collect data from children.'],
  ),
  PolicySection(
    title: 'Changes & contact',
    blocks: [
      'If we change how we handle personal data we will update this policy in the app and on our website before material changes take effect.',
      'Contact: +251 911 111 111 · t.me/bmstock',
    ],
  ),
];
