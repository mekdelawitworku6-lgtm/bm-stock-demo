import * as XLSX from 'xlsx';
import { inflate } from 'pako';

export interface ImportedSaleRecord {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentType: 'cash' | 'bank_transfer' | 'mobile_money' | 'credit';
  locationName: string;
  status: string;
  remainingBalance?: number;
  advancePayment?: number;
  notes?: string;
  source: 'csv' | 'pdf' | 'excel';
  isImported: boolean;
}

/**
 * Normalizes header keys to standard names
 */
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps raw payment string to system payment type
 */
function normalizePaymentType(val?: string): 'cash' | 'bank_transfer' | 'mobile_money' | 'credit' {
  if (!val) return 'cash';
  const v = val.toLowerCase().trim();
  if (v.includes('bank') || v.includes('transfer') || v.includes('cbe') || v.includes('boa')) return 'bank_transfer';
  if (v.includes('telebirr') || v.includes('mobile') || v.includes('mpesa')) return 'mobile_money';
  if (v.includes('credit') || v.includes('debt') || v.includes('loan') || v.includes('unpaid')) return 'credit';
  return 'cash';
}

/**
 * Maps raw date to ISO date string or formatted date
 */
export function normalizeDate(val?: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) {
    return !isNaN(val.getTime()) ? val.toISOString() : new Date().toISOString();
  }
  if (typeof val === 'number') {
    // Check if Excel serial date number (typically between 25000 and 70000)
    if (val > 25000 && val < 70000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const dateMs = excelEpoch.getTime() + val * 86400000;
      return new Date(dateMs).toISOString();
    }
    if (val > 1e11) return new Date(val).toISOString();
    if (val > 1e8) return new Date(val * 1000).toISOString();
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return new Date().toISOString();
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
      const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
      const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
      const parsed = new Date(year, month, day, hour, min, sec);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Checks if a date string, timestamp, or Date correlates with the current date (recorded within 24 hours)
 */
export function isSaleWithin24Hours(dateVal?: string | Date | number | null): boolean {
  if (!dateVal) return false;

  let targetDate: Date;
  if (dateVal instanceof Date) {
    targetDate = dateVal;
  } else if (typeof dateVal === 'number') {
    targetDate = new Date(dateVal > 1e11 ? dateVal : dateVal * 1000);
  } else if (typeof dateVal === 'string') {
    const s = dateVal.trim();
    if (!s) return false;

    // Direct check if YYYY-MM-DD or DD/MM/YYYY matches today's calendar date
    const dateOnlyMatch = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/) || s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dateOnlyMatch) {
      const now = new Date();
      let y: number, m: number, d: number;
      if (dateOnlyMatch[1].length === 4) {
        y = parseInt(dateOnlyMatch[1], 10);
        m = parseInt(dateOnlyMatch[2], 10);
        d = parseInt(dateOnlyMatch[3], 10);
      } else {
        d = parseInt(dateOnlyMatch[1], 10);
        m = parseInt(dateOnlyMatch[2], 10);
        y = parseInt(dateOnlyMatch[3], 10);
      }
      if (y === now.getFullYear() && m === (now.getMonth() + 1) && d === now.getDate()) {
        return true;
      }
    }

    // Try standard ISO or parseable string
    targetDate = new Date(s);
  } else {
    return false;
  }

  if (isNaN(targetDate.getTime())) return false;

  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();

  // Within 24 hours (with 4 hour timezone leeway for client/server differences)
  const isTimeWithin24h = diffMs >= -4 * 3600 * 1000 && diffMs <= 24 * 3600 * 1000;

  // Also check if same calendar date in local timezone
  const isSameCalendarDay =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate();

  return isTimeWithin24h || isSameCalendarDay;
}


/**
 * Parse CSV or Excel file
 */
