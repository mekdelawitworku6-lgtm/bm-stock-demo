// Sample dataset for the portfolio demo. Nothing here talks to a backend.
// All mutations are in-memory for the lifetime of the browser tab.

import { DEMO_COMPANY_ID, DEMO_TOKEN, DEMO_USER, DEMO_USER_ID } from './demoMode';

type Row = Record<string, any>;

interface DemoStore {
  products: Row[];
  sales: Row[];
  customers: Row[];
  suppliers: Row[];
  warehouses: Row[];
  shops: Row[];
  transfers: Row[];
  borrowings: Row[];
  staff: Row[];
  commissions: Row[];
  purchases: Row[];
  stockIn: Row[];
  stockOut: Row[];
  notifications: Row[];
  bankAccounts: Row[];
  companies: Row[];
}

let nextId = 100;
let store: DemoStore | null = null;

const stamp = (daysAgo = 0, hour = 10, minute = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const uid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const freshId = (): string => uid(nextId++);

function createStore(): DemoStore {
  const warehouseId = uid(11);
  const warehouse2Id = uid(12);
  const shopId = uid(21);
  const shop2Id = uid(22);
  const staffId = uid(31);

  const warehouses: Row[] = [
    { id: warehouseId, name: 'Main Warehouse', code: 'WH-001', location: 'Addis Ababa, Bole', managerName: 'Daniel Tekle', createdAt: stamp(400) },
    { id: warehouse2Id, name: 'North Depot', code: 'WH-002', location: 'Addis Ababa, Kazanchis', managerName: 'Marta Bekele', createdAt: stamp(300) },
  ];

  const shops: Row[] = [
    { id: shopId, name: 'Bole Branch Shop', location: 'Bole Road', managerName: 'Sara Tadesse', createdAt: stamp(350) },
    { id: shop2Id, name: '22 Mazoria Shop', location: '22 Mazoria', managerName: 'Yonas Ali', createdAt: stamp(250) },
    { id: uid(23), name: 'Saris Shop', location: 'Saris', managerName: 'Hana Wolde', createdAt: stamp(180) },
  ];

  const products: Row[] = [
    { id: uid(101), name: 'Blue Star Soap 125g', sku: 'SOAP-125', barcode: '1234567890123', price: 65, cost: 42, stockQuantity: 480, minStockLevel: 100, category: 'Home Care', unit: 'piece', trackStock: true, status: 'active', createdAt: stamp(210), warehouseId, shopId, warehouseProducts: [{ warehouseId, stockQuantity: 300 }], shopProducts: [{ shopId, stockQuantity: 180 }], locations: [{ name: 'Main Warehouse', quantity: 300, type: 'Warehouse' }, { name: 'Bole Branch Shop', quantity: 180, type: 'Shop' }] },
    { id: uid(102), name: 'Gelagle Mineral Water 1.5L', sku: 'WATER-1500', barcode: '1234567890124', price: 45, cost: 28, stockQuantity: 720, minStockLevel: 150, category: 'Beverages', unit: 'bottle', trackStock: true, status: 'active', createdAt: stamp(190), warehouseId, shopId, warehouseProducts: [{ warehouseId, stockQuantity: 500 }], shopProducts: [{ shopId, stockQuantity: 220 }] },
    { id: uid(103), name: 'Sunrise Cooking Oil 1L', sku: 'OIL-1L', barcode: '1234567890125', price: 210, cost: 165, stockQuantity: 96, minStockLevel: 120, category: 'Food', unit: 'bottle', trackStock: true, status: 'active', createdAt: stamp(170), warehouseId, warehouseProducts: [{ warehouseId, stockQuantity: 96 }], shopProducts: [] },
    { id: uid(104), name: 'Golden Wheat Flour 5kg', sku: 'FLOUR-5KG', barcode: '1234567890126', price: 390, cost: 320, stockQuantity: 210, minStockLevel: 60, category: 'Food', unit: 'bag', trackStock: true, status: 'active', createdAt: stamp(160), warehouseId, shopId, warehouseProducts: [{ warehouseId, stockQuantity: 150 }], shopProducts: [{ shopId, stockQuantity: 60 }] },
    { id: uid(105), name: 'Nile Detergent Powder 1kg', sku: 'DET-1KG', barcode: '1234567890127', price: 180, cost: 125, stockQuantity: 340, minStockLevel: 80, category: 'Home Care', unit: 'pack', trackStock: true, status: 'active', createdAt: stamp(150), warehouseId, shopId, warehouseProducts: [{ warehouseId, stockQuantity: 200 }], shopProducts: [{ shopId, stockQuantity: 140 }] },
    { id: uid(106), name: 'Ethio Coffee Beans 500g', sku: 'COFFEE-500', barcode: '1234567890128', price: 320, cost: 235, stockQuantity: 145, minStockLevel: 50, category: 'Beverages', unit: 'pack', trackStock: true, status: 'active', createdAt: stamp(140), warehouseId, warehouseProducts: [{ warehouseId, stockQuantity: 145 }], shopProducts: [] },
    { id: uid(107), name: 'Sharp Family Toothpaste', sku: 'PASTE-100', barcode: '1234567890129', price: 95, cost: 62, stockQuantity: 62, minStockLevel: 70, category: 'Personal Care', unit: 'piece', trackStock: true, status: 'active', createdAt: stamp(120), warehouseId, shopId, warehouseProducts: [{ warehouseId, stockQuantity: 40 }], shopProducts: [{ shopId, stockQuantity: 22 }] },
    { id: uid(108), name: 'Amhara Chili Powder 250g', sku: 'CHILI-250', barcode: '1234567890130', price: 140, cost: 98, stockQuantity: 275, minStockLevel: 50, category: 'Food', unit: 'pack', trackStock: true, status: 'active', createdAt: stamp(100), warehouseId, warehouseProducts: [{ warehouseId, stockQuantity: 275 }], shopProducts: [] },
    { id: uid(109), name: 'Soft Napkins (100 pcs)', sku: 'TISSUE-100', barcode: '1234567890131', price: 110, cost: 74, stockQuantity: 410, minStockLevel: 100, category: 'Home Care', unit: 'pack', trackStock: true, status: 'active', createdAt: stamp(80), warehouseId, shop2Id, warehouseProducts: [{ warehouseId, stockQuantity: 300 }], shopProducts: [{ shopId: shop2Id, stockQuantity: 110 }] },
    { id: uid(110), name: 'Mountain Tea Bags (25)', sku: 'TEA-25', barcode: '1234567890132', price: 175, cost: 120, stockQuantity: 38, minStockLevel: 60, category: 'Beverages', unit: 'box', trackStock: true, status: 'active', createdAt: stamp(60), warehouseId, warehouseProducts: [{ warehouseId, stockQuantity: 38 }], shopProducts: [] },
    { id: uid(111), name: 'Fresh Yogurt 1kg', sku: 'YOG-1KG', barcode: '1234567890133', price: 160, cost: 118, stockQuantity: 24, minStockLevel: 30, category: 'Dairy', unit: 'tub', trackStock: true, status: 'active', expiryDate: stamp(1, 23), isExpired: true, createdAt: stamp(45), warehouseId, warehouseProducts: [{ warehouseId, stockQuantity: 24 }], shopProducts: [] },
    { id: uid(112), name: 'Desert Cooking Gas 5kg', sku: 'GAS-5KG', barcode: '1234567890134', price: 780, cost: 640, stockQuantity: 88, minStockLevel: 20, category: 'Fuel', unit: 'cylinder', trackStock: true, status: 'active', createdAt: stamp(30), warehouseId, shopId, warehouseProducts: [{ warehouseId, stockQuantity: 60 }], shopProducts: [{ shopId, stockQuantity: 28 }] },
  ];

  const customers: Row[] = [
    { id: uid(201), name: 'Alsam Market', phone: '0911223344', email: 'alsam@example.com', address: 'Bole Road', totalCredit: 18400, createdAt: stamp(120) },
    { id: uid(202), name: 'Enat Trading PLC', phone: '0913556677', email: 'enat@example.com', address: 'Kazanchis', totalCredit: 9200, createdAt: stamp(95) },
    { id: uid(203), name: 'Abay Stores', phone: '0922445566', address: '22 Mazoria', totalCredit: 0, createdAt: stamp(70) },
    { id: uid(204), name: 'Selam Minimart', phone: '0933778899', address: 'Saris', totalCredit: 4600, createdAt: stamp(50) },
    { id: uid(205), name: 'Walk-in Customer', phone: '', address: '', totalCredit: 0, createdAt: stamp(20) },
  ];

  const suppliers: Row[] = [
    { id: uid(301), name: 'Addis Wholesale House', contact: '0911002233', email: 'sales@addiswholesale.example', address: 'Addis Ababa', createdAt: stamp(300) },
    { id: uid(302), name: 'Highland Foods PLC', contact: '0922334455', email: 'orders@highland.example', address: 'Nazareth', createdAt: stamp(250) },
    { id: uid(303), name: 'Blue Star Ethiopia', contact: '0933445566', email: 'info@bluestar.example', address: 'Addis Ababa', createdAt: stamp(200) },
  ];

  const sales: Row[] = [
    { id: uid(401), invoiceNumber: 'INV-2026-1048', customerId: uid(201), customerName: 'Alsam Market', customer: { id: uid(201), name: 'Alsam Market', phoneNumber: '0911223344' }, salespersonName: 'Daniel Tekle', totalAmount: 12840, paymentType: 'credit', remainingBalance: 6400, advancePayment: 6440, dueDate: stamp(-7, 17), warehouseName: 'Main Warehouse', status: 'completed', createdAt: stamp(0, 9, 42), saleDate: stamp(0, 9, 42), items: [{ productName: 'Gelagle Mineral Water 1.5L', quantity: 60, unitPrice: 45 }, { productName: 'Blue Star Soap 125g', quantity: 160, unitPrice: 65 }] },
    { id: uid(402), invoiceNumber: 'INV-2026-1047', customerId: uid(203), customerName: 'Abay Stores', customer: { id: uid(203), name: 'Abay Stores' }, salespersonName: 'Sara Tadesse', totalAmount: 8740, paymentType: 'cash', remainingBalance: 0, advancePayment: 8740, shopName: 'Bole Branch Shop', status: 'completed', createdAt: stamp(0, 11, 18), saleDate: stamp(0, 11, 18), items: [{ productName: 'Golden Wheat Flour 5kg', quantity: 12, unitPrice: 390 }, { productName: 'Sunrise Cooking Oil 1L', quantity: 20, unitPrice: 210 }] },
    { id: uid(403), invoiceNumber: 'INV-2026-1046', customerId: uid(202), customerName: 'Enat Trading PLC', customer: { id: uid(202), name: 'Enat Trading PLC' }, salespersonName: 'Marta Bekele', totalAmount: 15600, paymentType: 'credit', remainingBalance: 15600, advancePayment: 0, dueDate: stamp(-3, 17), warehouseName: 'North Depot', status: 'completed', createdAt: stamp(1, 14, 5), items: [{ productName: 'Ethio Coffee Beans 500g', quantity: 20, unitPrice: 320 }, { productName: 'Desert Cooking Gas 5kg', quantity: 10, unitPrice: 780 }] },
    { id: uid(404), invoiceNumber: 'INV-2026-1045', customerId: uid(204), customerName: 'Selam Minimart', customer: { id: uid(204), name: 'Selam Minimart' }, salespersonName: 'Yonas Ali', totalAmount: 4290, paymentType: 'cash', remainingBalance: 0, advancePayment: 4290, shopName: '22 Mazoria Shop', status: 'completed', createdAt: stamp(2, 10, 30), items: [{ productName: 'Nile Detergent Powder 1kg', quantity: 15, unitPrice: 180 }, { productName: 'Soft Napkins (100 pcs)', quantity: 12, unitPrice: 110 }] },
    { id: uid(405), invoiceNumber: 'INV-2026-1044', customerName: 'Walk-in Customer', salespersonName: 'Daniel Tekle', totalAmount: 2365, paymentType: 'cash', remainingBalance: 0, advancePayment: 2365, warehouseName: 'Main Warehouse', status: 'completed', createdAt: stamp(3, 16, 12), items: [{ productName: 'Amhara Chili Powder 250g', quantity: 10, unitPrice: 140 }, { productName: 'Sharp Family Toothpaste', quantity: 10, unitPrice: 95 }] },
    { id: uid(406), invoiceNumber: 'INV-2026-1043', customerId: uid(201), customerName: 'Alsam Market', customer: { id: uid(201), name: 'Alsam Market' }, salespersonName: 'Hana Wolde', totalAmount: 9930, paymentType: 'credit', remainingBalance: 2400, advancePayment: 7530, dueDate: stamp(-10, 17), shopName: 'Saris Shop', status: 'completed', createdAt: stamp(5, 12, 44), items: [{ productName: 'Mountain Tea Bags (25)', quantity: 30, unitPrice: 175 }, { productName: 'Ethio Coffee Beans 500g', quantity: 15, unitPrice: 320 }] },
    { id: uid(407), invoiceNumber: 'INV-2026-1042', customerName: 'Walk-in Customer', salespersonName: 'Sara Tadesse', totalAmount: 1520, paymentType: 'cash', remainingBalance: 0, advancePayment: 1520, shopName: 'Bole Branch Shop', status: 'completed', createdAt: stamp(7, 15, 22), items: [{ productName: 'Blue Star Soap 125g', quantity: 12, unitPrice: 65 }, { productName: 'Gelagle Mineral Water 1.5L', quantity: 20, unitPrice: 45 }] },
    { id: uid(408), invoiceNumber: 'INV-2026-1041', customerId: uid(204), customerName: 'Selam Minimart', customer: { id: uid(204), name: 'Selam Minimart' }, salespersonName: 'Marta Bekele', totalAmount: 6750, paymentType: 'credit', remainingBalance: 0, advancePayment: 6750, warehouseName: 'North Depot', status: 'completed', createdAt: stamp(9, 9, 10), items: [{ productName: 'Fresh Yogurt 1kg', quantity: 25, unitPrice: 160 }, { productName: 'Golden Wheat Flour 5kg', quantity: 5, unitPrice: 390 }] },
  ];

  const transfers: Row[] = [
    { id: uid(501), transferNumber: 'TRF-2026-0088', type: 'warehouse_to_shop', fromWarehouseId: warehouseId, fromWarehouseName: 'Main Warehouse', toShopId: shopId, toShopName: 'Bole Branch Shop', productId: uid(102), productName: 'Gelagle Mineral Water 1.5L', productSku: 'WATER-1500', quantity: 120, requestedByName: 'Daniel Tekle', approvedByName: 'Demo Admin', status: 'completed', createdAt: stamp(1, 8, 15), items: [{ productId: uid(102), quantity: 120 }] },
    { id: uid(502), transferNumber: 'TRF-2026-0087', type: 'warehouse_to_shop', fromWarehouseId: warehouse2Id, fromWarehouseName: 'North Depot', toShopId: shop2Id, toShopName: '22 Mazoria Shop', productId: uid(105), productName: 'Nile Detergent Powder 1kg', quantity: 60, requestedByName: 'Marta Bekele', approvedByName: 'Demo Admin', status: 'completed', createdAt: stamp(2, 11, 40), items: [{ productId: uid(105), quantity: 60 }] },
    { id: uid(503), transferNumber: 'TRF-2026-0086', type: 'warehouse_to_shop', fromWarehouseId: warehouseId, fromWarehouseName: 'Main Warehouse', toShopId: uid(23), toShopName: 'Saris Shop', productId: uid(109), productName: 'Soft Napkins (100 pcs)', quantity: 80, requestedByName: 'Hana Wolde', status: 'pending', createdAt: stamp(0, 13, 5), items: [{ productId: uid(109), quantity: 80 }] },
    { id: uid(504), transferNumber: 'TRF-2026-0085', type: 'warehouse_to_warehouse', fromWarehouseId: warehouseId, fromWarehouseName: 'Main Warehouse', toWarehouseId: warehouse2Id, toWarehouseName: 'North Depot', productId: uid(104), productName: 'Golden Wheat Flour 5kg', quantity: 40, requestedByName: 'Daniel Tekle', approvedByName: 'Demo Admin', status: 'completed', createdAt: stamp(4, 16, 30), items: [{ productId: uid(104), quantity: 40 }] },
    { id: uid(505), transferNumber: 'TRF-2026-0084', type: 'warehouse_to_shop', fromWarehouseId: warehouse2Id, fromWarehouseName: 'North Depot', toShopId: shopId, toShopName: 'Bole Branch Shop', productId: uid(106), productName: 'Ethio Coffee Beans 500g', quantity: 35, requestedByName: 'Yonas Ali', status: 'pending', createdAt: stamp(1, 15, 55), items: [{ productId: uid(106), quantity: 35 }] },
  ];

  const borrowings: Row[] = [
    { id: uid(601), productId: uid(102), productName: 'Gelagle Mineral Water 1.5L', productCategory: 'Beverages', quantityTaken: 50, quantityReturned: 30, remainingQuantity: 20, sellerName: 'Addis Wholesale House', dateTaken: stamp(12, 10), expectedReturnDate: stamp(-2, 10), note: 'Opening stock support', warehouseId, warehouseName: 'Main Warehouse', status: 'partially_returned', recordedByName: 'Daniel Tekle', createdAt: stamp(12, 10) },
    { id: uid(602), productId: uid(105), productName: 'Nile Detergent Powder 1kg', productCategory: 'Home Care', quantityTaken: 40, quantityReturned: 40, remainingQuantity: 0, sellerName: 'Blue Star Ethiopia', dateTaken: stamp(25, 9), expectedReturnDate: stamp(5, 9), note: 'Returned in full', warehouseId, warehouseName: 'Main Warehouse', status: 'fully_returned', recordedByName: 'Marta Bekele', createdAt: stamp(25, 9) },
    { id: uid(603), productId: uid(108), productName: 'Amhara Chili Powder 250g', productCategory: 'Food', quantityTaken: 30, quantityReturned: 0, remainingQuantity: 30, sellerName: 'Highland Foods PLC', dateTaken: stamp(6, 14), expectedReturnDate: stamp(-6, 14), note: 'Replacement pending', warehouseId, warehouseName: 'Main Warehouse', status: 'active', recordedByName: 'Daniel Tekle', createdAt: stamp(6, 14) },
    { id: uid(604), productId: uid(110), productName: 'Mountain Tea Bags (25)', productCategory: 'Beverages', quantityTaken: 20, quantityReturned: 10, remainingQuantity: 10, sellerName: 'Addis Wholesale House', dateTaken: stamp(9, 11), warehouseId, warehouseName: 'Main Warehouse', status: 'partially_returned', recordedByName: 'Hana Wolde', createdAt: stamp(9, 11) },
  ];

  const staff: Row[] = [
    { id: staffId, firstName: 'Daniel', lastName: 'Tekle', name: 'Daniel Tekle', phoneNumber: '0911223344', role: 'ADMIN', jobTitle: 'Warehouse Manager', isActive: true, warehouseId, warehouseName: 'Main Warehouse', authMethod: 'Password', salesAmount: 28400, createdAt: stamp(300) },
    { id: uid(32), firstName: 'Sara', lastName: 'Tadesse', name: 'Sara Tadesse', phoneNumber: '0913556677', role: 'STAFF', jobTitle: 'Salesperson', isActive: true, shopId, shopName: 'Bole Branch Shop', authMethod: 'PIN', salesAmount: 19750, createdAt: stamp(240) },
    { id: uid(33), firstName: 'Marta', lastName: 'Bekele', name: 'Marta Bekele', phoneNumber: '0922445566', role: 'STAFF', jobTitle: 'Inventory Officer', isActive: true, warehouseId: warehouse2Id, warehouseName: 'North Depot', authMethod: 'Password', salesAmount: 23100, createdAt: stamp(210) },
    { id: uid(34), firstName: 'Yonas', lastName: 'Ali', name: 'Yonas Ali', phoneNumber: '0933778899', role: 'STAFF', jobTitle: 'Shop Attendant', isActive: true, shopId: shop2Id, shopName: '22 Mazoria Shop', authMethod: 'PIN', salesAmount: 8420, createdAt: stamp(150) },
    { id: uid(35), firstName: 'Hana', lastName: 'Wolde', name: 'Hana Wolde', phoneNumber: '0944556677', role: 'STAFF', jobTitle: 'Salesperson', isActive: true, shopId: uid(23), shopName: 'Saris Shop', authMethod: 'Password', salesAmount: 9930, createdAt: stamp(120) },
    { id: uid(36), firstName: 'Biniam', lastName: 'Girma', name: 'Biniam Girma', phoneNumber: '0955667788', role: 'STAFF', jobTitle: 'Cashier', isActive: false, shopId, shopName: 'Bole Branch Shop', authMethod: 'PIN', salesAmount: 4120, createdAt: stamp(90) },
  ];

  const commissions: Row[] = [
    { id: uid(701), salespersonName: 'Sara Tadesse', productName: 'Golden Wheat Flour 5kg', saleAmount: 4680, commissionRate: 5, commissionAmount: 234, isApproved: false, createdAt: stamp(0, 11), quantity: 12, unitPrice: 390, lineTotal: 4680, customerName: 'Abay Stores', invoiceNumber: 'INV-2026-1047' },
    { id: uid(702), salespersonName: 'Daniel Tekle', productName: 'Gelagle Mineral Water 1.5L', saleAmount: 2700, commissionRate: 5, commissionAmount: 135, isApproved: false, createdAt: stamp(0, 9), quantity: 60, unitPrice: 45, lineTotal: 2700, customerName: 'Alsam Market', invoiceNumber: 'INV-2026-1048' },
    { id: uid(703), salespersonName: 'Marta Bekele', productName: 'Ethio Coffee Beans 500g', saleAmount: 6400, commissionRate: 5, commissionAmount: 320, isApproved: true, createdAt: stamp(1, 14), quantity: 20, unitPrice: 320, lineTotal: 6400, customerName: 'Enat Trading PLC', invoiceNumber: 'INV-2026-1046' },
    { id: uid(704), salespersonName: 'Yonas Ali', productName: 'Nile Detergent Powder 1kg', saleAmount: 2700, commissionRate: 5, commissionAmount: 135, isApproved: true, createdAt: stamp(2, 10), quantity: 15, unitPrice: 180, lineTotal: 2700, customerName: 'Selam Minimart', invoiceNumber: 'INV-2026-1045' },
    { id: uid(705), salespersonName: 'Hana Wolde', productName: 'Mountain Tea Bags (25)', saleAmount: 5250, commissionRate: 5, commissionAmount: 262.5, isApproved: false, createdAt: stamp(5, 12), quantity: 30, unitPrice: 175, lineTotal: 5250, customerName: 'Alsam Market', invoiceNumber: 'INV-2026-1044' },
    { id: uid(706), salespersonName: 'Daniel Tekle', productName: 'Amhara Chili Powder 250g', saleAmount: 1400, commissionRate: 5, commissionAmount: 70, isApproved: true, createdAt: stamp(3, 16), quantity: 10, unitPrice: 140, lineTotal: 1400, customerName: 'Walk-in Customer', invoiceNumber: 'INV-2026-1043' },
  ];

  const purchases: Row[] = [
    { id: uid(801), productId: uid(104), productName: 'Golden Wheat Flour 5kg', sku: 'FLOUR-5KG', quantity: 100, unitCost: 320, totalCost: 32000, warehouseId, warehouseName: 'Main Warehouse', supplierId: uid(301), supplierName: 'Addis Wholesale House', performedByName: 'Daniel Tekle', createdAt: stamp(2, 8, 30) },
    { id: uid(802), productId: uid(102), productName: 'Gelagle Mineral Water 1.5L', sku: 'WATER-1500', quantity: 300, unitCost: 28, totalCost: 8400, warehouseId, warehouseName: 'Main Warehouse', supplierId: uid(303), supplierName: 'Blue Star Ethiopia', performedByName: 'Marta Bekele', createdAt: stamp(4, 9, 15) },
    { id: uid(803), productId: uid(103), productName: 'Sunrise Cooking Oil 1L', sku: 'OIL-1L', quantity: 80, unitCost: 165, totalCost: 13200, warehouseId, warehouseName: 'Main Warehouse', supplierId: uid(302), supplierName: 'Highland Foods PLC', performedByName: 'Daniel Tekle', createdAt: stamp(6, 11, 20) },
    { id: uid(804), productId: uid(106), productName: 'Ethio Coffee Beans 500g', sku: 'COFFEE-500', quantity: 60, unitCost: 235, totalCost: 14100, warehouseId: warehouse2Id, warehouseName: 'North Depot', supplierId: uid(302), supplierName: 'Highland Foods PLC', performedByName: 'Marta Bekele', createdAt: stamp(8, 14, 45) },
    { id: uid(805), productId: uid(109), productName: 'Soft Napkins (100 pcs)', sku: 'TISSUE-100', quantity: 200, unitCost: 74, totalCost: 14800, warehouseId, warehouseName: 'Main Warehouse', supplierId: uid(301), supplierName: 'Addis Wholesale House', performedByName: 'Sara Tadesse', createdAt: stamp(11, 10, 10) },
    { id: uid(806), productId: uid(112), productName: 'Desert Cooking Gas 5kg', sku: 'GAS-5KG', quantity: 40, unitCost: 640, totalCost: 25600, shopId, shopName: 'Bole Branch Shop', supplierId: uid(301), supplierName: 'Addis Wholesale House', performedByName: 'Yonas Ali', createdAt: stamp(14, 16, 5) },
  ];

  const stockIn: Row[] = [
    { id: uid(901), type: 'stock_in', productId: uid(104), productName: 'Golden Wheat Flour 5kg', quantity: 100, unitCost: 320, reason: 'Purchase order PO-2210', warehouseId, warehouseName: 'Main Warehouse', supplierName: 'Addis Wholesale House', performedByName: 'Daniel Tekle', createdAt: stamp(2, 8, 30) },
    { id: uid(902), type: 'stock_in', productId: uid(102), productName: 'Gelagle Mineral Water 1.5L', quantity: 300, unitCost: 28, reason: 'Purchase order PO-2208', warehouseId, warehouseName: 'Main Warehouse', supplierName: 'Blue Star Ethiopia', performedByName: 'Marta Bekele', createdAt: stamp(4, 9, 15) },
    { id: uid(903), type: 'stock_in', productId: uid(103), productName: 'Sunrise Cooking Oil 1L', quantity: 80, unitCost: 165, reason: 'Purchase order PO-2202', warehouseId, warehouseName: 'Main Warehouse', supplierName: 'Highland Foods PLC', performedByName: 'Daniel Tekle', createdAt: stamp(6, 11, 20) },
    { id: uid(904), type: 'stock_in', productId: uid(106), productName: 'Ethio Coffee Beans 500g', quantity: 60, unitCost: 235, reason: 'Purchase order PO-2198', warehouseId: warehouse2Id, warehouseName: 'North Depot', supplierName: 'Highland Foods PLC', performedByName: 'Marta Bekele', createdAt: stamp(8, 14, 45) },
    { id: uid(905), type: 'stock_in', productId: uid(109), productName: 'Soft Napkins (100 pcs)', quantity: 200, unitCost: 74, reason: 'Purchase order PO-2191', warehouseId, warehouseName: 'Main Warehouse', supplierName: 'Addis Wholesale House', performedByName: 'Sara Tadesse', createdAt: stamp(11, 10, 10) },
  ];

  const stockOut: Row[] = [
    { id: uid(911), type: 'stock_out', productId: uid(102), productName: 'Gelagle Mineral Water 1.5L', quantity: 60, reason: 'Sale INV-2026-1048', warehouseId, warehouseName: 'Main Warehouse', performedByName: 'Daniel Tekle', createdAt: stamp(0, 9, 42) },
    { id: uid(912), type: 'stock_out', productId: uid(104), productName: 'Golden Wheat Flour 5kg', quantity: 12, reason: 'Sale INV-2026-1047', shopId, shopName: 'Bole Branch Shop', performedByName: 'Sara Tadesse', createdAt: stamp(0, 11, 18) },
    { id: uid(913), type: 'stock_out', productId: uid(106), productName: 'Ethio Coffee Beans 500g', quantity: 20, reason: 'Sale INV-2026-1046', warehouseId: warehouse2Id, warehouseName: 'North Depot', performedByName: 'Marta Bekele', createdAt: stamp(1, 14, 5) },
    { id: uid(914), type: 'stock_out', productId: uid(105), productName: 'Nile Detergent Powder 1kg', quantity: 15, reason: 'Sale INV-2026-1045', shopId: shop2Id, shopName: '22 Mazoria Shop', performedByName: 'Yonas Ali', createdAt: stamp(2, 10, 30) },
    { id: uid(915), type: 'stock_out', productId: uid(111), productName: 'Fresh Yogurt 1kg', quantity: 24, reason: 'Expired stock write-off', warehouseId, warehouseName: 'Main Warehouse', performedByName: 'Daniel Tekle', createdAt: stamp(1, 17, 15) },
  ];

  const notifications: Row[] = [
    { id: uid(1001), type: 'low_stock', title: 'Low stock alert', message: 'Sunrise Cooking Oil 1L is below its minimum stock level.', isRead: false, createdAt: stamp(0, 8, 20) },
    { id: uid(1002), type: 'transfer', title: 'Transfer request pending', message: 'Saris Shop requested 80 packs of Soft Napkins from Main Warehouse.', isRead: false, createdAt: stamp(0, 13, 5) },
    { id: uid(1003), type: 'expiry', title: 'Expiry reminder', message: 'Fresh Yogurt 1kg expires tomorrow. Review your stock.', isRead: false, createdAt: stamp(1, 7, 45) },
    { id: uid(1004), type: 'credit', title: 'Credit payment received', message: 'Alsam Market paid ETB 6,040 toward invoice INV-2026-1048.', isRead: true, createdAt: stamp(2, 15, 10) },
    { id: uid(1005), type: 'sale', title: 'Daily sales summary', message: 'Yesterday closed with 8 invoices and ETB 51,725 in sales.', isRead: true, createdAt: stamp(1, 18, 0) },
  ];

  const bankAccounts: Row[] = [
    { id: uid(1101), bankName: 'Commercial Bank of Ethiopia', accountName: 'Gelagle Trading House', accountNumber: '1000293847561', branchName: 'Bole Branch', currentBalance: 1842500, initialBalance: 1500000, isPrimary: true, createdAt: stamp(400) },
    { id: uid(1102), bankName: 'Awash Bank', accountName: 'Gelagle Trading House', accountNumber: '0231456789012', branchName: 'Kazanchis Branch', currentBalance: 642300, initialBalance: 500000, isPrimary: false, createdAt: stamp(300) },
    { id: uid(1103), bankName: 'Telebirr Wallet', accountName: 'Demo Admin', accountNumber: '091911000123', branchName: 'Merchant Account', currentBalance: 128400, initialBalance: 100000, isPrimary: false, createdAt: stamp(200) },
  ];

  return {
    products,
    sales,
    customers,
    suppliers,
    warehouses,
    shops,
    transfers,
    borrowings,
    staff,
    commissions,
    purchases,
    stockIn,
    stockOut,
    notifications,
    bankAccounts,
    companies: [{ id: DEMO_COMPANY_ID, name: 'Gelagle Trading House', address: 'Bole Road, Addis Ababa', phoneNumber: '+251 911 000 123', status: 'active' }],
  };
}

function getStore(): DemoStore {
  if (!store) store = createStore();
  return store;
}

function summary() {
  const data = getStore();
  const revenue = data.sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const credit = data.sales.filter((sale) => sale.paymentType === 'credit').reduce((sum, sale) => sum + Number(sale.remainingBalance || 0), 0);
  const purchase = data.purchases.reduce((sum, purchase) => sum + Number(purchase.totalCost || 0), 0);
  const grossProfit = revenue - purchase;
  const commission = data.commissions.reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0);
  return {
    summary: {
      totalRevenue: revenue,
      totalSales: data.sales.length,
      totalCredit: credit,
      creditCustomers: new Set(data.sales.filter((s) => s.paymentType === 'credit').map((s) => s.customerName)).size,
      totalPurchase: purchase,
      totalExpense: 12800,
      totalCommission: commission,
      totalTax: 0,
      totalDiscount: 0,
      grossProfit,
      totalProfit: grossProfit - 12800 - commission,
      cashProfit: grossProfit - 12800 - commission + 12000,
      creditCollected: 12000,
      outstandingCredit: credit,
    },
    byProduct: data.products.slice(0, 8).map((product) => ({
      name: product.name,
      quantitySold: Math.max(5, Math.round(Number(product.stockQuantity || 0) / 5)),
      revenue: Math.round(Number(product.price || 0) * Math.max(5, Math.round(Number(product.stockQuantity || 0) / 5))),
    })),
    byLocation: [
      ...data.warehouses.map((warehouse, index) => ({ name: warehouse.name, type: 'warehouse', revenue: 42000 - index * 12000, quantitySold: 180 - index * 60 })),
      ...data.shops.map((shop, index) => ({ name: shop.name, type: 'shop', revenue: 31000 - index * 8000, quantitySold: 130 - index * 30 })),
    ],
  };
}

