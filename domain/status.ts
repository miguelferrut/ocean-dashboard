import type { ShipmentStatus } from "@/types/database.types";

// Pipeline order, origin → plant. Status itself is computed in Postgres (shipments_view);
// this order is used to sort, colour, and roll invoices up to a container.
export const STATUS_ORDER: ShipmentStatus[] = [
  "Review status",
  "In origin (CH)",
  "In transit to port",
  "In Port (MX)",
  "In customs",
  "In transit to Plant",
  "Delivered at Sanhua",
  "Delivered at Sanhua/Empty Return",
];

export const statusRank = (s: ShipmentStatus) => STATUS_ORDER.indexOf(s);

export const isDelivered = (s: ShipmentStatus) => s.startsWith("Delivered");

export type StatusTone = "neutral" | "info" | "warning" | "progress" | "success" | "danger";

export const STATUS_TONE: Record<ShipmentStatus, StatusTone> = {
  "Review status": "danger",
  "In origin (CH)": "neutral",
  "In transit to port": "info",
  "In Port (MX)": "warning",
  "In customs": "warning",
  "In transit to Plant": "progress",
  "Delivered at Sanhua": "success",
  "Delivered at Sanhua/Empty Return": "success",
};

/** A container's status is its least advanced invoice: the container isn't through until every invoice is. */
export function rollUpStatus(statuses: ShipmentStatus[]): ShipmentStatus {
  return statuses.reduce((min, s) => (statusRank(s) < statusRank(min) ? s : min), statuses[0]);
}
