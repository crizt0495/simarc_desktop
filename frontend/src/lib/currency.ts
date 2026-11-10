/**
 * currency.ts — pemformatan & parsing nominal Rupiah (id-ID).
 *
 * Nilai internal form selalu berupa string angka polos, mis. "1500000"
 * atau "517999.99" (desimal memakai titik). Tampilan ke pengguna memakai
 * pemisah ribuan titik dan desimal koma sesuai konvensi Indonesia.
 */

const MAX_DESIMAL = 2;
const grouping = new Intl.NumberFormat('id-ID');

/** Ubah nilai apa pun (number/string DB/input) menjadi angka polos. */
export const normalizeCurrency = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  let raw = String(value).trim();
  if (!raw) return '';
  raw = raw.replace(/[^\d.,]/g, '');
  if (!raw) return '';

  if (raw.includes(',')) {
    // Format id-ID: titik = ribuan, koma = desimal.
    raw = raw.replace(/\./g, '').replace(/,/g, '.');
  } else {
    const dots = (raw.match(/\./g) || []).length;
    // Lebih dari satu titik, atau satu titik diikuti tepat 3 digit, berarti
    // pemisah ribuan (nominal desimal maksimal 2 digit).
    if (dots > 1 || (dots === 1 && /\.\d{3}$/.test(raw))) {
      raw = raw.replace(/\./g, '');
    }
  }

  const match = raw.match(/\d+(?:\.\d{0,2})?/);
  return match ? match[0] : '';
};

/** Tampilkan nominal dengan pemisah ribuan, mis. "1.500.000" / "517.999,99". */
export const formatCurrency = (value: unknown): string => {
  const raw = normalizeCurrency(value);
  if (!raw) return '';
  const [intRaw, decRaw] = raw.split('.');
  const intPart = grouping.format(Number(intRaw || '0'));
  if (decRaw === undefined) return intPart;
  return `${intPart},${decRaw}`;
};

/**
 * Parsing input teks bermasker menjadi angka polos.
 * Titik diperlakukan sebagai pemisah ribuan; koma sebagai desimal.
 */
export const parseCurrencyInput = (input: string): string => {
  const cleaned = String(input ?? '').replace(/\./g, '').replace(/[^\d,]/g, '');
  if (!cleaned) return '';
  const [intRaw, ...decParts] = cleaned.split(',');
  let intPart = intRaw.replace(/\D/g, '');
  if (intPart.length > 1) intPart = intPart.replace(/^0+/, '') || '0';
  if (decParts.length === 0) return intPart;
  const decPart = decParts.join('').replace(/\D/g, '').slice(0, MAX_DESIMAL);
  return `${intPart || '0'}.${decPart}`;
};

/** Konversi nominal apa pun menjadi number untuk perhitungan. */
export const currencyToNumber = (value: unknown): number => {
  const n = Number(normalizeCurrency(value));
  return Number.isFinite(n) ? n : 0;
};
