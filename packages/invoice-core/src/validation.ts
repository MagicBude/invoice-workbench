import type { AmountValidationStatus, InvoiceRecord } from './types';

export function validateAmountRelation(
  amountExcludingTax: string,
  taxAmount: string,
  amountIncludingTax: string
): AmountValidationStatus {
  if (!amountExcludingTax || !taxAmount || !amountIncludingTax) return 'unknown';

  const noTax = Number(amountExcludingTax);
  const tax = Number(taxAmount);
  const total = Number(amountIncludingTax);
  if (![noTax, tax, total].every(Number.isFinite)) return 'unknown';

  return Math.abs(noTax + tax - total) <= 0.01 ? 'valid' : 'invalid';
}

export function calculateConfidence(record: InvoiceRecord): number {
  let score = 0;
  if (record.invoiceNumber) score += 0.25;
  if (record.issueDate) score += 0.15;
  if (record.amountExcludingTax && record.taxAmount && record.amountIncludingTax) score += 0.3;
  if (record.amountValidation === 'valid') score += 0.2;
  if (record.sellerName) score += 0.1;
  return Math.min(1, Number(score.toFixed(2)));
}

export function markDuplicateRecords(records: InvoiceRecord[]): InvoiceRecord[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.invoiceNumber) continue;
    counts.set(record.invoiceNumber, (counts.get(record.invoiceNumber) ?? 0) + 1);
  }

  return records.map((record) => ({
    ...record,
    duplicateStatus: record.invoiceNumber
      ? (counts.get(record.invoiceNumber) ?? 0) > 1
        ? 'duplicate'
        : 'unique'
      : 'unknown'
  }));
}
