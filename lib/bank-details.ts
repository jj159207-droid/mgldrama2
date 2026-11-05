import { normalizeMongolianIban } from './iban';
import type { Row } from './domain';

// The recipient's verified bank instructions live in private Vercel
// environment configuration, not the public repository or browser bundle.
// Use them only as a targeted fallback for the old, invalid TAZA settings
// until an administrator explicitly saves the corrected settings in the DB.
export function paymentBankSettings(row: Row | undefined, site: string): Row | undefined {
  if (site !== 'taza') return row;

  const account = String(process.env.TAZA_BANK_ACCOUNT || '').trim();
  const iban = normalizeMongolianIban(process.env.TAZA_BANK_IBAN);
  // KHAN bank = 0005, and its 10-digit account must match the IBAN tail.
  if (!/^\d{10}$/.test(account) || !iban || iban.slice(4, 8) !== '0005' || !iban.endsWith(account)) {
    return row;
  }

  const previousAccount = String(row?.bank_account || '');
  if (row && (previousAccount !== '5251258979' || normalizeMongolianIban(row.bank_iban))) {
    // Do not overwrite a newer administrator-selected bank recipient.
    return row;
  }
  return { ...(row || {}), bank_account: account, bank_iban: iban };
}
