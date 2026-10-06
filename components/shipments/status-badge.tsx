import { Badge } from "@/components/ui";
import { STATUS_TONE } from "@/domain/status";
import type { ShipmentStatus } from "@/types/database.types";

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

export function FlagBadge({ flagged }: { flagged: "ON TIME" | "DELAYED" }) {
  return flagged === "DELAYED" ? <Badge tone="danger">⚠ Delayed</Badge> : <Badge tone="success">✓ On time</Badge>;
}
