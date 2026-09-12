import { db } from './server';
import type { Row } from './domain';

// The longest supported legacy entitlement is one year. Page through matching
// rows so a database response cap cannot hide a newer, still-valid purchase.
export async function entitlementPayments(userId: number): Promise<Row[]> {
  const since = encodeURIComponent(new Date(Date.now() - 366 * 86400000).toISOString());
  const query = `user_id=eq.${userId}&status=eq.confirmed&or=(confirmed_at.gte.${since},and(confirmed_at.is.null,created_at.gte.${since}))&select=id,film_id,plan,status,confirmed_at,created_at&order=id.asc&limit=200`;
  const result: Row[] = [];
  let lastId = 0;
  for (;;) {
    const rows = await db(`pending_payments?${query}&id=gt.${lastId}`);
    result.push(...rows);
    if (rows.length === 0) return result;
    const nextId = Number(rows[rows.length - 1].id);
    if (!Number.isSafeInteger(nextId) || nextId <= lastId) throw new Error('Invalid payment cursor');
    lastId = nextId;
    // Continue until an empty page; this also handles database caps below 200.
  }
}
