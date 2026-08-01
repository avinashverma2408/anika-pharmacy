import React, { useState, useRef } from "react";
import { usePharmacyStore, showSimpleToast } from "../store/usePharmacyStore";
import { medicineApi, ocrApi } from "../api/apiClient";

const loadTesseractScript = () => {
  return new Promise((resolve) => {
    if (window.Tesseract) return resolve(window.Tesseract);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
};

/**
 * Preprocess bill image before OCR:
 * 1) rotate upright
 * 2) upscale / zoom small photos so tiny print is readable
 * 3) mild contrast boost on grayscale canvas
 */
const OCR_MIN_LONG_SIDE = 2200;
const OCR_MAX_LONG_SIDE = 3600;
const OCR_ZOOM_FACTOR = 2.2;

const prepareImageForOcr = (fileObj, rotationDeg = 0) => {
  return new Promise((resolve) => {
    if (!fileObj) return resolve(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(fileObj);

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);

        const rad = ((rotationDeg % 360) * Math.PI) / 180;
        const swapped = Math.abs(rotationDeg % 360) % 180 !== 0;
        const baseW = swapped ? img.height : img.width;
        const baseH = swapped ? img.width : img.height;
        const longSide = Math.max(baseW, baseH);

        // Zoom up small phone photos; cap very large images for memory
        let scale = OCR_ZOOM_FACTOR;
        if (longSide * scale < OCR_MIN_LONG_SIDE) {
          scale = OCR_MIN_LONG_SIDE / longSide;
        }
        if (longSide * scale > OCR_MAX_LONG_SIDE) {
          scale = OCR_MAX_LONG_SIDE / longSide;
        }
        // Already huge — still apply a light zoom if under min
        scale = Math.max(1, scale);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(baseW * scale);
        canvas.height = Math.round(baseH * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(fileObj);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (rad !== 0) ctx.rotate(rad);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();

        // Mild contrast / grayscale — helps Tesseract on faded print
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const contrast = 1.18;
          const intercept = 128 * (1 - contrast);
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const v = Math.max(0, Math.min(255, gray * contrast + intercept));
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
          }
          ctx.putImageData(imageData, 0, 0);
        } catch {
          // Ignore if canvas is tainted / too large
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(fileObj);
            resolve(
              new File([blob], fileObj.name.replace(/\.\w+$/, "") + "-ocr.png", {
                type: "image/png",
              }),
            );
          },
          "image/png",
          1,
        );
      } catch {
        resolve(fileObj);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(fileObj);
    };

    img.src = objectUrl;
  });
};

/** @deprecated kept as thin wrapper for any older callers */
const getRotatedFile = (fileObj, rotationDeg) =>
  prepareImageForOcr(fileObj, rotationDeg);

/**
 * Detect unreadable OCR. Table pipes (|) are normal on tax invoices — do not treat as garbage.
 */
function getOcrQuality(rawText) {
  const text = String(rawText || "");
  const len = Math.max(1, text.length);
  const priceHits = (text.match(/\d+[.,]\d{2}/g) || []).length;
  const letterCount = (text.match(/[A-Za-z]/g) || []).length;
  const weirdCount = (text.match(/[§£¢©®°¥€¿¡□■◆▲►◄]/g) || []).length;
  const hsnHits = (text.match(/\b(?:3004|3003|3006|3005|2106|9018|9021)\d{0,4}\b/g) || []).length;
  const batchHits = (text.match(/\b[A-Z]{1,6}\d{2,14}[A-Z0-9]*\b/g) || []).length;
  const expHits = (text.match(/\b\d{1,2}[\/\-]\d{2,4}\b/g) || []).length;
  const hasInvoiceMarkers =
    /TAX\s*INVOICE|Description Of Goods|GST\s*No|Inv\.?\s*No|SUB\s*TOTAL|KETOROL|EYE DROP|TAB\b/i.test(
      text,
    );
  const letterRatio = letterCount / len;
  const weirdRatio = weirdCount / len;

  const usable =
    (priceHits >= 3 && letterRatio >= 0.18 && weirdRatio <= 0.1) ||
    (priceHits >= 2 && hsnHits >= 2 && weirdRatio <= 0.12) ||
    (priceHits >= 4 && hasInvoiceMarkers && weirdRatio <= 0.12) ||
    // Batch/expiry heavy bills where HSN OCR failed
    (priceHits >= 3 && batchHits >= 2 && expHits >= 2 && weirdRatio <= 0.12);

  return { usable, priceHits, letterRatio, weirdRatio, hsnHits };
}

