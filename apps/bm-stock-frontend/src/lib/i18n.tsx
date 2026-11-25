"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'am' | 'om';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Sidebar
    home: 'Home',
    store: 'Store',
    shop: 'Shop',
    credit: 'Credit',
    add_product: 'Add Product',
    stock_in_out: 'Stock Out / In',
    permission_access: 'Permission/Access',
    customer_management: 'Customer Management',
    product_borrowing: 'Product Borrowing',
    transfer_request: 'Stock Transfer',
    bank_accounts: 'Bank Accounts',
    verify_receipt: 'Verify Receipt',
    total_reports: 'Total Reports',
    reports: 'Reports & Analytics',
    commission_management: 'Commission Management',
    request_more_companies: 'Request More Companies',
    settings: 'Settings',
    logout: 'Log Out',
    search_placeholder: 'Search products, sales, customers...',

    // Dashboard Header & Stats
    overview: 'Business Overview',
    todays_sales: "Today's Sales",
    todays_invoices: "Today's Invoices",
    products_credit: 'Products Credit',
    credit_customers: 'Credit Customers',
    stock_reminder: 'Stock Reminder',
    expired_items: 'Expired Items',
    recent_activity: 'Recent Activity',
    view_all: 'View All',
    quick_actions: 'Quick Actions',
    new_sale: 'New Sale',
    add_staff: 'Add Staff',
    add_branch: 'Add Branch',
    upgrade_plan: 'Upgrade Plan',

    // Products & Inventory
    products_catalog: 'Products Catalog',
    product_name: 'Product Name',
    sku: 'SKU',
    barcode: 'Barcode',
    category: 'Category',
    selling_price: 'Selling Price (ETB)',
    cost_price: 'Cost Price (ETB)',
    stock_quantity: 'Stock Quantity',
    min_stock_level: 'Min Stock Level',
    store_location: 'Store / Warehouse Location',
    supplier: 'Supplier',
    expiry_date: 'Expiry Date',
    in_stock: 'In Stock',
    low_stock: 'Low Stock',
    out_of_stock: 'Out of Stock',
    track_stock: 'Track Stock Quantity',
    description: 'Description',

    // Credit & Customers
    outstanding_credit: 'Outstanding Credit',
    customer_name: 'Customer Name',
    phone_number: 'Phone Number',
    address: 'Address / Location',
    total_credit: 'Total Credit (ETB)',
    remaining_balance: 'Remaining Balance (ETB)',
    invoice_number: 'Invoice Number',
    record_payment: 'Record Payment',
    payment_method: 'Payment Method',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    telebirr: 'Telebirr',
    record_credit_payment: 'Record Credit Payment',
    customer_added_success: 'Customer added successfully!',

    // Staff & Permissions
    staff_management: 'Staff Roster & Permissions',
    full_name: 'Full Name',
    job_title: 'Job Title / Role',
    auth_method: 'Authentication Method',
    password: 'Password Login',
    pin: '4-Digit PIN',
    assigned_store: 'Assigned Store / Warehouse',
    configure_permissions: 'Configure Permissions',
    module_permissions: 'MODULE LEVEL PERMISSIONS',
    branch_access: 'Allowed Branch & Location Access',
    group_on: 'Group ON',
    group_off: 'Group OFF',
    view_only: '👁️ View Only',
    full_edit: '✏️ Full Edit Access',
    save_permissions: 'Save Permissions',

    // Settings & Profile
    settings_profile: 'Settings & Profile',
    subscription_plan: 'Subscription Plan',
    active_plan: '1 Year Enterprise Business Plan',
    renew_upgrade: 'Renew / Upgrade',
    company_profile: 'Company & User Profile',
    company_name: 'Company Name',
    first_name: 'First Name',
    last_name: 'Last Name',
    edit_profile: '✏️ Edit Profile',
    save_profile: '✓ Save Profile',
    change_password: 'Change Account Password',
    push_notifications: 'Push Notifications',
    app_language: 'Application Language',
    privacy_policy: 'Privacy Policy & Terms',
    danger_zone: 'Danger Zone — Permanent Account Removal',
    delete_account: 'Delete Account',

    // Common & Actions
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    active: 'Active',
    inactive: 'Inactive',
    status: 'Status',
    action: 'Action',
    details: 'Details',
    none: 'None',
    success: 'Success',
    error: 'Error',

    // Purchases Tracking
    purchases: 'Purchases',
    track_purchases: 'Track Purchases',
    total_purchases: 'Total Purchases (ETB)',
    units_purchased: 'Units Purchased',
    avg_purchase: 'Avg. Purchase Value',
    purchase_transactions: 'Purchase Transactions',
    record_purchase: 'Record Purchase',
    export_csv: 'Export CSV',
    purchase_details: 'Purchase Details',
    unit_cost: 'Unit Cost',
    total_cost: 'Total Cost',
    all_time: 'All Time',
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    no_purchases_found: 'No purchases found',
    no_purchases_desc: 'Record your first purchase to start tracking inventory costs.',
    reference: 'Reference',
    quantity: 'Quantity',
    branch: 'Branch',
    date: 'Date',
    all_locations: 'All Locations',
    warehouse_only: 'Warehouses Only',
    shop_only: 'Shops Only',
  },
  am: {
    // Navigation & Sidebar
    home: 'መነሻ',
    store: 'መጋዘን',
    shop: 'ሱቅ',
    credit: 'ብድር',
    add_product: 'ዕቃ መዝግብ',
    stock_in_out: 'የዕቃ ገቢ/ወጪ',
    permission_access: 'ፈቃድ/መዳረሻ',
    customer_management: 'የደንበኞች አስተዳደር',
    product_borrowing: 'የዕቃ ውሰታ',
    transfer_request: 'የዕቃ ዝውውር ጥያቄ',
    bank_accounts: 'የባንክ ሂሳቦች',
    verify_receipt: 'ደረሰኝ አረጋግጥ',
    total_reports: 'ጠቅላላ ሪፖርት',
    reports: 'ሪፖርቶች እና ትንታኔዎች',
    commission_management: 'የኮሚሽን አስተዳደር',
    request_more_companies: 'ተጨማሪ ድርጅቶች ጠይቅ',
    settings: 'ማስተካከያዎች',
    logout: 'ውጣ',
    search_placeholder: 'ዕቃዎችን፣ ሽያጭን፣ ደንበኞችን ፈልግ...',

    // Dashboard Header & Stats
    overview: 'የንግድ እንቅስቃሴ አጠቃላይ እይታ',
    todays_sales: 'የዛሬ ሽያጭ',
    todays_invoices: 'የዛሬ ደረሰኞች',
    products_credit: 'የዕቃ ብድር',
    credit_customers: 'የብድር ደንበኞች',
    stock_reminder: 'የዕቃ መጠን ማስታወሻ',
    expired_items: 'ያለፈባቸው ዕቃዎች',
    recent_activity: 'የቅርብ ጊዜ እንቅስቃሴዎች',
    view_all: 'ሁሉንም እይ',
    quick_actions: 'ፈጣን ተግባራት',
    new_sale: 'አዲስ ሽያጭ',
    add_staff: 'ሰራተኛ መዝግብ',
    add_branch: 'ቅርንጫፍ መዝግብ',
    upgrade_plan: 'ፕላን አሻሽል',

    // Products & Inventory
    products_catalog: 'የዕቃዎች ዝርዝር',
    product_name: 'የዕቃው ስም',
    sku: 'ኤስ.ኬ.ዩ (SKU)',
    barcode: 'ባርኮድ',
    category: 'ምድብ',
    selling_price: 'የመሸጫ ዋጋ (ብር)',
    cost_price: 'የመግዣ ዋጋ (ብር)',
    stock_quantity: 'የዕቃ ብዛት',
    min_stock_level: 'ዝቅተኛ የዕቃ መጠን',
    store_location: 'የመጋዘን / ሱቅ ቦታ',
    supplier: 'አቅራቢ',
    expiry_date: 'የማለቂያ ቀን',
    in_stock: 'በክምችት ላይ አለ',
    low_stock: 'አናሳ ክምችት',
    out_of_stock: 'ያለቀ ዕቃ',
    track_stock: 'የዕቃ መጠን ተከታተል',
    description: 'መግለጫ',

    // Credit & Customers
    outstanding_credit: 'ያልተከፈለ ብድር',
    customer_name: 'የደንበኛ ስም',
    phone_number: 'ስልክ ቁጥር',
    address: 'አድራሻ / ቦታ',
    total_credit: 'ጠቅላላ ብድር (ብር)',
    remaining_balance: 'ቀሪ ክፍያ (ብር)',
    invoice_number: 'የደረሰኝ ቁጥር',
    record_payment: 'ክፍያ መዝግብ',
    payment_method: 'የክፍያ መንገድ',
    cash: 'በካሽ (በጥሬ ገንዘብ)',
    bank_transfer: 'በባንክ ትራንስፈር',
    telebirr: 'በቴሌብር',
    record_credit_payment: 'የብድር ክፍያ መዝግብ',
    customer_added_success: 'ደንበኛ በስኬት ተመዝግቧል!',

    // Staff & Permissions
    staff_management: 'የሰራተኞች ዝርዝር እና ፈቃዶች',
    full_name: 'ሙሉ ስም',
    job_title: 'የሥራ መደብ / ኃላፊነት',
    auth_method: 'የመግቢያ መንገድ',
    password: 'በይለፍ ቃል (Password)',
    pin: 'በ 4-አሃዝ ፒን (PIN)',
    assigned_store: 'የተመደበበት ሱቅ / መጋዘን',
    configure_permissions: 'ፈቃዶችን አስተካክል',
    module_permissions: 'የክፍሎች መዳረሻ ፈቃድ',
    branch_access: 'የተፈቀዱ ቅርንጫፎች እና ሱቆች',
    group_on: 'ምድብ አብራ',
    group_off: 'ምድብ አጥፋ',
    view_only: '👁️ ለማየት ብቻ',
    full_edit: '✏️ ሙሉ የማስተካከል ፈቃድ',
    save_permissions: 'ፈቃዶችን አስቀምጥ',

    // Settings & Profile
    settings_profile: 'ማስተካከያዎች እና ፕሮፋይል',
    subscription_plan: 'የደንበኝነት ተመዝጋቢ ፕላን',
    active_plan: 'የ 1 ዓመት የኢንተርፕራይዝ ቢዝነስ ፕላን',
    renew_upgrade: 'አድስ / አሻሽል',
    company_profile: 'የድርጅቱ እና የተጠቃሚ ፕሮፋይል',
    company_name: 'የድርጅቱ ስም',
    first_name: 'ስም',
    last_name: 'የአባት ስም',
    edit_profile: '✏️ ፕሮፋይል አስተካክል',
    save_profile: '✓ ፕሮፋይል አስቀምጥ',
    change_password: 'የመግቢያ ይለፍ ቃል ቀይር',
    push_notifications: 'የማስታወቂያ መልዕክቶች (Notifications)',
    app_language: 'የሲስተም ቋንቋ',
    privacy_policy: 'የግላዊነት ፖሊሲ እና ውሎች',
    danger_zone: 'አደገኛ ክልል — መለያን በቋሚነት ማጥፋት',
    delete_account: 'መለያ አጥፋ',

    // Common & Actions
    cancel: 'ሰርዝ',
    save: 'አስቀምጥ',
    close: 'ዝጋ',
    active: 'ንቁ (Active)',
    inactive: 'ቦዘኔ (Inactive)',
    status: 'ሁኔታ',
    action: 'ተግባር',
    details: 'ዝርዝር',
    none: 'ምንም',
    success: 'ተሳክቷል',
    error: 'ስህተት',

    // Purchases Tracking
    purchases: 'ግዢዎች',
    track_purchases: 'ግዢዎችን ይከታተሉ',
    total_purchases: 'ጠቅላላ ግዢ (ብር)',
    units_purchased: 'የተገዙ ብዛት',
    avg_purchase: 'አማካይ የግዢ ዋጋ',
    purchase_transactions: 'የግዢ ግብይቶች',
    record_purchase: 'ግዢ ይመዝግቡ',
    export_csv: 'CSV ላክ',
    purchase_details: 'የግዢ ዝርዝር',
    unit_cost: 'ነጠላ ዋጋ',
    total_cost: 'ጠቅላላ ዋጋ',
    all_time: 'ሁሉም ጊዜ',
    today: 'ዛሬ',
    this_week: 'በዚህ ሳምንት',
    this_month: 'በዚህ ወር',
    no_purchases_found: 'ግዢዎች አልተገኙም',
    no_purchases_desc: 'የግዢ ወጪን ለመከታተል የመጀመሪያ ግዢዎን ይመዝገቡ።',
    reference: 'ማጣቀሻ',
    quantity: 'ብዛት',
    branch: 'ቅርንጫፍ',
    date: 'ቀን',
    all_locations: 'ሁሉም ቦታዎች',
    warehouse_only: 'መጋዘኖች ብቻ',
    shop_only: 'ሱቆች ብቻ',
  },
  om: {
    // Navigation & Sidebar
    home: 'Fuula Duraa',
    store: 'Kuusaa',
    shop: 'Suuqii',
    credit: 'Liqii',
    add_product: 'Oomisha Galmeessi',
    stock_in_out: 'Seensa/Baasii Stokki',
    permission_access: 'Hayyama/Seensa',
    customer_management: 'Bulchiinsa Maamiltootaa',
    product_borrowing: 'Ergisa Oomishaa',
    transfer_request: 'Gaaffii Dabrsa Stokki',
    bank_accounts: 'Lakkoofsa Baankii',
    verify_receipt: 'Nagahee Mirkaneessi',
    total_reports: 'Gabaasa Waliigalaa',
    reports: 'Gabaasaa & Xiinxala',
    commission_management: 'Bulchiinsa Komishinii',
    request_more_companies: 'Dhaabbilee Dabalata Gaafadhu',
    settings: 'Qindaa\'inaa',
    logout: 'Ba\'i',
    search_placeholder: 'Oomishaalee, gurgurtaa, maamiltoota barbaadi...',

    // Dashboard Header & Stats
    overview: 'Waliigala Daldalaa',
    todays_sales: "Gurgurtaa Har'aa",
    todays_invoices: "Nagahee Har'aa",
    products_credit: 'Liqii Oomishaa',
    credit_customers: 'Maamiltoota Liqii',
    stock_reminder: 'Yaadachiisa Stokki',
    expired_items: 'Oomishaale darban',
    recent_activity: 'Sochii Dhihoo',
    view_all: 'Hunda Ilaali',
    quick_actions: 'Gochaawwan Saffisaa',
    new_sale: 'Gurgurtaa Haaraa',
    add_staff: 'Hojjetaa Dabalata',
    add_branch: 'Dabalee Dabalata',
    upgrade_plan: 'Pilaanii Fooyyessi',

    // Products & Inventory
    products_catalog: 'Tarree Oomishaalee',
    product_name: 'Maqaa Oomishaa',
    sku: 'SKU',
    barcode: 'Baarkoodii',
    category: 'Gosa',
    selling_price: 'Gatiin Gurgurtaa (ETB)',
    cost_price: 'Gatiin Bittaa (ETB)',
    stock_quantity: 'Baay\'ina Stokki',
    min_stock_level: 'Sadarkaa Stokki Xiqqaatu',
    store_location: 'Iddoo Kuusaa / Suuqii',
    supplier: 'Dhiyeessaa',
    expiry_date: 'Guyyaa Dhumaa',
    in_stock: 'Stokki Keessa Jira',
    low_stock: 'Stokki Xiqqaate',
    out_of_stock: 'Stokki Dhumate',
    track_stock: 'Baay\'ina Stokki Hordofi',
    description: 'Ibsa',

    // Credit & Customers
    outstanding_credit: 'Liqii Hin Kaffalamne',
    customer_name: 'Maqaa Maamilaa',
    phone_number: 'Lakkoofsa Bilbilaa',
    address: 'Teessoo / Iddoo',
    total_credit: 'Waliigala Liqii (ETB)',
    remaining_balance: 'Hambaa Kaffaltii (ETB)',
    invoice_number: 'Lakkoofsa Nagahee',
    record_payment: 'Kaffaltii Galmeessi',
    payment_method: 'Mala Kaffaltii',
    cash: 'Kashii (Qarshii)',
    bank_transfer: 'Baankii Dabrsaan',
    telebirr: 'Telebirriidhaan',
    record_credit_payment: 'Kaffaltii Liqii Galmeessi',
    customer_added_success: 'Maamilchii milkaa\'inaan galmaa\'eera!',

    // Staff & Permissions
    staff_management: 'Tarree Hojjettootaa & Hayyamamtoota',
    full_name: 'Maqaa Guutuu',
    job_title: 'Gita Hojii / Gahee',
    auth_method: 'Mala Seensaa',
    password: 'Jecha Darbiitiin (Password)',
    pin: 'PIN Lakkoofsa 4n',
    assigned_store: 'Suuqii / Kuusaa Ramadame',
    configure_permissions: 'Hayyama Qindeessi',
    module_permissions: 'HAYYAMA SEENSA KUTAALEE',
    branch_access: 'Dabaleewwan & Iddoowwan Hayyamaman',
    group_on: 'Gudunfaa Banu',
    group_off: 'Gudunfaa Cufu',
    view_only: '👁️ Ilaaluuf Qofa',
    full_edit: '✏️ Hayyama Gulaallii Guutuu',
    save_permissions: 'Hayyama Olkaasi',

    // Settings & Profile
    settings_profile: 'Qindaa\'inaa & Profaayilii',
    subscription_plan: 'Pilaanii Kaffaltii Shabakaa',
    active_plan: 'Pilaanii Waggaa 1 Dhaabbata Daldalaa',
    renew_upgrade: 'Haomessi / Fooyyessi',
    company_profile: 'Profaayilii Dhaabbata & Fayyadamaa',
    company_name: 'Maqaa Dhaabbata',
    first_name: 'Maqaa',
    last_name: 'Maqaa Abbaa',
    edit_profile: '✏️ Profaayilii Gulaali',
    save_profile: '✓ Profaayilii Olkaasi',
    change_password: 'Jecha Darbii Jijjiiri',
    push_notifications: 'Beeksisa Ergaa (Notifications)',
    app_language: 'Afaan Sirnaa',
    privacy_policy: 'Imaammata Icchitii & Seera',
    danger_zone: 'Iddoo Dhiphinaa — Akkaanti Balleessuu',
    delete_account: 'Akkaanti Balleessi',

    // Common & Actions
    cancel: 'Dhiisi',
    save: 'Olkaasi',
    close: 'Cufi',
    active: 'Hojirra kan jiru (Active)',
    inactive: 'Hojirra kan hin jirre (Inactive)',
    status: 'Haala',
    action: 'Tarkaanfii',
    details: 'Tarree',
    none: 'Hoomaa',
    success: 'Milkaa\'ee',
    error: 'Dogoggora',

    // Purchases Tracking
    purchases: 'Bittaalee',
    track_purchases: 'Bittaalee Hordofi',
    total_purchases: 'Waliigala Bittaa (ETB)',
    units_purchased: 'Baay\'ina Bitame',
    avg_purchase: 'Giddugaleessa Gatii Bittaa',
    purchase_transactions: 'Gurgurtaa Bittaa',
    record_purchase: 'Bittaa Galmeessi',
    export_csv: 'CSV Ergii',
    purchase_details: 'Tarree Bittaa',
    unit_cost: 'Gatii Tokkoo',
    total_cost: 'Gatii Waliigalaa',
    all_time: 'Yeroo Hunda',
    today: 'Har\'a',
    this_week: 'Torban Kana',
    this_month: 'Ji\'a Kana',
    no_purchases_found: 'Bittaan hin argamne',
    no_purchases_desc: 'Bittaa duraa hordofuuf galmeessi.',
    reference: 'Wabii',
    quantity: 'Baay\'ina',
    branch: 'Damee',
    date: 'Guyyaa',
    all_locations: 'Iddoo Hunda',
    warehouse_only: 'Kuusaa Qofa',
    shop_only: 'Suuqii Qofa',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('app_language') as Language;
    if (saved && (saved === 'en' || saved === 'am' || saved === 'om')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    const dict = translations[language] || translations['en'];
    return dict[key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
export const useTranslation = () => {
  const { t, language, setLanguage } = useLanguage();
  return { t, language, setLanguage };
};
