import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const statsFile = path.join(rootDir, 'stats.json');

function readStats() {
  try {
    if (fs.existsSync(statsFile)) {
      const raw = fs.readFileSync(statsFile, 'utf8');
      const data = JSON.parse(raw);
      return (data && typeof data === 'object') ? data : {};
    }
  } catch (_) {}
  return {};
}

function writeStats(obj) {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to write stats.json:', err);
  }
}

export function getCount(cashierId) {
  if (!cashierId) return 0;
  const stats = readStats();
  const v = stats[cashierId];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function incrementCount(cashierId, delta = 1) {
  if (!cashierId) return 0;
  const stats = readStats();
  const current = typeof stats[cashierId] === 'number' ? stats[cashierId] : 0;
  const next = current + (Number.isFinite(delta) ? delta : 1);
  stats[cashierId] = next;
  writeStats(stats);
  return next;
}

// ---- admin / maintenance helpers ------------------------------------------

/**
 * Reset all persisted stats (e.g. when starting fresh for production)
 * Overwrites stats.json with an empty object.
 * @returns {boolean} true on success, false on failure
 */
export function resetStats() {
  try {
    writeStats({});
    return true;
  } catch (_) {
    return false;
  }
}