function cleanMedicineName(raw) {
  return String(raw || "")
    .replace(/^(?:\d+\.?\s*)?/, "")
    .replace(/\b(TAB|TABS|TABLET|TABLETS|CAP|CAPS|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|GEL|DROP|DROPS|VAIL|VIAL|PACK|HSN|QTY|MRP|PTR|NET|BATCH|EXP|EXPIRY|NOS|BOX|STRIP|STRIPS)\b/gi, " ")
    .replace(/[^A-Za-z0-9\s%+./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlausibleMedicineName(name) {
  if (!name || name.length < 3 || name.length > 60) return false;
  if (
    /BASEMENT|SHOP|PHONE|MAIL|GMAIL|CONTACT|ACCOUNT|DISPUTED|IFSC|BANK|TERMS|ROUND|TOTAL|INVOICE|GSTIN|ADDRESS|DESCRIPTION|GOODS|AUTHORISED|PHARMACY|LICENCE/i.test(
      name,
    )
  ) {
    return false;
  }

  const compact = name.replace(/\s+/g, "");
  const letters = (compact.match(/[A-Za-z]/g) || []).length;
  if (letters < 3) return false;
  if (letters / Math.max(1, compact.length) < 0.5) return false;

  const tokens = name.split(/\s+/).filter(Boolean);
  const shortTokens = tokens.filter((t) => t.length <= 1).length;
  if (tokens.length >= 3 && shortTokens / tokens.length >= 0.5) return false;

  return true;
}

/** Common Indian pharmacy HSN prefixes (4–8 digits). Optional — OCR may miss HSN. */
const HSN_RE = /\b((?:3004|3003|3006|3005|2106|9018|9021)\d{0,4})\b/;
const BATCH_RE =
  /\b([A-Z]{1,6}\d{2,14}[A-Z0-9]*|\d{5,14}[A-Z]|\d{1,4}[A-Z]{1,6}\d{1,10}|E\d{5,12})\b/i;
const EXP_RE = /\b(\d{1,2}[\/\-]\d{2,4})\b/;
/** Packs: 1*10, 1*200M, 1*10TA, 10GM, 15ML (OCR often truncates unit letters) */
const PACK_RE =
  /\b(\d+\s*[xX*×+]\s*\d+[A-Za-z]{0,6}|\d+\s*(?:GM|ML|TAB|TABS|CAPS?|STRIP|NOS?|SACHET))\b/i;
/** Dose like 50/5 — not expiry (11/28) where the part after / is a 2-digit year */
const DOSE_RATIO_RE = /\b(\d{1,3}\s*\/\s*\d(?:\.\d+)?)\b/;
const DOSE_MG_RE = /\b(\d+\s*MG)\b/i;
const COMMON_STRENGTHS = new Set([50, 75, 100, 120, 125, 150, 200, 250, 400, 500, 625, 650, 1000]);
const GST_RATES = new Set([0, 5, 12, 18]);

/** Header/footer noise — generic (not store-specific). */
const BILL_NOISE_RE =
  /ACCOUNT|ACC\s*NO|IFSC|STATE BANK|BANK DETAIL|DISPUTED|JURISDICTION|INTEREST|ROUND\s*OFF|GRAND\s*TOTAL|SUB\s*TOTAL|SUBTOTAL|TAXABLE|TERMS\s*&|DECLARATION|AUTHORISED|SIGNATORY|RECEIPT|DISPATCH|DUE\s*DATE|EWAY|BASEMENT|SHOP\s*NO|E-?Mail|GMAIL|EMAIL|Phone\s*:|MOBILE|CONTACT|FOOD\s*LICEN[CS]E|Description\s*Of\s*Goods|TAX\s*INVOICE|Book\s*No|GSTIN|DL\s*\.?\s*No|PAN\s*:|State\s*:|Page\s*\d/i;

function normalizeInvoiceLine(line) {
  return String(line || "")
    .replace(/[\[\]{}()<>§]/g, " ")
    .replace(/\|/g, " ")
    .replace(/[~“”"'`«»]/g, " ")
    // Pack multipliers only between digits — never rewrite letters in names (CIPLOX)
    .replace(/[¥%]/g, "*")
    .replace(/(\d)\s*[xX×*+]\s*(\d+)/g, "$1*$2")
    // 1*200M / 1*10TA / 1*200T → 1*200 / 1*10 (keep pack, drop OCR unit junk)
    .replace(/\b(\d+\*\d+)[A-Za-z]{1,6}\b/g, "$1")
    .replace(/\b(\d+\*\d+)\s*(TAB|TABS|CAPS?|STRIP|ML|GM|NOS?)s?\b/gi, "$1")
    // HSN glued to pack/batch: 1*175 30045033l61 / 30039012/14261561A
    .replace(/\b((?:3004|3003|3006|3005|2106|9018|9021)\d{0,4})[\/\\|lI]\s*/gi, "$1 ")
    .replace(/\b((?:3004|3003|3006|3005|2106|9018|9021)\d{0,4})(?=[A-Za-z])/gi, "$1 ")
    .replace(/\.?\bTAB\b/gi, " TAB ")
    .replace(/\bioML\b/gi, "10ML")
    .replace(/\bS00\b/gi, "5.00")
    .replace(/\bEs\.?\b/gi, " ")
    .replace(/\bIFIL\b/gi, " ")
    .replace(/(\d),(\d{2})\b/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

function guessCategory(lineText, medName) {
  const src = `${lineText} ${medName}`;
  if (/CAP|CAPSULE/i.test(src)) return "Capsule";
  if (/SYP|SYRUP|DROP|LIQUID|LOTION|MOUTH/i.test(src)) return "Syrup";
  if (/INJ|INJECTION|IV|VAIL|VIAL|SYRING/i.test(src)) return "Injection";
  if (/GEL|CREAM|OINT|OINTMENT/i.test(src)) return "Ointment";
  return "Tablet";
}

function parseExpiryToIso(raw) {
  if (!raw) {
    return new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
  }
  const parts = String(raw).split(/[\/\-]/);
  if (parts.length !== 2) {
    return new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
  }
  const month = parts[0].padStart(2, "0");
  const year = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
  return `${year}-${month}-28`;
}

/** OCR often drops decimals: 2650→26.50, 350→3.50, 475→4.75 */
function coerceInvoiceNumber(token, roleHint = "") {
  const raw = String(token || "").replace(/,/g, "");
  if (!raw) return null;
  if (raw.includes(".")) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);

  if (roleHint === "disc" && n >= 100 && n <= 4000) {
    return parseFloat((n / 100).toFixed(2));
  }

  if (roleHint === "money" || roleHint === "rate") {
    if (raw.length === 4) return parseFloat((n / 100).toFixed(2));
    if (raw.length === 3 && /[05]0$/.test(raw) && n <= 500) {
      return parseFloat((n / 100).toFixed(2));
    }
  }

  return n;
}

function extractPackFromText(text) {
  const multi = String(text || "").match(/\b(\d+\s*\*\s*\d+)\b/);
  if (multi) return multi[1].replace(/\s+/g, "");
  const unit = String(text || "").match(/\b(\d+\s*(?:GM|ML|TAB|TABS|CAPS?|STRIP|NOS?|SACHET))\b/i);
  if (unit) return unit[1].replace(/\s+/g, "").toUpperCase();
  return "1*10";
}

function cleanParsedMedName(raw) {
  return String(raw || "")
    .replace(/^\d+[\).:\-\s]+/, "")
    .replace(/^[a-z]{1,3}\s+/i, "") // OCR junk prefix ("gd ")
    .replace(EXP_RE, " ")
    .replace(BATCH_RE, " ")
    .replace(HSN_RE, " ")
    // Trailing pack/OCR fragments: 200M, 10TA, l61
    .replace(/\b\d{2,}[A-Za-z]{1,4}\b/g, " ")
    .replace(/\b[lI]\d{1,4}\b/g, " ")
    .replace(/\b(PACK|FIL|FREE|HSN|SAC|QTY|MRP|PTR|RATE|AMT|AMOUNT|NET|GST|CGST|SGST)\b/gi, " ")
    .replace(/[^A-Za-z0-9\s%+./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\s+[A-Za-z])+$/g, "")
    .replace(/\s*\.+\s*$/g, "")
    .trim();
}

/**
 * Strip known anchors from a line, then leftover letter tokens ≈ medicine name.
 * Works whether HSN/pack/batch appear before OR after the name.
 * Preserves strengths like 50/5 and 5MG (not expiry dates).
 */
function extractMedicineName(line) {
  let src = normalizeInvoiceLine(line)
    .replace(/^[a-z]{1,3}\s+(?=\d)/i, "")
    .replace(/^\d+[\).:\-\s]+/, "");
  const kept = [];
  src = src.replace(DOSE_RATIO_RE, (_, s) => {
    kept.push(s.replace(/\s+/g, ""));
    return ` __S${kept.length - 1}__ `;
  });
  src = src.replace(DOSE_MG_RE, (_, s) => {
    kept.push(s.replace(/\s+/g, "").toUpperCase());
    return ` __S${kept.length - 1}__ `;
  });
  // Bare strengths after brand: DOLO 650, AZITHRO 500, TRENEXA 500
  src = src.replace(/([A-Za-z])\s+(\d{2,4})\b/g, (full, letter, n) => {
    if (!COMMON_STRENGTHS.has(Number(n))) return full;
    kept.push(n);
    return `${letter} __S${kept.length - 1}__ `;
  });

  src = src
    .replace(HSN_RE, " ")
    .replace(EXP_RE, " ")
    .replace(BATCH_RE, " ")
    // Numeric-only batch between HSN-area and expiry (e.g. 111006)
    .replace(/\b(\d{5,8})\b(?=\s+\d{1,2}[\/\-]\d{2,4})/g, " ")
    .replace(PACK_RE, " ")
    .replace(/\b\d+\s*\*\s*\d+\b/g, " ")
    .replace(/\b\d+(?:\.\d{1,3})?\b/g, " ")
    .replace(/\bTAB\b|\bCAPS?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  kept.forEach((s, i) => {
    src = src.replace(`__S${i}__`, s);
  });

  return cleanParsedMedName(src).replace(/\s*\/\s*$/g, "").trim();
}

/**
 * Infer qty / rate / disc / gst / mrp from number tokens in ANY column order.
 * Prefers qty→rate where rate is real money (not GST 5% / disc).
 */
function inferNumberRoles(line) {
  let work = normalizeInvoiceLine(line)
    .replace(/^[a-z]{1,3}\s+(?=\d)/i, "")
    .replace(/^\d+[\).:\-\s]+/, "")
    .replace(HSN_RE, " ")
    .replace(EXP_RE, " ")
    .replace(PACK_RE, " ")
    .replace(/\b\d+\s*\*\s*\d+\b/g, " ")
    .replace(DOSE_RATIO_RE, " ")
    .replace(DOSE_MG_RE, " ")
    .replace(BATCH_RE, " ")
    .replace(/\b(\d{5,8})\b(?=\s+\d{1,2}[\/\-]\d{2,4})/g, " ");

  // Drop bare strengths that sit beside letters (already in name)
  work = work.replace(/([A-Za-z])\s+(\d{2,4})\b/g, (full, letter, n) =>
    COMMON_STRENGTHS.has(Number(n)) ? letter : full,
  );

  const rawNums = work.match(/\d+(?:\.\d{1,2})?/g) || [];
  if (rawNums.length < 2) return null;

  const parsed = rawNums.map((raw) => {
    const hasDot = raw.includes(".");
    const asQty = coerceInvoiceNumber(raw, "qty");
    const asRate = coerceInvoiceNumber(raw, "rate");
    return {
      raw,
      hasDot,
      intish: !hasDot || /\.0+$/.test(raw),
      asQty,
      asRate,
    };
  });

  const isQtyLike = (p) =>
    p.asQty != null &&
    p.asQty >= 1 &&
    p.asQty <= 500 &&
    (p.intish || p.asQty === Math.round(p.asQty)) &&
    !COMMON_STRENGTHS.has(p.asQty);
  const isRateLike = (p) => p.asRate != null && p.asRate >= 1 && p.asRate < 20000;
  const isGstVal = (v) => GST_RATES.has(v);
  const isDiscVal = (v) => v != null && v > 0 && v <= 40 && !GST_RATES.has(v);

  // Score qty→rate candidates — never treat GST%/tiny disc as PTR
  let best = null;
  for (let i = 0; i < parsed.length - 1; i++) {
    if (!isQtyLike(parsed[i]) && !(parsed[i].asQty >= 1 && parsed[i].asQty <= 100 && parsed[i].intish)) {
      continue;
    }
    const qtyCand = parsed[i];
    const qtyVal = qtyCand.asQty;
    if (COMMON_STRENGTHS.has(qtyVal) && !(parsed[i + 1] && parsed[i + 1].hasDot)) continue;

    let rateIdx = i + 1;
    // qty, free, rate — free is a small bonus qty, never GST% (0/5/12/18)
    if (
      parsed[i + 2] &&
      parsed[i + 1].asQty != null &&
      parsed[i + 1].asQty <= 50 &&
      parsed[i + 1].intish &&
      !isGstVal(parsed[i + 1].asQty) &&
      isRateLike(parsed[i + 2]) &&
      (parsed[i + 2].hasDot || String(parsed[i + 2].raw).length >= 3) &&
      !isGstVal(parsed[i + 2].asRate) &&
      parsed[i + 2].asRate >= 8
    ) {
      rateIdx = i + 2;
    } else if (!isRateLike(parsed[i + 1])) {
      continue;
    }

    const rate = parsed[rateIdx].asRate;
    if (rate == null || rate < 1) continue;
    // Don't accept GST column as PTR
    if (isGstVal(rate)) continue;

    let score = 0;
    if (parsed[rateIdx].hasDot) score += 10;
    else if (/^\d{3,4}$/.test(parsed[rateIdx].raw)) score += 14;
    if (qtyVal <= 100) score += 5;
    if (qtyVal <= 30) score += 5;
    if (qtyVal > 50) score -= 12; // amounts mistaken as qty
    if (qtyVal > 100) score -= 20;
    if (COMMON_STRENGTHS.has(qtyVal)) score -= 12;
    if (qtyCand.hasDot && /\.0+$/.test(qtyCand.raw)) score += 4;
    if (rate > 0 && rate < 8) score -= 8;
    if (rate >= 20) score += 6;
    if (rate >= 40) score += 4;
    // Typical columns after PTR: disc% then GST% (0/5/12/18)
    const a1 = parsed[rateIdx + 1];
    const a2 = parsed[rateIdx + 2];
    if (a1 && (isGstVal(a1.asRate) || isDiscVal(a1.asRate) || a1.asRate === 0)) score += 14;
    if (a2 && isGstVal(a2.asRate)) score += 10;
    score += Math.max(0, 6 - i * 2);

    if (!best || score > best.score) {
      best = { score, qty: Math.round(qtyVal), ptr: rate, startAfter: rateIdx + 1 };
    }
  }

  let qty;
  let ptr;
  let startAfter;

  if (best && best.score >= 5) {
    qty = best.qty;
    ptr = best.ptr;
    startAfter = best.startAfter;
  } else {
    // Fallback: first qty-like + first non-GST money with decimal
    const moneys = parsed.filter(
      (p) => isRateLike(p) && (p.hasDot || String(p.raw).length >= 3) && !isGstVal(p.asRate) && p.asRate >= 8,
    );
    const qtys = parsed.filter(isQtyLike);
    if (!moneys.length) return null;
    ptr = moneys[0].asRate;
    qty = qtys.length ? Math.round(qtys[0].asQty) : 1;
    startAfter = parsed.indexOf(moneys[0]) + 1;
  }

  let disc = 0;
  let gstRate = 5;
  const moneyVals = [];

  for (let i = startAfter; i < parsed.length; i++) {
    const p = parsed[i];
    const v = p.asRate != null ? p.asRate : p.asQty;
    if (v == null) continue;
    if (isGstVal(v) && (p.intish || p.hasDot)) {
      gstRate = v === 0 ? gstRate : v;
      continue;
    }
    if (isDiscVal(v) && disc === 0) {
      disc = v;
      continue;
    }
    if (v > 1 && v < 100000) moneyVals.push(v);
  }

  let mrp = 0;
  if (moneyVals.length >= 2) {
    const ge = moneyVals.filter((m) => m >= ptr);
    mrp = ge.length ? ge[ge.length - 1] : moneyVals[moneyVals.length - 1];
  } else if (moneyVals.length === 1) {
    mrp = Math.max(ptr, moneyVals[0]);
  } else {
    mrp = ptr;
  }
  if (mrp < ptr) mrp = ptr;

  qty = Math.max(1, Math.round(Number(qty) || 1));
  if (qty > 500) qty = 1;

  return { qty, ptr, disc, gstRate, mrp };
}

/**
 * Format-agnostic medicine row parser.
 * Every store prints columns differently — we anchor on field TYPES (name, pack,
 * HSN, batch, expiry, money), not on a single fixed column layout.
 */
function parseMedicineLineAnyFormat(line, idx) {
  const t = normalizeInvoiceLine(line);
  if (t.length < 8) return null;
  if (BILL_NOISE_RE.test(t) && !HSN_RE.test(t) && !BATCH_RE.test(t)) return null;

  const medName = extractMedicineName(t);
  if (!isPlausibleMedicineName(medName)) return null;

  // Need some evidence this is a product row, not an address
  const hasPrice = /\d+(?:\.\d{1,2})?/.test(t);
  const hasExp = EXP_RE.test(t);
  const hasBatch = BATCH_RE.test(t);
  const hasHsn = HSN_RE.test(t);
  const hasPack = PACK_RE.test(t) || /\d+\*\d+/.test(t);
  if (!hasPrice) return null;
  if (!(hasHsn || hasExp || hasBatch || hasPack)) {
    // Still allow if there are multiple money values + a solid name
    const moneyHits = (t.match(/\d+\.\d{2}/g) || []).length;
    if (moneyHits < 2) return null;
  }

  const roles = inferNumberRoles(t);
  if (!roles || !roles.ptr || roles.ptr <= 0) return null;

  const hsnMatch = t.match(HSN_RE);
  const expMatch = t.match(EXP_RE);
  const batchMatch =
    t.match(BATCH_RE) ||
    t.match(/\b(\d{5,8})\b(?=\s+\d{1,2}[\/\-]\d{2,4})/);

  return {
    id: Date.now() + idx,
    name: medName.slice(0, 50),
    category: guessCategory(t, medName),
    batch: batchMatch ? batchMatch[1].toUpperCase() : `B-${100 + idx}`,
    price: Math.max(0.01, parseFloat(roles.mrp) || parseFloat(roles.ptr) || 10),
    ptr: Math.max(0.01, parseFloat(roles.ptr) || 0),
    quantity: roles.qty,
    expiryDate: parseExpiryToIso(expMatch?.[1]),
    hsn: hsnMatch ? hsnMatch[1] : "3004",
    pack: extractPackFromText(t),
    gstRate: roles.gstRate || 5,
    discountPercent: roles.disc || 0,
    composition: "",
    status: "Active",
  };
}

function isLikelyMedicineLine(line) {
  if (!line || line.length < 8) return false;
  if ((line.match(/[£¢§©®°¥€]/g) || []).length >= 2) return false;
  if (BILL_NOISE_RE.test(line) && !HSN_RE.test(line) && !BATCH_RE.test(line)) return false;

  const t = normalizeInvoiceLine(line);
  const hasHsn = HSN_RE.test(t);
  const hasPrice = /\d+(?:[.,]\d{2})?/.test(t);
  const hasExpiry = EXP_RE.test(t);
  const hasBatch = BATCH_RE.test(t);
  const hasPack = PACK_RE.test(t) || /\d+\*\d+/.test(t);
  const hasWord = /[A-Za-z]{3,}/.test(t);

  if (!hasWord || !hasPrice) return false;
  if (hasHsn || hasExpiry || hasBatch || hasPack) return true;
  // Name + several prices (HSN/batch OCR failed)
  return (t.match(/\d+\.\d{2}/g) || []).length >= 2;
}

/**
 * EXTRACT FOOTER TOTALS DIRECTLY FROM OCR TEXT (BOTTOM-UP PRECEDENCE)
 * Correctly separates Subtotal, Discount, Taxable, SGST, CGST, and Grand Total.
 */
function extractDirectOcrFooterTotals(rawText, items = []) {
  if (!rawText || !rawText.trim()) {
    const itemSubtotal = items.reduce((sum, i) => sum + (parseFloat(i.ptr) || 0) * (parseInt(i.quantity, 10) || 0), 0);
    const itemDisc = items.reduce((sum, i) => sum + ((parseFloat(i.ptr) || 0) * (parseInt(i.quantity, 10) || 0) * (parseFloat(i.discountPercent) || 0)) / 100, 0);
    const itemTaxable = Math.max(0, itemSubtotal - itemDisc);
    return {
      subtotal: itemSubtotal,
      discount: itemDisc,
      taxable: itemTaxable,
      sgst: itemTaxable * 0.025,
      cgst: itemTaxable * 0.025,
      grandTotal: itemTaxable * 1.05,
    };
  }

  let subtotal = 0;
  let discount = 0;
  let taxable = 0;

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Search from bottom of bill text upwards for footer lines
  lines.slice(-20).forEach((line) => {
    // 1. Subtotal
    if (/SUB\s*TOTAL/i.test(line) && subtotal === 0) {
      const m = line.match(/\b(\d+(?:[\.,]\d+)?)\b/);
      if (m) subtotal = parseFloat(m[1].replace(",", "."));
    }
    // 2. Discount
    if (/Discount/i.test(line) && discount === 0) {
      const m = line.match(/Discount[^\d]*(\d+(?:[\.,]\d+)?)/i);
      if (m) discount = parseFloat(m[1].replace(",", "."));
    }
    // 3. Taxable Amt
    if (/Taxable\s*Amt/i.test(line)) {
      const m = line.match(/Taxable\s*Amt[^\d]*(\d+(?:[\.,]\d+)?)/i);
      if (m) {
        const parsedVal = parseFloat(m[1].replace(",", "."));
        if (parsedVal > 0) taxable = parsedVal;
      }
    }
  });

  // Global regex fallback if not captured in bottom slice
  if (subtotal === 0) {
    const m = rawText.match(/SUB\s*TOTAL[^\d\n]*(\d+(?:[\.,]\d+)?)/i);
    if (m) subtotal = parseFloat(m[1].replace(",", "."));
  }

  if (discount === 0) {
    const m = rawText.match(/Discount[^\d\n]*(\d+(?:[\.,]\d+)?)/i);
    if (m) discount = parseFloat(m[1].replace(",", "."));
  }

  // Fallbacks if OCR missed a field
  if (subtotal === 0 && items.length > 0) {
    subtotal = items.reduce((sum, i) => sum + (parseFloat(i.ptr) || 0) * (parseInt(i.quantity, 10) || 0), 0);
  }

  // Sanity check for Taxable Amount (Taxable Amt cannot equal Discount)
  if (taxable === 0 || taxable === discount) {
    taxable = Math.max(0, subtotal - discount);
  }

  const sgst = parseFloat((taxable * 0.025).toFixed(2));
  const cgst = parseFloat((taxable * 0.025).toFixed(2));
  const grandTotal = parseFloat((taxable + sgst + cgst).toFixed(2));

  return { subtotal, discount, taxable, sgst, cgst, grandTotal };
}

/**
 * Dynamic OCR bill parser — only keeps lines that look like real medicine rows.
 */
function parsePureDynamicBill(rawText) {
  if (!rawText || !rawText.trim()) {
    return { stockist: "", invNo: "", items: [], ocrUsable: false };
  }

  const quality = getOcrQuality(rawText);
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  // 1. DISTRIBUTOR / STOCKIST EXTRACTION FROM HEADER
  let stockist = "";
  const headerLines = lines.slice(0, 15);
  const stockistLine = headerLines.find(
    (l) =>
      /PHARMA|MEDICAL|DISTRIBUTOR|AGENCIES|ENTERPRISES|TRADERS|HEALTHCARE|DRUGS|PVT|LTD|LIMITED|CHEMIST|STORE|BIOTECH|LAB|LABS/i.test(
        l,
      ) &&
      !/BASEMENT|SHOP|ROAD|STREET|MAIL|GMAIL|PHONE|DL\s*NO|GSTIN|Inv\.?\s*No|TAX INVOICE/i.test(l),
  );

  if (stockistLine) {
    stockist = stockistLine
      .replace(/^(GSTIN|TAX|INVOICE|BILL|SUPPLIER|STOCKIST|M\/S|TO|FROM|BOOK NO[:\.\d]*|Ms)[:\s]*/i, "")
      .replace(/[^A-Za-z0-9\s&.-]/g, "")
      .trim();
  }

  // 2. INVOICE NUMBER EXTRACTION
  let invNo = "";
  const invMatch =
    rawText.match(/Inv\.?\s*No\.?\s*[:\-]?\s*([A-Z0-9\/-]{3,20})/i) ||
    rawText.match(/(?:INVOICE|BILL)\s*(?:NO|NUM|\.)?\s*[:\-]?\s*([A-Z0-9\/-]{3,20})/i);
  if (invMatch?.[1] && !/INVOICE|BILL|PHARMA|MEDICAL|TAX/i.test(invMatch[1])) {
    invNo = invMatch[1].toUpperCase();
  }

  // Unreadable scan → do not invent fake rows
  if (!quality.usable) {
    return { stockist, invNo, items: [], ocrUsable: false };
  }

  // 3. MEDICINE LINE ITEMS
  const items = [];
  const seenNames = new Set();

  const candidateLines = lines.filter((line) => {
    if (BILL_NOISE_RE.test(line) && !HSN_RE.test(line) && !BATCH_RE.test(line)) {
      return false;
    }
    return isLikelyMedicineLine(line);
  });

  candidateLines.forEach((lineText, idx) => {
    // Skip pure account/phone number rows (9+ digits) with no medicine anchors
    if (/\d{9,}/.test(lineText) && !HSN_RE.test(lineText) && !BATCH_RE.test(lineText)) {
      return;
    }

    const parsed = parseMedicineLineAnyFormat(lineText, idx);
    if (parsed) {
      const key = parsed.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        items.push(parsed);
      }
      return;
    }

    // Loose fallback when anchors are messy but name + prices exist
    const numbers = lineText.match(/\d+(?:\.\d+)?/g) || [];
    const decimalValues = (lineText.match(/\d+\.\d{2}/g) || []).map((v) => parseFloat(v));
    const batchMatch = lineText.match(BATCH_RE);
    const batch = batchMatch ? batchMatch[1].toUpperCase() : "";

    if (decimalValues.length === 0 && !batch) return;

    const medName = extractMedicineName(lineText) || cleanMedicineName(normalizeInvoiceLine(lineText));
    if (!isPlausibleMedicineName(medName)) return;
    const key = medName.toLowerCase();
    if (seenNames.has(key)) return;

    let qty = 1;
    let ptr = 0.0;
    let mrp = 0.0;
    let disc = 0.0;

    const roles = inferNumberRoles(lineText);
    if (roles) {
      qty = roles.qty;
      ptr = roles.ptr;
      mrp = roles.mrp;
      disc = roles.disc;
    } else {
      const leadingQty = lineText.match(/^\s*(?:\d+[\).\s|-]+)?(\d{1,4})\b/);
      if (leadingQty) qty = parseInt(leadingQty[1], 10) || 1;
      else if (numbers.length > 0) qty = parseInt(numbers[0], 10) || 1;

      if (decimalValues.length >= 2) {
        ptr = decimalValues[0];
        mrp = decimalValues[decimalValues.length - 1];
      } else if (decimalValues.length === 1) {
        mrp = decimalValues[0];
        ptr = parseFloat((mrp * 0.7).toFixed(2));
      }
    }

    if (ptr <= 0 && mrp <= 0) return;
    if (ptr <= 0 && mrp > 0) ptr = parseFloat((mrp * 0.7).toFixed(2));
    if (mrp > 0 && ptr > mrp) mrp = ptr;

    const expMatch = lineText.match(EXP_RE);
    const hsnMatch = lineText.match(HSN_RE);

    seenNames.add(key);
    items.push({
      id: Date.now() + idx,
      name: medName.slice(0, 50),
      category: guessCategory(lineText, medName),
      batch: batch || `B-${100 + items.length + 1}`,
      price: Math.max(0.01, parseFloat(mrp) || 10.0),
      ptr: Math.max(0.01, parseFloat(ptr) || 0.0),
      quantity: Math.max(1, parseInt(qty, 10) || 1),
      expiryDate: parseExpiryToIso(expMatch?.[1]),
      hsn: hsnMatch ? hsnMatch[1] : "3004",
      pack: extractPackFromText(lineText),
      gstRate: roles?.gstRate || 5,
      discountPercent: parseFloat(disc) || 0.0,
      composition: "",
      status: "Active",
    });
  });

  return { stockist, invNo, items, ocrUsable: true };
}

export default function BillUploadModal() {
  const isBillUploadOpen = usePharmacyStore((s) => s.isBillUploadOpen);
  const setBillUploadOpen = usePharmacyStore((s) => s.setBillUploadOpen);
  const fetchMedicines = usePharmacyStore((s) => s.fetchMedicines);

  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");
  const [showOcrDebug, setShowOcrDebug] = useState(false);
  const [stockistName, setStockistName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [extractedItems, setExtractedItems] = useState([]);
  const [ocrEngineName, setOcrEngineName] = useState("");
  const [directFooterTotals, setDirectFooterTotals] = useState({
    subtotal: 0,
    discount: 0,
    taxable: 0,
    sgst: 0,
    cgst: 0,
    grandTotal: 0,
  });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  if (!isBillUploadOpen) return null;

  const onClose = () => {
    setScanError("");
    setRawOcrText("");
    setShowOcrDebug(false);
    setExtractedItems([]);
    setPreviewUrl(null);
    setSelectedImage(null);
    setRotationDeg(0);
    setZoomScale(1);
    setStockistName("");
    setInvoiceNumber("");
    setOcrEngineName("");
    setDirectFooterTotals({
      subtotal: 0,
      discount: 0,
      taxable: 0,
      sgst: 0,
      cgst: 0,
      grandTotal: 0,
    });
    setBillUploadOpen(false);
  };

  const handleFileChange = (file) => {
    if (!file) return;
    setScanError("");
    setRawOcrText("");
    setExtractedItems([]);
    setOcrEngineName("");
    setRotationDeg(0);
    setZoomScale(1);
    setStockistName("");
    setInvoiceNumber("");

    if (!file.type.startsWith("image/")) {
      setScanError("Invalid File Format. Please upload an image file (JPG, PNG, WebP).");
      showSimpleToast("Invalid File ❌", "Please upload an image file (JPG, PNG, WebP).", "danger");
      return;
    }

    const url = URL.createObjectURL(file);
    setSelectedImage(file);
    setPreviewUrl(url);
    runSmartScan(file.name, url, file, 0);
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });

  const runSmartScan = async (filename = "", url = "", fileObj = null, degrees = rotationDeg) => {
    setIsScanning(true);
    setScanError("");
    setRawOcrText("");
    setExtractedItems([]);
    setStockistName("");
    setInvoiceNumber("");
    setOcrEngineName("");

    try {
      // Step 1: Try AI Vision OCR via backend (Gemini 2.5 Flash)
      if (fileObj) {
        try {
          const base64 = await fileToBase64(fileObj);
          const aiRes = await ocrApi.scanBill(base64, fileObj.type || "image/jpeg");
          if (aiRes.data?.success) {
            const items = Array.isArray(aiRes.data?.items) ? aiRes.data.items : [];
            setStockistName(aiRes.data.stockist || "");
            setInvoiceNumber(aiRes.data.invNo || "");
            setInvoiceDate(aiRes.data.invoiceDate || new Date().toISOString().split("T")[0]);
            setExtractedItems(items);
            setOcrEngineName(aiRes.data.engine || "Gemini Vision AI ✨");
            setRawOcrText(JSON.stringify(aiRes.data, null, 2));

            // Auto-rotate image upright if Gemini Vision detected sideways text
            if (aiRes.data.suggestedRotationDeg) {
              setRotationDeg(aiRes.data.suggestedRotationDeg);
            }

            const footerTotals = extractDirectOcrFooterTotals("", items);
            setDirectFooterTotals(footerTotals);

            if (items.length > 0) {
              showSimpleToast(
                "AI Vision Bill Scan! ✨",
                `Extracted ${items.length} medicines using Gemini Vision AI!`,
                "success"
              );
            } else {
              showSimpleToast(
                "AI Vision Scan Completed 📸",
                "Gemini Vision processed the photo. If items were missed, try rotating upright or upload a clearer photo.",
                "warning"
              );
            }
            return;
          }
        } catch (aiErr) {
          console.log("AI OCR API unavailable or key missing. Falling back to local OCR:", aiErr.message);
        }
      }

      // Step 2: Fallback to Local Tesseract.js OCR
      setOcrEngineName("Local OCR Engine ⚡");
      const Tesseract = await loadTesseractScript();
      let rawText = "";

      if (Tesseract && fileObj) {
        // Zoom + rotate + contrast before OCR so tiny invoice print is readable
        const processedFile = await prepareImageForOcr(fileObj, degrees);
        const worker = await Tesseract.createWorker("eng");
        // Slightly favor accuracy on dense pharmacy bills
        await worker.setParameters({
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
        });
        const ret = await worker.recognize(processedFile);
        await worker.terminate();

        rawText = ret?.data?.text || "";
        console.log(
          "OCR Extracted Live Raw Text (Rotation:",
          degrees,
          "°, pre-zoomed):\n",
          rawText,
        );
      }

      setRawOcrText(rawText);

      // Dynamic OCR parsing (rejects garbage / sideways scans)
      const parsed = parsePureDynamicBill(rawText);
      const stockist = parsed.stockist || "";
      const invNo = parsed.invNo || "";
      const items = parsed.items || [];

      // Extract footer totals DIRECTLY from OCR text (NOT calculated from items)
      const footerTotals = extractDirectOcrFooterTotals(rawText, items);
      setDirectFooterTotals(footerTotals);

      const today = new Date().toISOString().split("T")[0];
      setStockistName(stockist);
      setInvoiceNumber(invNo);
      setInvoiceDate(today);
      setExtractedItems(items);

      if (items.length === 0) {
        const tip = parsed.ocrUsable === false
          ? "Bill photo is not readable (blur / wrong angle). Rotate the image or upload a clearer invoice, then re-scan. Or add medicines with Add Row."
          : "No clean medicine rows found. Rotate/re-scan a clearer bill, or add medicines manually with Add Row.";
        showSimpleToast("Scan needs a clearer bill 📸", tip, "warning");
      } else {
        showSimpleToast(
          "Purchase Bill Scanned! 📸",
          `Extracted ${items.length} medicines using local OCR engine.`,
          "success",
        );
      }
    } catch (err) {
      console.error("OCR Scan Error:", err);
      setIsScanning(false);
      setExtractedItems([]);
      const errMsg = "Error reading uploaded image. Please upload a clear photo of a purchase bill.";
      setScanError(errMsg);
      showSimpleToast("Scan Error ❌", errMsg, "danger");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRotateAndScan = (newDeg) => {
    setRotationDeg(newDeg);
    if (selectedImage) {
      runSmartScan(selectedImage.name, previewUrl, selectedImage, newDeg);
    }
  };

  const handleItemChange = (id, field, value) => {
    setExtractedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      name: "",
      category: "Tablet",
      batch: `B-${Math.floor(1000 + Math.random() * 9000)}`,
      price: 50.0,
      ptr: 38.0,
      quantity: 5,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      hsn: "3004",
      pack: "1*10",
      gstRate: 5,
      discountPercent: 0,
      composition: "",
      status: "Active",
    };
    setExtractedItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id) => {
    setExtractedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleImportAll = async (e) => {
    if (e) e.preventDefault();
    if (extractedItems.length === 0) {
      showSimpleToast("No Items", "Please upload a valid purchase bill image to extract items.", "warning");
      return;
    }

    for (const item of extractedItems) {
      if (!item.name.trim()) {
        showSimpleToast("Validation Error", "All items must have a medicine name.", "danger");
        return;
      }
      if (!item.batch.trim()) {
        showSimpleToast("Validation Error", `Batch number missing for "${item.name}".`, "danger");
        return;
      }
      if (!item.expiryDate) {
        showSimpleToast("Validation Error", `Expiry date missing for "${item.name}".`, "danger");
        return;
      }
    }

    setIsImporting(true);
    let successCount = 0;

    try {
      for (const item of extractedItems) {
        const cleanBatch = (item.batch || "B-100")
          .trim()
          .replace(/[^A-Za-z0-9\-]/g, "-");

        const medData = {
          name: item.name.trim(),
          category: item.category || "Tablet",
          batch: cleanBatch.length >= 2 ? cleanBatch : `B-${cleanBatch || "101"}`,
          price: Math.max(0.01, parseFloat(item.price) || 10.0),
          ptr: parseFloat(item.ptr) || 0,
          quantity: Math.max(0, parseInt(item.quantity, 10) || 1),
          expiryDate: item.expiryDate || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
          status: item.status || "Active",
          stockistName: stockistName.trim() || "Scanned Supplier",
          hsn: item.hsn || "",
          pack: item.pack || "1*10",
          gstRate: parseInt(item.gstRate, 10) || 5,
          composition: item.composition || "",
        };

        const res = await medicineApi.add(medData);
        if (res.data && res.data.success) {
          successCount++;
        }
      }

      showSimpleToast(
        "Import Successful! 🎉",
        `Successfully added ${successCount} medicines from purchase bill into Inventory!`,
        "success"
      );

      await fetchMedicines();
      onClose();
    } catch (err) {
      console.error("Import failed:", err);
      showSimpleToast(
        "Import Partial Error",
        `Added ${successCount} items, but some items failed. Check inputs.`,
        "warning"
      );
    } finally {
      setIsImporting(false);
    }
  };

  // FINANCIAL SUMMARY CARD (DISPLAYING DIRECT OCR EXTRACTED FOOTER TOTALS)
  const subtotalPTRGross = directFooterTotals.subtotal;
  const totalDiscountAmount = directFooterTotals.discount;
  const netTaxableAmount = directFooterTotals.taxable;
  const totalSGST = directFooterTotals.sgst;
  const totalCGST = directFooterTotals.cgst;
  const grandTotalCost = directFooterTotals.grandTotal;

  return (
    <div className={`modal-backdrop ${isBillUploadOpen ? "show" : ""}`} id="scan-bill-modal">
      <div className="modal-card modal-card-lg">
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0 }}>Scan & Auto-Add Purchase Bill</h3>
              {ocrEngineName && (
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    background: ocrEngineName.includes("Gemini") ? "rgba(99, 102, 241, 0.15)" : "rgba(16, 185, 129, 0.15)",
                    color: ocrEngineName.includes("Gemini") ? "#6366f1" : "var(--success)",
                    border: `1px solid ${ocrEngineName.includes("Gemini") ? "rgba(99, 102, 241, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                  }}
                >
                  {ocrEngineName}
                </span>
              )}
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Upload purchase bill photo to dynamically extract medicine line items
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleImportAll} className="modal-form">
          <div className="form-grid">
            {/* Upload Box */}
            <div className="form-group col-span-2">
              <label>Purchase Bill Photo (Invoice Image)</label>
              <div className="bill-dropzone" style={{ cursor: previewUrl ? "default" : "pointer" }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
                {previewUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
                    <div style={{ overflow: "auto", display: "flex", justifyContent: "center", alignItems: "center", padding: "12px", minHeight: "150px", maxHeight: "240px", width: "100%", borderRadius: "8px", background: "var(--bg-input)" }}>
                      <img
                        src={previewUrl}
                        alt="Bill Preview"
                        style={{
                          maxHeight: "150px",
                          maxWidth: "100%",
                          borderRadius: "6px",
                          transform: `rotate(${rotationDeg}deg) scale(${zoomScale})`,
                          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          transformOrigin: "center center",
                        }}
                      />
                    </div>
                    {/* ZOOM, ROTATION & ACTION CONTROLS */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomScale((prev) => Math.min(prev + 0.25, 3));
                        }}
                        style={{ padding: "4px 10px", fontSize: "12px", background: "var(--bg-card)" }}
                        title="Zoom In"
                      >
                        <i className="fa-solid fa-magnifying-glass-plus" style={{ marginRight: "4px" }}></i> Zoom In (+)
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomScale((prev) => Math.max(prev - 0.25, 0.5));
                        }}
                        style={{ padding: "4px 10px", fontSize: "12px", background: "var(--bg-card)" }}
                        title="Zoom Out"
                      >
                        <i className="fa-solid fa-magnifying-glass-minus" style={{ marginRight: "4px" }}></i> Zoom Out (-)
                      </button>
                      {zoomScale !== 1 && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomScale(1);
                          }}
                          style={{ padding: "4px 8px", fontSize: "11px", background: "var(--bg-card)" }}
                          title="Reset Zoom"
                        >
                          Reset ({Math.round(zoomScale * 100)}%)
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextDeg = (rotationDeg - 90 + 360) % 360;
                          handleRotateAndScan(nextDeg);
                        }}
                        style={{ padding: "4px 10px", fontSize: "12px", background: "var(--bg-card)" }}
                        title="Rotate 90° Left and re-scan"
                      >
                        <i className="fa-solid fa-rotate-left" style={{ marginRight: "4px" }}></i> Rotate Left
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextDeg = (rotationDeg + 90) % 360;
                          handleRotateAndScan(nextDeg);
                        }}
                        style={{ padding: "4px 10px", fontSize: "12px", background: "var(--bg-card)" }}
                        title="Rotate 90° Right and re-scan"
                      >
                        <i className="fa-solid fa-rotate-right" style={{ marginRight: "4px" }}></i> Rotate Right
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          runSmartScan(selectedImage?.name, previewUrl, selectedImage, rotationDeg);
                        }}
                        style={{ padding: "4px 12px", fontSize: "12px" }}
                        title="Re-scan current upright bill image"
                      >
                        <i className="fa-solid fa-bolt" style={{ marginRight: "4px" }}></i> Live OCR Re-Scan
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: "4px" }}></i> Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px 0" }} onClick={() => fileInputRef.current?.click()}>
                    <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: "28px", color: "var(--primary)", marginBottom: "8px" }}></i>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      Click or Drag Purchase Bill Photo Here
                    </p>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Supports JPG, PNG, WebP</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live OCR Text Debug Viewer */}
            {rawOcrText && (
              <div className="form-group col-span-2" style={{ marginBottom: "8px" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowOcrDebug(!showOcrDebug)}
                  style={{ width: "100%", justifyContent: "space-between", fontSize: "12px" }}
                >
                  <span>
                    <i className="fa-solid fa-terminal" style={{ marginRight: "6px" }}></i>
                    {showOcrDebug ? "Hide Live Raw OCR Text" : "View Live Raw OCR Extracted Text"}
                  </span>
                  <i className={`fa-solid fa-chevron-${showOcrDebug ? "up" : "down"}`}></i>
                </button>
                {showOcrDebug && (
                  <pre
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      background: "#1e1e1e",
                      color: "#4ec9b0",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      marginTop: "6px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {rawOcrText}
                  </pre>
                )}
              </div>
            )}

            {/* Error Message Box */}
            {scanError && (
              <div className="form-group col-span-2" style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--danger)", borderRadius: "8px", color: "var(--danger)", textAlign: "center" }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: "6px", fontSize: "16px" }}></i>
                <strong>Invalid Image / Non-Bill File!</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                  {scanError}
                </p>
              </div>
            )}

            {/* Scanning Progress - Medical Store AI Scanner Loader */}
            {isScanning && (
              <div
                className="form-group col-span-2"
                style={{
                  padding: "24px 20px",
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Animated Medical Laser Line */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: "linear-gradient(90deg, transparent, #10b981, #6366f1, #10b981, transparent)",
                    boxShadow: "0 0 12px #10b981, 0 0 20px #6366f1",
                    animation: "medicalLaserScan 2s ease-in-out infinite",
                    zIndex: 2,
                  }}
                />

                {/* Medical Pill/Cross Center Icon */}
                <div style={{ position: "relative", marginBottom: "14px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "rgba(16, 185, 129, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      animation: "pulseGlow 2s ease-in-out infinite",
                    }}
                  >
                    <i className="fa-solid fa-capsules" style={{ fontSize: "28px", color: "#10b981", animation: "capsuleSpin 4s linear infinite" }}></i>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      background: "#6366f1",
                      color: "#ffffff",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}
                  >
                    <i className="fa-solid fa-plus"></i>
                  </div>
                </div>

                {/* Scanner Status Text */}
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.2px" }}>
                  Scanning Medical Bill with AI Vision ✨
                </h4>
                <p style={{ margin: "0 0 14px 0", fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center" }}>
                  Extracting Medicine Brand Names, Batches, Expiries, PTR & Taxes...
                </p>

                {/* Feature Pills */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <span style={{ padding: "4px 10px", background: "rgba(16, 185, 129, 0.14)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "12px", fontSize: "11px", fontWeight: 600, color: "#10b981" }}>
                    💊 Medicine Names
                  </span>
                  <span style={{ padding: "4px 10px", background: "rgba(99, 102, 241, 0.14)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "12px", fontSize: "11px", fontWeight: 600, color: "#818cf8" }}>
                    🧪 Batch & Expiry
                  </span>
                  <span style={{ padding: "4px 10px", background: "rgba(245, 158, 11, 0.14)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "12px", fontSize: "11px", fontWeight: 600, color: "#f59e0b" }}>
                    🏷️ PTR & MRP
                  </span>
                  <span style={{ padding: "4px 10px", background: "rgba(14, 165, 233, 0.14)", border: "1px solid rgba(14, 165, 233, 0.3)", borderRadius: "12px", fontSize: "11px", fontWeight: 600, color: "#38bdf8" }}>
                    📊 GST Tax Rates
                  </span>
                </div>

                <style>{`
                  @keyframes medicalLaserScan {
                    0% { top: 4%; opacity: 0.3; }
                    50% { top: 92%; opacity: 1; }
                    100% { top: 4%; opacity: 0.3; }
                  }
                  @keyframes pulseGlow {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
                    50% { transform: scale(1.06); box-shadow: 0 0 25px rgba(99, 102, 241, 0.5); }
                  }
                  @keyframes capsuleSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            {/* Invoice Details */}
            {extractedItems.length > 0 && !scanError && (
              <>
                <div className="form-group">
                  <label>Distributor / Stockist</label>
                  <input
                    type="text"
                    value={stockistName}
                    placeholder="e.g., OM MEDICAL PHARMACY"
                    onChange={(e) => setStockistName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Invoice No.</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    placeholder="e.g., A002581"
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>

                {/* Items Table */}
                <div className="form-group col-span-2">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <label style={{ margin: 0, fontWeight: 700, fontSize: "14px" }}>
                        Extracted Medicines ({extractedItems.length} items)
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleAddItem}
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                    >
                      <i className="fa-solid fa-plus" style={{ marginRight: "4px" }}></i> Add Row
                    </button>
                  </div>

                  {/* HIGH-VISIBILITY SPACIOUS TABLE WITH FULL HORIZONTAL SCROLL & EXPANDED MIN-WIDTHS */}
                  <div className="table-container" style={{ maxHeight: "300px", overflowY: "auto", overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                    <table className="data-table" style={{ fontSize: "13px", width: "100%", minWidth: "1180px", tableLayout: "fixed" }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>
                        <tr>
                          <th style={{ width: "230px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Medicine Name *</th>
                          <th style={{ width: "115px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Category</th>
                          <th style={{ width: "135px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Batch *</th>
                          <th style={{ width: "145px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Expiry *</th>
                          <th style={{ width: "75px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Qty *</th>
                          <th style={{ width: "105px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>PTR (₹) *</th>
                          <th style={{ width: "85px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Disc %</th>
                          <th style={{ width: "105px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>Net Amt (₹)</th>
                          <th style={{ width: "85px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>GST %</th>
                          <th style={{ width: "105px", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}>MRP (₹)</th>
                          <th style={{ width: "40px", textAlign: "center", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedItems.map((item) => (
                          <tr key={item.id}>
                            <td style={{ width: "230px" }}>
                              <input
                                type="text"
                                value={item.name}
                                placeholder="Medicine Name"
                                onChange={(e) => handleItemChange(item.id, "name", e.target.value)}
                                style={{ padding: "7px 10px", fontSize: "12.5px", width: "100%", boxSizing: "border-box", fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ width: "115px" }}>
                              <select
                                value={item.category}
                                onChange={(e) => handleItemChange(item.id, "category", e.target.value)}
                                style={{ padding: "7px 6px", fontSize: "12px", width: "100%", boxSizing: "border-box" }}
                              >
                                <option value="Tablet">Tablet</option>
                                <option value="Capsule">Capsule</option>
                                <option value="Syrup">Syrup</option>
                                <option value="Injection">Injection</option>
                                <option value="Ointment">Ointment</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td style={{ width: "135px" }}>
                              <input
                                type="text"
                                value={item.batch}
                                placeholder="Batch"
                                onChange={(e) => handleItemChange(item.id, "batch", e.target.value)}
                                style={{ padding: "7px 8px", fontSize: "12.5px", width: "100%", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ width: "145px" }}>
                              <input
                                type="date"
                                value={item.expiryDate}
                                onChange={(e) => handleItemChange(item.id, "expiryDate", e.target.value)}
                                style={{ padding: "7px 6px", fontSize: "12px", width: "100%", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ width: "75px" }}>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                                style={{ padding: "7px 6px", fontSize: "12.5px", width: "100%", boxSizing: "border-box", textAlign: "center" }}
                              />
                            </td>
                            <td style={{ width: "105px" }}>
                              <input
                                type="number"
                                step="0.01"
                                value={item.ptr}
                                placeholder="PTR"
                                onChange={(e) => handleItemChange(item.id, "ptr", e.target.value)}
                                style={{ padding: "7px 8px", fontSize: "13px", width: "100%", boxSizing: "border-box", fontWeight: 700, color: "var(--primary)" }}
                              />
                            </td>
                            <td style={{ width: "85px" }}>
                              <input
                                type="number"
                                step="0.01"
                                value={item.discountPercent !== undefined && item.discountPercent !== null ? item.discountPercent : 0}
                                onChange={(e) => handleItemChange(item.id, "discountPercent", e.target.value)}
                                style={{ padding: "7px 6px", fontSize: "12.5px", width: "100%", boxSizing: "border-box", textAlign: "center" }}
                              />
                            </td>
                            <td style={{ width: "105px" }}>
                              <input
                                type="text"
                                readOnly
                                value={`₹${(
                                  (parseFloat(item.quantity) || 0) *
                                  (parseFloat(item.ptr) || 0) *
                                  (1 - (parseFloat(item.discountPercent) || 0) / 100)
                                ).toFixed(2)}`}
                                title="Calculated Net Amount"
                                style={{
                                  padding: "7px 8px",
                                  fontSize: "12.5px",
                                  width: "100%",
                                  boxSizing: "border-box",
                                  fontWeight: 600,
                                  textAlign: "right",
                                  background: "var(--bg-input)",
                                  color: "var(--text-primary)",
                                  opacity: 0.9,
                                }}
                              />
                            </td>
                            <td style={{ width: "85px" }}>
                              <select
                                value={item.gstRate || 5}
                                onChange={(e) => handleItemChange(item.id, "gstRate", e.target.value)}
                                style={{ padding: "7px 4px", fontSize: "12px", width: "100%", boxSizing: "border-box" }}
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td style={{ width: "105px" }}>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                placeholder="MRP"
                                onChange={(e) => handleItemChange(item.id, "price", e.target.value)}
                                style={{ padding: "7px 8px", fontSize: "13px", width: "100%", boxSizing: "border-box", fontWeight: 700, color: "var(--text-primary)" }}
                              />
                            </td>
                            <td style={{ width: "40px", textAlign: "center" }}>
                              <button
                                type="button"
                                className="btn-icon-only delete"
                                title="Remove item"
                                onClick={() => handleRemoveItem(item.id)}
                                style={{ width: "26px", height: "26px", margin: "0 auto" }}
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* DIRECT OCR EXTRACTED SUMMARY CARD */}
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px 16px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "10px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        SUB TOTAL
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                        ₹{subtotalPTRGross.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: "10px", color: "var(--danger)", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        Discount (-)
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--danger)" }}>
                        -₹{totalDiscountAmount.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        Taxable Amt
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                        ₹{netTaxableAmount.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        SGST (2.5%)
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--primary)" }}>
                        +₹{totalSGST.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                        CGST (2.5%)
                      </span>
                      <strong style={{ fontSize: "13.5px", color: "var(--primary)" }}>
                        +₹{totalCGST.toFixed(2)}
                      </strong>
                    </div>

                    <div style={{ background: "rgba(16, 185, 129, 0.14)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
                      <span style={{ fontSize: "10px", color: "var(--success)", display: "block", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.5px" }}>
                        TOTAL COST
                      </span>
                      <strong style={{ fontSize: "15.5px", color: "var(--success)" }}>
                        ₹{grandTotalCost.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* MODAL FOOTER */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isImporting || extractedItems.length === 0 || !!scanError}
            >
              {isImporting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: "6px" }}></i>
                  Importing Medicines...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-import" style={{ marginRight: "6px" }}></i>
                  Add All ({extractedItems.length} Medicines) to Inventory
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