export async function parseSalesFromCsvOrExcel(file: File): Promise<ImportedSaleRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in file');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return [];
  }

  const results: ImportedSaleRecord[] = [];

  rawRows.forEach((row, idx) => {
    // Map normalized keys to values
    const map: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      map[normalizeKey(k)] = row[k];
    });

    const invoiceNumber =
      String(map['invoicenumber'] || map['invoiceno'] || map['invoice'] || map['invno'] || map['inv'] || map['billno'] || map['referencenumber'] || map['refno'] || map['ref'] || `IMP-${Date.now().toString().slice(-6)}-${idx + 1}`).trim();

    const dateVal = map['date'] || map['saledate'] || map['createdat'] || map['timestamp'] || map['time'];
    const saleDate = normalizeDate(dateVal);

    const customerName = String(map['customername'] || map['customer'] || map['clientname'] || map['client'] || map['buyer'] || map['name'] || 'Walk-in Customer').trim();
    const customerPhone = String(map['customerphone'] || map['phone'] || map['phonenumber'] || map['mobile'] || map['tel'] || '').trim();

    const productName = String(map['productname'] || map['product'] || map['itemname'] || map['item'] || map['description'] || 'General Sale').trim();
    const quantity = Math.max(1, Number(map['quantity'] || map['qty'] || map['count'] || map['units'] || 1));
    
    let totalAmount = Number(map['totalamount'] || map['total'] || map['amount'] || map['grandtotal'] || map['price'] || map['subtotal'] || 0);
    let unitPrice = Number(map['unitprice'] || map['price'] || map['rate'] || 0);

    if (totalAmount === 0 && unitPrice > 0) {
      totalAmount = unitPrice * quantity;
    } else if (unitPrice === 0 && totalAmount > 0) {
      unitPrice = totalAmount / quantity;
    }

    if (totalAmount <= 0) {
      totalAmount = 0;
      unitPrice = 0;
    }

    const paymentType = normalizePaymentType(map['paymenttype'] || map['paymentmethod'] || map['payment'] || map['method'] || map['type']);
    const locationName = String(map['locationname'] || map['location'] || map['store'] || map['branch'] || map['warehouse'] || map['shop'] || 'Main Store').trim();

    const advVal = Number(map['advancepayment'] || map['advance'] || map['paid'] || map['deposit'] || 0);
    const remVal = Number(map['remainingbalance'] || map['remaining'] || map['balance'] || map['debt'] || (paymentType === 'credit' ? Math.max(0, totalAmount - advVal) : 0));

    const statusVal = String(map['status'] || (remVal > 0 ? 'PARTIAL' : 'COMPLETED')).toUpperCase();
    const notes = String(map['notes'] || map['note'] || map['remarks'] || map['comment'] || `Imported from ${file.name}`).trim();

    // Skip empty filler rows
    if (totalAmount === 0 && customerName === 'Walk-in Customer' && !map['productname'] && !map['item']) {
      return;
    }

    results.push({
      id: `csv-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      invoiceNumber,
      saleDate,
      customerName,
      customerPhone: customerPhone || undefined,
      productName,
      quantity,
      unitPrice,
      totalAmount,
      paymentType,
      locationName,
      status: statusVal,
      advancePayment: advVal > 0 ? advVal : undefined,
      remainingBalance: remVal > 0 ? remVal : undefined,
      notes,
      source: file.name.endsWith('.csv') ? 'csv' : 'excel',
      isImported: true,
    });
  });

  return results;
}

/**
 * Pure-JS PDF text stream extractor using pako for FlateDecode decompression
 */
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(buffer);
  let binaryStr = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryStr += String.fromCharCode(bytes[i]);
  }

  const textLines: string[] = [];

  const extractBtEt = (str: string) => {
    const btMatches = str.matchAll(/BT[\s\S]*?ET/g);
    for (const m of btMatches) {
      const chunk = m[0];
      // Match (text) Tj
      const tjMatches = chunk.matchAll(/\(([\s\S]*?)\)\s*Tj/g);
      for (const tj of tjMatches) {
        const clean = tj[1].replace(/\\([()\\])/g, '$1').trim();
        if (clean) textLines.push(clean);
      }
      // Match [(text)...] TJ
      const tjArrMatches = chunk.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
      for (const tja of tjArrMatches) {
        let line = '';
        const inParens = tja[1].matchAll(/\(([\s\S]*?)\)/g);
        for (const item of inParens) {
          line += item[1].replace(/\\([()\\])/g, '$1') + ' ';
        }
        const clean = line.trim();
        if (clean) textLines.push(clean);
      }
      // Match (text)' or (text)"
      const quoteMatches = chunk.matchAll(/\(([\s\S]*?)\)\s*['"]/g);
      for (const q of quoteMatches) {
        const clean = q[1].replace(/\\([()\\])/g, '$1').trim();
        if (clean) textLines.push(clean);
      }
    }
  };

  // 1. Uncompressed streams
  extractBtEt(binaryStr);

  // 2. Compressed FlateDecode streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(binaryStr)) !== null) {
    const streamContent = match[1];
    try {
      const streamBytes = new Uint8Array(streamContent.length);
      for (let j = 0; j < streamContent.length; j++) {
        streamBytes[j] = streamContent.charCodeAt(j);
      }
      const decompressed = inflate(streamBytes);
      let decompStr = '';
      for (let k = 0; k < decompressed.length; k++) {
        decompStr += String.fromCharCode(decompressed[k]);
      }
      extractBtEt(decompStr);
    } catch (_) {
      // not a raw deflate stream or corrupted chunk; continue
    }
  }

  return textLines;
}

/**
 * Parses sales records from PDF file
 */
export async function parseSalesFromPdf(file: File): Promise<ImportedSaleRecord[]> {
  const buffer = await file.arrayBuffer();
  const rawTokens = await extractTextFromPdf(buffer);

  if (rawTokens.length === 0) {
    throw new Error('No readable text streams could be found in the PDF. Please ensure the PDF contains selectable text or export as CSV.');
  }

  const results: ImportedSaleRecord[] = [];

  // Strategy 1: Look for lines that contain numbers, amounts, dates, or invoice numbers
  // Combine nearby tokens into candidate rows
  const joinedText = rawTokens.join(' \n ');
  const lines = joinedText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Match common currency/number patterns: e.g. 1,250.00 or ETB 500 or 500.00
  const amountRegex = /(?:ETB|USD|EUR)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i;
  const invRegex = /(INV[-_A-Za-z0-9]+|BILL[-_0-9]+|SALE[-_0-9]+|#[0-9]{4,})/i;
  const dateRegex = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;

  let currentRecord: Partial<ImportedSaleRecord> | null = null;
  let rowCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If line has an invoice or strong header
    const invMatch = line.match(invRegex);
    const dateMatch = line.match(dateRegex);
    const amtMatch = line.match(amountRegex);

    if (invMatch || (dateMatch && amtMatch)) {
      if (currentRecord && (currentRecord.totalAmount || 0) > 0) {
        results.push(finalizeRecord(currentRecord, file.name, rowCounter++));
        currentRecord = null;
      }

      const rawAmt = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 0;
      currentRecord = {
        invoiceNumber: invMatch ? invMatch[1].replace('#', 'INV-') : `PDF-${Date.now().toString().slice(-5)}-${rowCounter}`,
        saleDate: dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString(),
        totalAmount: rawAmt > 0 ? rawAmt : 0,
        customerName: 'Walk-in Customer',
        productName: 'Imported Sale',
        quantity: 1,
        unitPrice: rawAmt > 0 ? rawAmt : 0,
        paymentType: normalizePaymentType(line),
        locationName: 'Main Store',
        status: 'COMPLETED',
        source: 'pdf',
        isImported: true,
      };
    } else if (currentRecord) {
      // Enrich current record with additional tokens from succeeding lines
      if (!currentRecord.totalAmount || currentRecord.totalAmount === 0) {
        if (amtMatch) {
          const amt = parseFloat(amtMatch[1].replace(/,/g, ''));
          if (amt > 0) {
            currentRecord.totalAmount = amt;
            currentRecord.unitPrice = amt / (currentRecord.quantity || 1);
          }
        }
      }
      if (currentRecord.customerName === 'Walk-in Customer') {
        const cleanName = line.replace(/[^a-zA-Z\s]/g, '').trim();
        if (cleanName.length > 2 && !cleanName.toLowerCase().includes('invoice') && !cleanName.toLowerCase().includes('total')) {
          currentRecord.customerName = cleanName;
        }
      }
    }
  }

  if (currentRecord && (currentRecord.totalAmount || 0) > 0) {
    results.push(finalizeRecord(currentRecord, file.name, rowCounter++));
  }

  // If table-based parser yielded few results, fallback to token scanner:
  if (results.length === 0) {
    // Scan token list for all numbers that look like prices/totals
    const foundAmounts = rawTokens
      .map((t) => {
        const m = t.match(amountRegex);
        return m ? parseFloat(m[1].replace(/,/g, '')) : null;
      })
      .filter((n): n is number => n !== null && n > 0 && n < 10000000);

    if (foundAmounts.length > 0) {
      foundAmounts.slice(0, 50).forEach((amt, idx) => {
        results.push({
          id: `pdf-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          invoiceNumber: `PDF-INV-${String(idx + 1).padStart(4, '0')}`,
          saleDate: new Date().toISOString(),
          customerName: 'Walk-in Customer',
          productName: `Sales Item #${idx + 1}`,
          quantity: 1,
          unitPrice: amt,
          totalAmount: amt,
          paymentType: 'cash',
          locationName: 'Main Store',
          status: 'COMPLETED',
          notes: `Extracted from PDF ${file.name}`,
          source: 'pdf',
          isImported: true,
        });
      });
    }
  }

  return results;
}

