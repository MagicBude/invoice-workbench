export type ParseStatus = 'success' | 'review' | 'failed';
export type DuplicateStatus = 'unique' | 'duplicate' | 'unknown';
export type AmountValidationStatus = 'valid' | 'invalid' | 'unknown';
export type ManualReviewStatus = 'pending' | 'confirmed';

export interface InvoiceRecord {
  id: string;
  sourceFileName: string;
  fileDate: string;
  fileDisplayName: string;
  invoiceType: string;
  invoiceNumber: string;
  issueDate: string;
  sellerName: string;
  sellerTaxId: string;
  buyerName: string;
  buyerTaxId: string;
  amountExcludingTax: string;
  taxAmount: string;
  amountIncludingTax: string;
  taxRate: string;
  itemName: string;
  remark: string;
  parseStatus: ParseStatus;
  manualReviewStatus: ManualReviewStatus;
  confidence: number;
  duplicateStatus: DuplicateStatus;
  amountValidation: AmountValidationStatus;
  validationMessages: string[];
}

export type InvoiceExportKey = Exclude<keyof InvoiceRecord, 'id' | 'validationMessages'>;

export interface ExportFieldDefinition {
  key: InvoiceExportKey;
  label: string;
  defaultSelected: boolean;
  editable: boolean;
  type: 'text' | 'date' | 'currency' | 'number' | 'status';
  group: 'file' | 'invoice' | 'party' | 'amount' | 'business' | 'quality';
}
