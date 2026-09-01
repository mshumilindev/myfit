/**
 * Live Open Food Facts integration — real product data (no API key, CORS-open).
 * Falls back to the bundled seed (data.ts) when offline or on error, so logging
 * never dead-ends.
 */
import type { Food } from './types';

const BASE = 'https://world.openfoodfacts.org';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: number | string | undefined): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

function toFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']);
  const name = (p.product_name ?? '').trim();
  if (!name || kcal <= 0) return null; // skip empty / macro-less entries
  const brand = (p.brands ?? '').split(',')[0]?.trim();
  return {
    id: `off-${p.code ?? name}`,
    name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} · ${brand}` : name,
    emoji: '🛒',
    basis: '100g',
    kind: 'product',
    per: {
      kcal: Math.round(kcal),
      protein: Math.round(num(n['proteins_100g']) * 10) / 10,
      fat: Math.round(num(n['fat_100g']) * 10) / 10,
      carbs: Math.round(num(n['carbohydrates_100g']) * 10) / 10,
    },
    barcode: p.code,
  };
}

async function getJSON(url: string, ms = 7000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Search products by name in Open Food Facts. Throws on network/timeout. */
export async function searchProductsOFF(query: string): Promise<Food[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=24` +
    `&fields=code,product_name,brands,nutriments`;
  const data = (await getJSON(url)) as { products?: OffProduct[] };
  return (data.products ?? [])
    .map(toFood)
    .filter((f): f is Food => f !== null)
    .slice(0, 20);
}

/** Look a product up by barcode in Open Food Facts. Returns null if not found. */
export async function lookupBarcodeOFF(code: string): Promise<Food | null> {
  const c = code.trim();
  if (!c) return null;
  const url = `${BASE}/api/v2/product/${encodeURIComponent(c)}?fields=code,product_name,brands,nutriments`;
  const data = (await getJSON(url)) as { status?: number; product?: OffProduct };
  if (!data.product) return null;
  return toFood({ ...data.product, code: c });
}