function bankSummary() {
  return {
    todaySales: 21580,
    productSales: 21580,
    totalExpenses: 12800,
    commission: 954.5,
    netProfit: 7825.5,
  };
}

function findAndUpdate(rows: Row[], id: string, patch: Row): Row | null {
  const row = rows.find((item) => String(item.id) === String(id));
  if (!row) return null;
  Object.assign(row, patch);
  return row;
}

function findAndDelete(rows: Row[], id: string): boolean {
  const index = rows.findIndex((item) => String(item.id) === String(id));
  if (index < 0) return false;
  rows.splice(index, 1);
  return true;
}

/** Returns the raw payload that ApiClient.request would have received from the backend. */
export function demoRequest(path: string, options: RequestInit = {}): any {
  const data = getStore();
  const method = String(options.method || 'GET').toUpperCase();
  const url = path.split('?')[0];
  const segments = url.split('/').filter(Boolean);
  let body: Row = {};
  try {
    body = options.body ? JSON.parse(String(options.body)) : {};
  } catch (_) {
    body = {};
  }

  // Auth stays fake but complete so login/registration screens are explorable.
  if (url.startsWith('/auth/')) {
    if (url === '/auth/login' || url === '/auth/staff-first-login' || url === '/auth/cadmin-first-login' || url === '/auth/pin-unlock' || url === '/auth/register') {
      return { user: DEMO_USER, accessToken: DEMO_TOKEN };
    }
    if (url === '/auth/send-otp' || url === '/users/me/send-delete-otp') {
      return { success: true, verificationId: 'demo-verification', code: '123456', message: 'Demo OTP: 123456' };
    }
    if (url === '/auth/verify-otp') return { verified: true };
    if (url === '/auth/renewal-preview') return { subscriptionExpired: false, canRenew: true, numCompanies: 1 };
    return { success: true, message: 'Demo mode: action completed.' };
  }

  if (method === 'GET') {
    if (url === '/reports/dashboard/summary') {
      const lowStockItems = data.products.filter((product) => product.trackStock && product.minStockLevel && Number(product.stockQuantity || 0) <= Number(product.minStockLevel)).length;
      const expiredItems = data.products.filter((product) => product.isExpired).length;
      return {
        sales: {
          totalRevenue: summary().summary.totalRevenue,
          totalSales: data.sales.length,
          totalCredit: summary().summary.totalCredit,
          creditCustomers: summary().summary.creditCustomers,
        },
        inventory: { lowStockItems, expiredItems },
      };
    }
    if (url === '/sales/reports/analytics') return summary();
    if (url === '/bank/summary') return bankSummary();
    if (url === '/inventory/transactions') {
      const type = new URLSearchParams(path.split('?')[1] || '').get('type');
      return type === 'stock_in' ? data.stockIn : type === 'stock_out' ? data.stockOut : [...data.stockIn, ...data.stockOut];
    }
    if (url === '/inventory/purchases') return { data: { data: data.purchases, total: data.purchases.length, page: 1, limit: 50, totalPages: 1, summary: { totalPurchasesCost: data.purchases.reduce((s, p) => s + Number(p.totalCost || 0), 0), totalUnitsPurchased: data.purchases.reduce((s, p) => s + Number(p.quantity || 0), 0), transactionCount: data.purchases.length } } };
    if (url === '/sales') return data.sales;
    if (url === '/products') return data.products;
    if (url === '/warehouses') return data.warehouses;
    if (url === '/shops') return data.shops;
    if (url === '/customers') return data.customers;
    if (url === '/collections/suppliers') return data.suppliers;
    if (url === '/borrowings') return data.borrowings;
    if (url === '/transfers') return data.transfers;
    if (url === '/employees' || url === '/users') return data.staff;
    if (url === '/commissions') return data.commissions;
    if (url === '/plans') {
      return [
        { id: 'plan_starter', title: 'Starter Plan (1 Additional Slot)', price: '1,500', amount: 1500, features: ['Manage 1 new company entity', 'Separate inventory & sales tracking'] },
        { id: 'plan_growth', title: 'Growth Plan (3 Additional Slots)', price: '3,800', amount: 3800, features: ['Manage 3 new company entities', 'Full multi-branch reporting & transfers'] },
        { id: 'plan_enterprise', title: 'Enterprise Plan (Unlimited)', price: '8,500', amount: 8500, features: ['Unlimited company entities', 'Custom workflow permissions', '24/7 VIP assistance'] },
      ];
    }
    if (url === '/companies') return data.companies;
    if (url === '/bank/accounts') return data.bankAccounts;
    if (url === '/notifications') return data.notifications;
    if (url === '/notifications/unread-count') return { count: data.notifications.filter((item) => !item.isRead).length };
    if (url === '/users/me') return { ...DEMO_USER, company: { id: DEMO_COMPANY_ID, name: 'Gelagle Trading House' } };

    if (segments.length === 3 && segments[0] === 'sales' && segments[2] === 'payment-history') {
      return [{ id: freshId(), amount: 6040, paymentMethod: 'bank_transfer', transactionType: 'sale', createdAt: stamp(2, 15, 10), notes: 'Partial settlement' }];
    }
    if (segments.length === 3 && segments[0] === 'products' && segments[2] === 'locations') {
      return { warehouses: data.warehouses.map((w) => ({ ...w, stockQuantity: 40 })), shops: data.shops.map((s) => ({ ...s, stockQuantity: 20 })) };
    }
    if (segments.length === 3 && (segments[0] === 'warehouses' || segments[0] === 'shops') && segments[2] === 'with-products') {
      const locationId = segments[1];
      const rows = segments[0] === 'warehouses'
        ? data.products.filter((p) => p.warehouseProducts?.some((wp: Row) => String(wp.warehouseId) === locationId))
        : data.products.filter((p) => p.shopProducts?.some((sp: Row) => String(sp.shopId) === locationId));
      return rows.map((row) => ({ ...row, stockQuantity: Number(row.stockQuantity || 0) }));
    }
    return [];
  }

  // Receipt verification and generic writes.
  if (url === '/receipts/verify') {
    return {
      valid: true,
      status: 'valid',
      message: 'Demo receipt verified successfully.',
      bank: body.bank || 'cbe',
      amount: 12840,
      currency: 'ETB',
      senderName: 'Demo Customer',
      receiverName: 'Gelagle Trading House',
      reference: body.reference || body.referenceNumber || 'DEMO-REF-2026',
      receiptNumber: body.receiptNumber || 'DEMO-REC-1048',
      transactionDate: stamp(0, 9, 42),
    };
  }
  if (url === '/auth/upload-payment-proof') return { url: '/logo/gelagle_logo.png' };
  if (url === '/users/me' && method === 'PATCH') {
    Object.assign(DEMO_USER, body);
    return { ...DEMO_USER };
  }
  if (url === '/users/me' && method === 'DELETE') return { success: true };

  if (url === '/products' && method === 'POST') {
    const product = { id: freshId(), trackStock: true, stockQuantity: 0, status: 'active', createdAt: stamp(0), ...body };
    data.products.unshift(product);
    return product;
  }
  if (url === '/customers' && method === 'POST') {
    const customer = { id: freshId(), totalCredit: 0, createdAt: stamp(0), ...body };
    data.customers.unshift(customer);
    return customer;
  }
  if (url === '/collections/supplier' && method === 'POST') {
    const supplier = { id: freshId(), createdAt: stamp(0), ...body };
    data.suppliers.unshift(supplier);
    return supplier;
  }
  if (url === '/sales' && method === 'POST') {
    const sale = {
      id: freshId(),
      invoiceNumber: `INV-DEMO-${String(data.sales.length + 1049)}`,
      customerName: body.customerId ? data.customers.find((c) => String(c.id) === String(body.customerId))?.name || 'Walk-in Customer' : 'Walk-in Customer',
      salespersonName: 'Demo Admin',
      totalAmount: 0,
      paymentType: body.paymentType || 'cash',
      remainingBalance: body.paymentType === 'credit' ? 0 : 0,
      advancePayment: Number(body.advancePayment || 0),
      status: 'completed',
      createdAt: stamp(0),
      items: body.items || [],
      ...body,
    };
    data.sales.unshift(sale);
    const commission = {
      id: freshId(),
      salespersonName: 'Demo Admin',
      productName: sale.items?.[0]?.productName || 'Product',
      saleAmount: Number(sale.totalAmount || 0),
      commissionRate: 5,
      commissionAmount: Number(sale.totalAmount || 0) * 0.05,
      isApproved: false,
      createdAt: stamp(0),
      customerName: sale.customerName,
      invoiceNumber: sale.invoiceNumber,
    };
    data.commissions.unshift(commission);
    return sale;
  }
  if (url === '/warehouses' && method === 'POST') {
    const warehouse = { id: freshId(), createdAt: stamp(0), ...body };
    data.warehouses.unshift(warehouse);
    return warehouse;
  }
  if (url === '/shops' && method === 'POST') {
    const shop = { id: freshId(), createdAt: stamp(0), ...body };
    data.shops.unshift(shop);
    return shop;
  }
  if (url === '/employees' && method === 'POST') {
    const employee = { id: freshId(), name: body.name || 'New Staff', isActive: true, createdAt: stamp(0), ...body };
    data.staff.unshift(employee);
    return employee;
  }
  if (url === '/companies' && method === 'POST') {
    const company = { id: freshId(), status: 'active', ...body };
    data.companies.push(company);
    return company;
  }
  if (url === '/bank/accounts' && method === 'POST') {
    const account = { id: freshId(), currentBalance: Number(body.initialBalance || 0), ...body };
    data.bankAccounts.push(account);
    return account;
  }
  if (url === '/borrowings' && method === 'POST') {
    const borrowing = { id: freshId(), quantityReturned: 0, status: 'active', createdAt: stamp(0), ...body };
    data.borrowings.unshift(borrowing);
    return borrowing;
  }
  if (url === '/transfers' && method === 'POST') {
    const transfer = {
      id: freshId(),
      transferNumber: `TRF-DEMO-${String(data.transfers.length + 89)}`,
      status: 'pending',
      requestedByName: 'Demo Admin',
      createdAt: stamp(0),
      items: [{ productId: body.productId, quantity: body.quantity }],
      ...body,
    };
    data.transfers.unshift(transfer);
    return transfer;
  }
  if (url === '/inventory/adjust' && method === 'POST') {
    const product = data.products.find((p) => String(p.id) === String(body.productId));
    const quantity = Number(body.quantity || 0);
    if (product) product.stockQuantity = Math.max(0, Number(product.stockQuantity || 0) + (body.type === 'stock_out' ? -quantity : quantity));
    const transaction = {
      id: freshId(),
      type: body.type || 'stock_in',
      productId: body.productId,
      productName: product?.name || 'Product',
      quantity,
      reason: body.reason || 'Demo stock adjustment',
      warehouseId: body.warehouseId,
      shopId: body.shopId,
      performedByName: 'Demo Admin',
      createdAt: stamp(0),
    };
    (body.type === 'stock_out' ? data.stockOut : data.stockIn).unshift(transaction);
    return transaction;
  }
  if (url === '/commissions/approve') {
    (body.commissionIds || body.ids || []).forEach((id: string) => findAndUpdate(data.commissions, id, { isApproved: true }));
    return { success: true };
  }
  if (url === '/notifications/read-all') {
    data.notifications.forEach((item) => { item.isRead = true; });
    return { success: true };
  }

  if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    if (segments[0] === 'products' && segments[1]) {
      if (method === 'DELETE') return { success: findAndDelete(data.products, segments[1]) };
      return findAndUpdate(data.products, segments[1], body) || { ...body, id: segments[1] };
    }
    if (segments[0] === 'customers' && segments[1]) {
      if (method === 'DELETE') return { success: findAndDelete(data.customers, segments[1]) };
      return findAndUpdate(data.customers, segments[1], body) || { ...body, id: segments[1] };
    }
    if (segments[0] === 'warehouses' && segments[1]) {
      if (method === 'DELETE') return { success: findAndDelete(data.warehouses, segments[1]) };
      return findAndUpdate(data.warehouses, segments[1], body) || { ...body, id: segments[1] };
    }
    if (segments[0] === 'shops' && segments[1]) {
      if (method === 'DELETE') return { success: findAndDelete(data.shops, segments[1]) };
      return findAndUpdate(data.shops, segments[1], body) || { ...body, id: segments[1] };
    }
    if (segments[0] === 'employees' && segments[1]) {
      if (method === 'DELETE') return { success: findAndDelete(data.staff, segments[1]) };
      return findAndUpdate(data.staff, segments[1], body) || { ...body, id: segments[1] };
    }
    if (segments[0] === 'borrowings' && segments[1]) {
      const borrowing = findAndUpdate(data.borrowings, segments[1], body);
      if (borrowing) borrowing.remainingQuantity = Math.max(0, Number(borrowing.quantityTaken || 0) - Number(borrowing.quantityReturned || 0));
      return borrowing || { ...body, id: segments[1] };
    }
    if (segments[0] === 'transfers' && segments[1]) {
      const status = segments[2] === 'approve' ? 'completed' : segments[2] === 'reject' ? 'rejected' : body.status;
      return findAndUpdate(data.transfers, segments[1], { ...body, status }) || { ...body, id: segments[1], status };
    }
    if (segments[0] === 'notifications' && segments[2] === 'read') {
      return findAndUpdate(data.notifications, segments[1], { isRead: true }) || { success: true };
    }
    if (segments[0] === 'companies' && segments[1]) {
      return findAndUpdate(data.companies, segments[1], body) || { ...body, id: segments[1] };
    }
  }

  if (url === '/bank/add-balance') {
    const account = data.bankAccounts.find((item) => String(item.id) === String(body.bankAccountId));
    if (account) account.currentBalance = Number(account.currentBalance || 0) + Number(body.amount || 0);
    return { success: true, account };
  }
  if (url === '/bank/expenses') {
    const account = data.bankAccounts.find((item) => String(item.id) === String(body.bankAccountId));
    if (account) account.currentBalance = Number(account.currentBalance || 0) - Number(body.amount || 0);
    return { success: true, account };
  }

  return { success: true, ...body };
}
