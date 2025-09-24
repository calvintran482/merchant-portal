import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for relative file access
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// In-memory store for voucher codes
const store = new Map();

// Path for persisted redemption data
const redeemedFilePath = path.join(rootDir, 'redeemed.json');

/**
 * Read redeemed codes from disk and return a Set<string>
 */
function readRedeemedSet() {
  try {
    if (fs.existsSync(redeemedFilePath)) {
      const raw = fs.readFileSync(redeemedFilePath, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(String));
      }
    }
  } catch (_) {
    /* ignore read/parse errors, treat as empty */
  }
  return new Set();
}

/**
 * Persist redeemed codes set to disk
 * @param {Set<string>} set
 */
function writeRedeemedSet(set) {
  try {
    const arr = Array.from(set);
    fs.writeFileSync(redeemedFilePath, JSON.stringify(arr, null, 2));
  } catch (err) {
    console.error('Failed to write redeemed.json:', err);
  }
}

/**
 * Apply redeemed.json statuses to the in-memory store
 */
function applyRedeemedFromFile() {
  const redeemed = readRedeemedSet();
  redeemed.forEach(code => {
    const v = store.get(code);
    if (v) {
      v.status = 'redeemed';
      if (!v.redeemedAt) v.redeemedAt = new Date().toISOString();
    }
  });
}

// --- Reservation settings ---------------------------------------------------
// How long a reservation stays active (e.g. 2 minutes)
const RESERVE_TTL_MS = 2 * 60 * 1000;

function isReservationActive(voucher) {
  return (
    voucher.reservedAt &&
    Date.now() - voucher.reservedAt < RESERVE_TTL_MS
  );
}

// Track if codes have been loaded
let codesLoaded = false;

/**
 * Load voucher codes from environment variable or CSV file
 * @returns {number} Number of codes loaded
 */
export function loadCodes() {
  // Only load once (idempotent)
  if (codesLoaded) {
    return store.size;
  }

  // First try to load from CODES env var
  if (process.env.CODES) {
    const codes = process.env.CODES.split(',')
      .map(code => code.trim())
      .filter(Boolean);
    
    // Add unique codes to store
    codes.forEach(code => {
      if (!store.has(code)) {
        store.set(code, { status: 'active' });
      }
    });
    
    console.log(`Loaded ${codes.length} codes from environment variable`);
    applyRedeemedFromFile();
    codesLoaded = true;
    return store.size;
  }

  // Then try to load from CSV file
  const csvFilePath = path.join(rootDir, 'codes.csv');
  
  try {
    if (fs.existsSync(csvFilePath)) {
      const fileContent = fs.readFileSync(csvFilePath, 'utf8');
      const codes = fileContent.split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      
      // Add unique codes to store
      codes.forEach(code => {
        if (!store.has(code)) {
          store.set(code, { status: 'active' });
        }
      });
      
      console.log(`Loaded ${codes.length} codes from CSV file`);
      applyRedeemedFromFile();
      codesLoaded = true;
      return store.size;
    }
  } catch (error) {
    console.error('Error loading codes from CSV:', error);
  }

  // Seed with sample codes if no file exists or loading failed
  const sampleCodes = [
    'COCA001', 'COCA002', 'COCA003', 'COCA004', 'COCA005',
    'COCA006', 'COCA007', 'COCA008', 'COCA009', 'COCA010',
    'valid'  // This matches the example in the UI
  ];
  
  sampleCodes.forEach(code => {
    store.set(code, { status: 'active' });
  });
  
  console.log(`Seeded ${sampleCodes.length} sample codes`);
  applyRedeemedFromFile();
  codesLoaded = true;
  return store.size;
}

/**
 * Validate a voucher code
 * @param {string} code The code to validate
 * @returns {Object} Result with exists and redeemed flags
 */
export function validate(code) {
  // Ensure codes are loaded
  if (!codesLoaded) {
    loadCodes();
  }
  
  if (!code) {
    return { exists: false, redeemed: false };
  }
  
  const normalizedCode = code.trim();
  const voucherData = store.get(normalizedCode);
  
  if (!voucherData) {
    return { exists: false, redeemed: false };
  }
  
  return { 
    exists: true, 
    redeemed: voucherData.status === 'redeemed' 
  };
}

/**
 * Validate and reserve a voucher for a specific cashier
 * Prevents another cashier from redeeming it for a short period
 * @param {string} code
 * @param {string} cashierId
 * @returns {Object} validation object
 */
export function validateAndReserve(code, cashierId) {
  // Ensure codes are loaded
  if (!codesLoaded) {
    loadCodes();
  }

  if (!code) {
    return { exists: false, redeemed: false };
  }

  const normalizedCode = code.trim();
  const voucher = store.get(normalizedCode);

  if (!voucher) {
    return { exists: false, redeemed: false };
  }

  // Already redeemed
  if (voucher.status === 'redeemed') {
    return { exists: true, redeemed: true };
  }

  // Someone else’s active reservation
  if (
    isReservationActive(voucher) &&
    voucher.reservedBy &&
    voucher.reservedBy !== cashierId
  ) {
    return {
      exists: true,
      redeemed: false,
      reserved: true,
      reservedBy: voucher.reservedBy
    };
  }

  // Reserve for this cashier
  voucher.reservedBy = cashierId;
  voucher.reservedAt = Date.now();

  return {
    exists: true,
    redeemed: false,
    reserved: true,
    reservedBy: cashierId
  };
}

/**
 * Redeem a voucher code
 * @param {string} code The code to redeem
 * @returns {Object} Result with ok and already flags
 */
export function redeem(code) {
  // Ensure codes are loaded
  if (!codesLoaded) {
    loadCodes();
  }
  
  if (!code) {
    return { ok: false, already: false };
  }
  
  const normalizedCode = code.trim();
  const voucherData = store.get(normalizedCode);
  
  if (!voucherData) {
    return { ok: false, already: false };
  }
  
  if (voucherData.status === 'redeemed') {
    return { ok: true, already: true };
  }

  // Mark as redeemed
  voucherData.status = 'redeemed';
  voucherData.redeemedAt = new Date().toISOString();
  // Clear reservation markers
  delete voucherData.reservedBy;
  delete voucherData.reservedAt;

  // Persist redemption to disk
  const redeemedSet = readRedeemedSet();
  redeemedSet.add(normalizedCode);
  writeRedeemedSet(redeemedSet);
  
  return { ok: true, already: false };
}

/**
 * ADMIN: Reset all redemption state.
 * Marks every loaded voucher as active again and clears redeemed.json.
 * @returns {boolean} true on success, false on failure
 */
export function resetRedemptions() {
  try {
    // Ensure store is populated
    if (!codesLoaded) {
      loadCodes();
    }

    // Reset in-memory data
    store.forEach(v => {
      v.status = 'active';
      delete v.redeemedAt;
      delete v.reservedBy;
      delete v.reservedAt;
    });

    // Persist empty redeemed set on disk
    writeRedeemedSet(new Set());
    return true;
  } catch (err) {
    console.error('Failed to reset redemptions:', err);
    return false;
  }
}

// Load codes on module import
loadCodes();
