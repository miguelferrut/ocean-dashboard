import type { ShipmentInsert } from "@/types/database.types";

// Ocean_Traffic_Report (Excel Table1) header → shipments column.
// Headers are matched after normalising case, spaces, line breaks and punctuation, so
// "Pedimento_\nApproved_Date" and "pedimento approved date" both resolve.
export type ColumnKind = "id" | "text" | "upper" | "date" | "number" | "integer" | "bool";

type ColumnSpec = { column: keyof ShipmentInsert | "aaa_ready_raw" | "critical_raw"; kind: ColumnKind };

export const SHEET_NAME = "Ocean_Traffic_Report";

export const COLUMN_MAP: Record<string, ColumnSpec> = {
  BL: { column: "bl_no", kind: "id" },
  Container_No: { column: "container_no", kind: "id" },
  Invoice_No: { column: "invoice_no", kind: "id" },
  ASN: { column: "asn", kind: "text" },
  Point_Origin: { column: "point_origin", kind: "upper" },
  Incoterm: { column: "incoterm", kind: "upper" },
  Forwarder: { column: "forwarder", kind: "upper" },
  Shipping_Line: { column: "shipping_line", kind: "upper" },
  Name: { column: "coordinator", kind: "text" },
  Plant: { column: "plant", kind: "upper" },
  Project: { column: "project", kind: "upper" },
  "Type Material": { column: "material_type", kind: "upper" },
  IMMEX: { column: "immex", kind: "upper" },
  File_Shipping_Date: { column: "file_shipping_date", kind: "date" },
  Origin_Supplier: { column: "origin_supplier", kind: "upper" },
  Invoice_total_value: { column: "invoice_total_value", kind: "number" },
  Currency: { column: "currency", kind: "upper" },
  Weight_KGS: { column: "weight_kg", kind: "number" },
  Pallets: { column: "pallets", kind: "integer" },
  "Needs AAA?": { column: "needs_aaa", kind: "bool" },
  Invoice_Supplier: { column: "invoice_supplier", kind: "text" },
  Clave: { column: "clave", kind: "upper" },
  Instruccion_Especial: { column: "instruccion_especial", kind: "upper" },
  MET_VAL: { column: "met_val", kind: "text" },
  PREVIO: { column: "previo", kind: "upper" },
  ATD_Port: { column: "atd_port", kind: "date" },
  Vessel: { column: "vessel", kind: "upper" },
  Voyage_No: { column: "voyage_no", kind: "upper" },
  ETA_Port_by_Origin: { column: "eta_port_by_origin", kind: "date" },
  ETA_Port_Update: { column: "eta_port_update", kind: "date" },
  BL_in_OneDrive: { column: "bl_in_onedrive_date", kind: "date" },
  Broker: { column: "broker", kind: "upper" },
  Instruction_Date: { column: "instruction_date", kind: "date" },
  Broker_Reference: { column: "broker_reference", kind: "text" },
  Reference_Received_Date: { column: "reference_received_date", kind: "date" },
  "CHINA BL Type": { column: "china_bl_type", kind: "upper" },
  AAA_ready: { column: "aaa_ready_raw", kind: "text" },
  BL_revalidation_date: { column: "bl_revalidation_date", kind: "date" },
  "Container Seal_No Original": { column: "container_seal_no", kind: "text" },
  Proforma_Creation_Date: { column: "proforma_creation_date", kind: "date" },
  Pedimento_Approved_Date: { column: "pedimento_approved_date", kind: "date" },
  Pedimento_No: { column: "pedimento_no", kind: "text" },
  Pedimento_Payment_Date: { column: "pedimento_payment_date", kind: "date" },
  ATA_Port: { column: "ata_port", kind: "date" },
  VIP: { column: "vip_date", kind: "date" },
  VIP_RESULT: { column: "vip_result_date", kind: "date" },
  Effective_Discharge_Date: { column: "effective_discharge_date", kind: "date" },
  ETA_Customs_Appointment: { column: "eta_customs_appointment", kind: "date" },
  Customs_Release_Date: { column: "customs_release_date", kind: "date" },
  Terminal: { column: "terminal", kind: "upper" },
  CartaPorte_ID: { column: "cartaporte_id", kind: "text" },
  Transport_Assignment_Date: { column: "transport_assignment_date", kind: "date" },
  Carrier: { column: "carrier", kind: "upper" },
  "GPS Link": { column: "gps_link", kind: "text" },
  Modulation_Status: { column: "modulation_status", kind: "upper" },
  "Critical Shipment?": { column: "critical_raw", kind: "text" },
  "Impact Date (Critical)": { column: "impact_date", kind: "date" },
  "Plant Delivery": { column: "plant_delivery", kind: "text" },
  ETA_SAM_GOAL: { column: "eta_sam_goal", kind: "date" },
  ETA_SAM_REAL: { column: "eta_sam_real", kind: "date" },
  ATA_SAM: { column: "ata_sam", kind: "date" },
  SAM_Discharge_Date: { column: "sam_discharge_date", kind: "date" },
  Empty_Return_Date: { column: "empty_return_date", kind: "date" },
  // Status, FLAGGED, Days_in_progress and the helper columns are derived in shipments_view.
};

export const normalizeHeader = (h: unknown) =>
  String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const NORMALIZED = new Map(Object.entries(COLUMN_MAP).map(([h, spec]) => [normalizeHeader(h), { header: h, ...spec }]));

export function resolveHeader(raw: unknown) {
  return NORMALIZED.get(normalizeHeader(raw)) ?? null;
}

export const REQUIRED_HEADERS = ["Invoice_No", "BL", "Container_No"];
