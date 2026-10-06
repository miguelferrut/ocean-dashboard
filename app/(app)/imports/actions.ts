"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { importWorkbook, type ImportSummary } from "@/services/import.service";

const input = z.object({
  storagePath: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
});

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

export async function runImport(raw: { storagePath: string; fileName: string }): Promise<ImportResult> {
  const auth = await checkPermission("shipments:import");
  if (!auth.ok) return auth;

  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid upload reference." };
  // The storage policy only lets users write under their own folder; refuse anything else.
  if (!parsed.data.storagePath.startsWith(`${auth.user.id}/`) || parsed.data.storagePath.includes("..")) {
    return { ok: false, error: "Invalid upload reference." };
  }

  try {
    const supabase = await createClient();
    const summary = await importWorkbook(supabase, auth.user.id, parsed.data.storagePath, parsed.data.fileName);
    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }
}
