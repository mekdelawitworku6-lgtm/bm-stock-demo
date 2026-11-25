export type ReceiptBankId =
  | 'cbe'
  | 'telebirr'
  | 'dashen'
  | 'boa'
  | 'cbebirr'
  | 'awash'
  | 'mpesa'
  | 'siinqee'
  | 'kaafiebirr'
  | 'coopayebirr'
  | 'zemen';

export type ReceiptSecondaryField = 'suffix' | 'phoneNumber';

export interface ReceiptBankField {
  key: ReceiptSecondaryField;
  label: string;
  placeholder: string;
  required: boolean;
  numeric?: boolean;
  maxLength?: number;
}

export interface ReceiptBankInfo {
  id: ReceiptBankId;
  name: string;
  shortName: string;
  color: string;
  primaryLabel: string;
  primaryPlaceholder: string;
  fields: ReceiptBankField[];
  note?: string;
}

export const SUPPORTED_BANKS: ReceiptBankInfo[] = [
  {
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    shortName: 'CBE',
    color: '#025EA7',
    primaryLabel: 'CBE Receipt ID or Link',
    primaryPlaceholder: 'e.g. fHCxyV4mg... or https://mbreciept.cbe.com.et/...',
    fields: [
      {
        key: 'suffix',
        label: 'Legacy FT Account Suffix (8 digits)',
        placeholder: 'e.g. 60536171',
        required: false,
        numeric: true,
        maxLength: 8,
      },
    ],
  },
  {
    id: 'telebirr',
    name: 'Telebirr',
    shortName: 'Telebirr',
    color: '#7C3AED',
    primaryLabel: 'Telebirr Transaction Number',
    primaryPlaceholder: 'e.g. DET8FJGUJ4',
    fields: [],
  },
  {
    id: 'dashen',
    name: 'Dashen Bank',
    shortName: 'Dashen',
    color: '#0F766E',
    primaryLabel: 'Dashen Reference Number',
    primaryPlaceholder: 'e.g. 1234567890123456',
    fields: [],
  },
  {
    id: 'boa',
    name: 'Bank of Abyssinia',
    shortName: 'BOA',
    color: '#B91C1C',
    primaryLabel: 'Bank of Abyssinia Reference Number',
    primaryPlaceholder: 'e.g. FT2614977L8S',
    fields: [
      {
        key: 'suffix',
        label: 'Account Suffix (5 digits)',
        placeholder: 'e.g. 12345',
        required: true,
        numeric: true,
        maxLength: 5,
      },
    ],
  },
  {
    id: 'cbebirr',
    name: 'CBE Birr',
    shortName: 'CBE Birr',
    color: '#7C2D12',
    primaryLabel: 'CBE Birr Receipt Number',
    primaryPlaceholder: 'e.g. ABC123DE45',
    fields: [
      {
        key: 'phoneNumber',
        label: 'Phone Number (251XXXXXXXXX)',
        placeholder: 'e.g. 251911223344',
        required: true,
        numeric: true,
      },
    ],
  },
  {
    id: 'awash',
    name: 'Awash Bank',
    shortName: 'Awash',
    color: '#CA8A04',
    primaryLabel: 'Awash Receipt URL or Token',
    primaryPlaceholder: 'Paste the Awash receipt URL or token',
    fields: [],
  },
  {
    id: 'mpesa',
    name: 'M-Pesa',
    shortName: 'M-Pesa',
    color: '#15803D',
    primaryLabel: 'M-Pesa Transaction Number',
    primaryPlaceholder: 'e.g. QK12ABC34D',
    fields: [],
  },
  {
    id: 'siinqee',
    name: 'Siinqee Bank',
    shortName: 'Siinqee',
    color: '#9D174D',
    primaryLabel: 'Siinqee Receipt URL or Token',
    primaryPlaceholder: 'Paste the Siinqee receipt URL or token',
    fields: [],
  },
  {
    id: 'kaafiebirr',
    name: 'Kaafi Ebirr',
    shortName: 'Kaafi Ebirr',
    color: '#4338CA',
    primaryLabel: 'Kaafi Ebirr Receipt URL or Token',
    primaryPlaceholder: 'Paste the Kaafi Ebirr receipt URL or token',
    fields: [
      {
        key: 'phoneNumber',
        label: 'Phone Number (optional)',
        placeholder: 'e.g. 251911223344',
        required: false,
        numeric: true,
      },
    ],
  },
  {
    id: 'coopayebirr',
    name: 'Coopay Ebirr',
    shortName: 'Coopay Ebirr',
    color: '#C2410C',
    primaryLabel: 'Coopay Ebirr Receipt Link or Token',
    primaryPlaceholder: 'e.g. https://receipt.ebirr.com/coopay/... or token',
    fields: [
      {
        key: 'phoneNumber',
        label: 'Phone Number (optional)',
        placeholder: 'e.g. 251911223344',
        required: false,
        numeric: true,
      },
    ],
  },
  {
    id: 'zemen',
    name: 'Zemen Bank',
    shortName: 'Zemen',
    color: '#1D4ED8',
    primaryLabel: 'Zemen Receipt URL or Token',
    primaryPlaceholder: 'Paste the Zemen receipt URL or token',
    fields: [],
    note: 'Zemen does not accept direct API verification; we submit the receipt for smart routing and surface the provider status.',
  },
];

export function getBankInfo(id?: string | null): ReceiptBankInfo {
  const normalized = String(id || 'cbe').toLowerCase().trim();
  return SUPPORTED_BANKS.find((bank) => bank.id === normalized) || SUPPORTED_BANKS[0];
}
