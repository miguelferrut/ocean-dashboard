import type { InvoiceType } from "@/types/database.types";

// Prototype: a "P" right after the 6-digit date in the invoice number, e.g. SHAUSMEX260507P-B.
// The legacy dashboard matched a "P" anywhere; on the current workbook both rules select the
// same 49 invoices, but the anchored form won't misfire on other suppliers' number formats.
const PROTOTYPE = /\d{6}P/i;

export function classifyInvoice(input: {
  invoiceNo: string;
  needsAaa: boolean;
  aaaReadyRaw: unknown;
  materialType: string | null;
}): InvoiceType {
  if (PROTOTYPE.test(input.invoiceNo)) return "Prototype";
  if (input.needsAaa) return "Aluminum";
  const ready = input.aaaReadyRaw;
  if (ready instanceof Date) return "Aluminum";
  if (typeof ready === "string" && /^(needs?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i.test(ready.trim())) {
    return "Aluminum";
  }
  if (input.materialType && /alumin/i.test(input.materialType)) return "Aluminum";
  return "Normal";
}
