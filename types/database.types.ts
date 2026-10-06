// Mirrors `supabase gen types typescript` output for the current schema.
// Regenerate with: npx supabase gen types typescript --project-id <ref> > types/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "supervisor" | "user";
export type InvoiceType = "Normal" | "Aluminum" | "Prototype";

export type ShipmentRow = {
  id: string;
  invoice_no: string;
  bl_no: string | null;
  container_no: string | null;
  asn: string | null;
  point_origin: string | null;
  incoterm: string | null;
  forwarder: string | null;
  shipping_line: string | null;
  coordinator: string | null;
  plant: string | null;
  project: string | null;
  material_type: string | null;
  immex: string | null;
  origin_supplier: string | null;
  invoice_supplier: string | null;
  broker: string | null;
  broker_reference: string | null;
  terminal: string | null;
  carrier: string | null;
  vessel: string | null;
  voyage_no: string | null;
  plant_delivery: string | null;
  invoice_total_value: number | null;
  currency: string | null;
  weight_kg: number | null;
  pallets: number | null;
  invoice_type: InvoiceType;
  clave: string | null;
  instruccion_especial: string | null;
  met_val: string | null;
  previo: string | null;
  china_bl_type: string | null;
  needs_aaa: boolean;
  pedimento_no: string | null;
  container_seal_no: string | null;
  modulation_status: string | null;
  is_critical: boolean | null;
  cartaporte_id: string | null;
  gps_link: string | null;
  file_shipping_date: string | null;
  atd_port: string | null;
  eta_port_by_origin: string | null;
  eta_port_update: string | null;
  bl_in_onedrive_date: string | null;
  instruction_date: string | null;
  reference_received_date: string | null;
  aaa_ready_date: string | null;
  bl_revalidation_date: string | null;
  proforma_creation_date: string | null;
  pedimento_approved_date: string | null;
  pedimento_payment_date: string | null;
  ata_port: string | null;
  vip_date: string | null;
  vip_result_date: string | null;
  effective_discharge_date: string | null;
  eta_customs_appointment: string | null;
  customs_release_date: string | null;
  transport_assignment_date: string | null;
  impact_date: string | null;
  eta_sam_goal: string | null;
  eta_sam_real: string | null;
  ata_sam: string | null;
  sam_discharge_date: string | null;
  empty_return_date: string | null;
  last_import_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ShipmentStatus =
  | "In origin (CH)"
  | "In transit to port"
  | "In Port (MX)"
  | "In customs"
  | "In transit to Plant"
  | "Delivered at Sanhua"
  | "Delivered at Sanhua/Empty Return"
  | "Review status";

export type ShipmentViewRow = ShipmentRow & {
  goal_date: string | null;
  status: ShipmentStatus;
  flagged: "ON TIME" | "DELAYED";
  days_in_progress: number | null;
};

type SystemColumns = "id" | "created_at" | "updated_at";
export type ShipmentInsert = Omit<Partial<ShipmentRow>, SystemColumns> & { invoice_no: string };

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ImportBatchRow = {
  id: string;
  file_name: string;
  sheet_name: string;
  uploaded_by: string;
  status: "processing" | "completed" | "failed";
  rows_total: number;
  rows_imported: number;
  rows_rejected: number;
  created_at: string;
  finished_at: string | null;
};

export type ImportIssueRow = {
  id: number;
  batch_id: string;
  row_number: number;
  invoice_no: string | null;
  field: string | null;
  value: string | null;
  severity: "error" | "warning";
  message: string;
};

export type AppSettingRow = {
  key: string;
  value: Json;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type AuditLogRow = {
  id: number;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Json | null;
  new_data: Json | null;
  actor_id: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      shipments: Table<ShipmentRow, ShipmentInsert>;
      profiles: Table<ProfileRow, Pick<ProfileRow, "id" | "email"> & Partial<ProfileRow>>;
      import_batches: Table<
        ImportBatchRow,
        Pick<ImportBatchRow, "file_name" | "sheet_name" | "uploaded_by"> & Partial<ImportBatchRow>
      >;
      import_issues: Table<ImportIssueRow, Omit<ImportIssueRow, "id">>;
      app_settings: Table<AppSettingRow, Pick<AppSettingRow, "key" | "value"> & Partial<AppSettingRow>>;
      audit_log: Table<AuditLogRow, never>;
    };
    Views: {
      shipments_view: { Row: ShipmentViewRow; Relationships: [] };
    };
    Functions: {
      my_role: { Args: Record<string, never>; Returns: AppRole | null };
    };
    Enums: {
      app_role: AppRole;
      invoice_type: InvoiceType;
    };
    CompositeTypes: Record<string, never>;
  };
};
