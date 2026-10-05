/**
 * Code Normalization Engine for PalmTrace Enterprise
 * Standardizes Sector, Plot, and Tree/Palm codes across all imports and manual forms.
 */

function normalizeSectorCode(code) {
  if (!code) return '';
  let cleaned = String(code).trim().toUpperCase();
  // Remove special prefixes or whitespace
  cleaned = cleaned.replace(/\s+/g, '');
  
  // Transform alphanumeric suffix: BSH1 -> BSH01, SEC2 -> SEC02, BSh1 -> BSH01
  cleaned = cleaned.replace(/([A-Z\u0600-\u06FF]+)(\d+)$/, (match, prefix, num) => {
    return `${prefix}${num.padStart(2, '0')}`;
  });
  
  // Pure numeric: "1" -> "01", "4" -> "04"
  if (/^\d+$/.test(cleaned)) {
    cleaned = cleaned.padStart(2, '0');
  }
  
  return cleaned;
}

function normalizePlotCode(code) {
  if (!code) return '';
  let cleaned = String(code).trim().toUpperCase();
  cleaned = cleaned.replace(/\s+/g, '');
  
  // If code has sector prefix like BSH01-1A or 01-1A or BSh1-1A
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const secPart = normalizeSectorCode(parts[0]);
    const rest = parts.slice(1).map(p => normalizePlotCode(p)).join('-');
    return `${secPart}-${rest}`;
  }
  
  // Match number + optional letter: 1 -> 01, 1A -> 01A, 2B -> 02B
  const m = cleaned.match(/^(\d+)([A-Z\u0600-\u06FF]*)$/);
  if (m) {
    return `${m[1].padStart(2, '0')}${m[2] || ''}`;
  }
  
  return cleaned;
}

function normalizePalmCode(code) {
  if (!code) return '';
  let cleaned = String(code).trim().toUpperCase();
  cleaned = cleaned.replace(/\s+/g, '');
  
  // Palm code format: SEC-PLOT-SRCSEQ-DATE (e.g. BSH01-1A-F01-0926 or BSh1-1A-F01-0926)
  const parts = cleaned.split('-');
  if (parts.length >= 4) {
    const sec = normalizeSectorCode(parts[0]);
    const plot = normalizePlotCode(parts[1]);
    const rest = parts.slice(2).join('-');
    return `${sec}-${plot}-${rest}`;
  } else if (parts.length === 3) {
    // SEC-PLOT-SEQ
    const sec = normalizeSectorCode(parts[0]);
    const plot = normalizePlotCode(parts[1]);
    return `${sec}-${plot}-${parts[2]}`;
  }
  return cleaned;
}

module.exports = {
  normalizeSectorCode,
  normalizePlotCode,
  normalizePalmCode
};
