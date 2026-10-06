import { describe, expect, it } from "vitest";
import { parseShipmentGrid } from "@/domain/shipment-rows";
import { classifyInvoice } from "@/domain/invoice-type";

const HEADER = [
  "BL",
  "Container_No",
  "Invoice_No",
  "Currency",
  "Needs AAA?",
  "AAA_ready",
  "Type Material",
  "Critical\nShipment?",
  "Modulation_Status",
  "Pedimento_\nApproved_Date",
  "Status", // derived in the database; must be ignored
];

const row = (over: Partial<Record<(typeof HEADER)[number], unknown>>) =>
  HEADER.map((h) => over[h] ?? null);

describe("parseShipmentGrid", () => {
  it("maps headers with line breaks and builds records", () => {
    const r = parseShipmentGrid(HEADER, [
      row({
        BL: "ngb600330600",
        Container_No: "PIDU4077791",
        Invoice_No: "SHCUSMEX260509B",
        Currency: "CYN",
        "Needs AAA?": false,
        AAA_ready: "N/A",
        "Critical\nShipment?": "YES ",
        Modulation_Status: "green",
        "Pedimento_\nApproved_Date": new Date(Date.UTC(2026, 5, 10)),
      }),
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      bl_no: "NGB600330600",
      invoice_no: "SHCUSMEX260509B",
      currency: "CNY",
      is_critical: true,
      modulation_status: "GREEN",
      pedimento_approved_date: "2026-06-10",
      invoice_type: "Normal",
      needs_aaa: false,
    });
    expect(r.unknownHeaders).toEqual(["Status"]);
  });

  it("rejects every row of a duplicated invoice number", () => {
    const r = parseShipmentGrid(HEADER, [
      row({ Invoice_No: "A1", BL: "X" }),
      row({ Invoice_No: "a1 ", BL: "Y" }),
      row({ Invoice_No: "B2", BL: "Z" }),
    ]);
    expect(r.rows.map((x) => x.invoice_no)).toEqual(["B2"]);
    expect(r.rejectedRows).toBe(2);
    expect(r.issues.filter((i) => i.severity === "error").map((i) => i.rowNumber)).toEqual([2, 3]);
  });

  it("skips blank rows and rejects rows without an invoice", () => {
    const r = parseShipmentGrid(HEADER, [row({}), row({ BL: "ONLYBL" })], 4);
    expect(r.totalRows).toBe(1);
    expect(r.rows).toHaveLength(0);
    expect(r.issues[0]).toMatchObject({ rowNumber: 6, severity: "error" });
  });

  it("drops values that would violate database constraints, with a warning", () => {
    const r = parseShipmentGrid(HEADER, [row({ Invoice_No: "C3", Currency: "EUR", Modulation_Status: "YELLOW" })]);
    expect(r.rows[0]).toMatchObject({ currency: null, modulation_status: null });
    expect(r.issues.map((i) => i.field)).toEqual(["Currency", "Modulation_Status"]);
  });

  it("fails fast when a required column is missing", () => {
    expect(() => parseShipmentGrid(["BL", "Invoice_No"], [])).toThrow(/Container_No/);
  });
});

describe("classifyInvoice", () => {
  const base = { needsAaa: false, aaaReadyRaw: null, materialType: null };
  it("detects prototypes by the P after the date", () => {
    expect(classifyInvoice({ ...base, invoiceNo: "SHAUSMEX260507P-B" })).toBe("Prototype");
    expect(classifyInvoice({ ...base, invoiceNo: "SHTUSMX260424P" })).toBe("Prototype");
    expect(classifyInvoice({ ...base, invoiceNo: "PO-2026-1" })).toBe("Normal");
  });
  it("prototype wins over aluminum", () => {
    expect(classifyInvoice({ ...base, invoiceNo: "SHTUSMX260424P", needsAaa: true })).toBe("Prototype");
  });
  it("detects aluminum from any signal", () => {
    expect(classifyInvoice({ ...base, invoiceNo: "X", needsAaa: true })).toBe("Aluminum");
    expect(classifyInvoice({ ...base, invoiceNo: "X", aaaReadyRaw: "NEEDS" })).toBe("Aluminum");
    expect(classifyInvoice({ ...base, invoiceNo: "X", aaaReadyRaw: new Date() })).toBe("Aluminum");
    expect(classifyInvoice({ ...base, invoiceNo: "X", materialType: "RM | A1 | ALUMINIO" })).toBe("Aluminum");
    expect(classifyInvoice({ ...base, invoiceNo: "X", aaaReadyRaw: "N/A" })).toBe("Normal");
  });
});