function finalizeRecord(partial: Partial<ImportedSaleRecord>, filename: string, idx: number): ImportedSaleRecord {
  const amt = Number(partial.totalAmount || 0);
  const qty = Math.max(1, Number(partial.quantity || 1));
  const unit = Number(partial.unitPrice || (amt > 0 ? amt / qty : 0));

  return {
    id: `pdf-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    invoiceNumber: partial.invoiceNumber || `PDF-INV-${Date.now().toString().slice(-5)}-${idx}`,
    saleDate: partial.saleDate || new Date().toISOString(),
    customerName: partial.customerName || 'Walk-in Customer',
    customerPhone: partial.customerPhone,
    productName: partial.productName || 'Imported Sale Record',
    quantity: qty,
    unitPrice: unit,
    totalAmount: amt,
    paymentType: partial.paymentType || 'cash',
    locationName: partial.locationName || 'Main Store',
    status: partial.status || 'COMPLETED',
    advancePayment: partial.advancePayment,
    remainingBalance: partial.remainingBalance,
    source: 'pdf',
    isImported: true,
  };
}


/**
 * Downloads a sample template file for users to populate and import sales
 */
export function downloadSampleSalesTemplate(format: 'csv' | 'xlsx' = 'csv'): void {
  const headers = ['Invoice Number', 'Date', 'Customer Name', 'Customer Phone', 'Product Name', 'Quantity', 'Unit Price', 'Total Amount', 'Payment Type', 'Location', 'Notes'];
  
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDateTime = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // 1. Current timestamp (within last 24h -> automatically added to Today's Sales)
  const todaySale1 = formatDateTime(now);
  // 2. Two hours ago (within last 24h -> automatically added to Today's Sales)
  const todaySale2 = formatDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000));
  // 3. Two days ago (outside 24h -> included in total sales and reports, but not Today's Sales)
  const pastSale = formatDateTime(new Date(now.getTime() - 48 * 60 * 60 * 1000));

  const sampleData = [
    headers,
    ['INV-2026-001', todaySale1, 'Abebe Kebede', '0911223344', 'Cement 50kg Dangote', '10', '850.00', '8500.00', 'cash', 'Main Store', "Recorded today (within 24h) - added to Today's Sales"],
    ['INV-2026-002', todaySale2, 'Tadesse Alemu', '0922334455', 'Iron Bar 12mm', '25', '620.00', '15500.00', 'bank_transfer', 'Main Store', "Recorded 2h ago (within 24h) - added to Today's Sales"],
    ['INV-2026-003', pastSale, 'Almaz Worku', '0933445566', 'Paint Bucket 20L', '2', '2400.00', '4800.00', 'mobile_money', 'Branch B', 'Historical sale (48h ago) - included in Sales Report only'],
  ];

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Import Template');
    XLSX.writeFile(wb, 'sales_import_sample_template.xlsx');
  } else {
    const csvContent = sampleData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sales_import_sample_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

