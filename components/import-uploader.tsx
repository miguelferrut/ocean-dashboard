"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { runImport, type ImportResult } from "@/app/(app)/imports/actions";
import { Alert, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024;

type Phase = "idle" | "uploading" | "importing";

export function ImportUploader({ userId }: { userId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }>["summary"] | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const file = inputRef.current?.files?.[0];
    if (!file) return setError("Choose an .xlsx file first.");
    if (!file.name.toLowerCase().endsWith(".xlsx")) return setError("Only .xlsx workbooks are supported.");
    if (file.size > MAX_BYTES) return setError("The file is larger than 50 MB.");

    // Upload straight to private storage (bypasses the 4.5 MB serverless request limit),
    // then ask the server to process it. The storage policy confines writes to the user's folder.
    setPhase("uploading");
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${new Date().toISOString().replace(/[:.]/g, "-")}_${safeName}`;
    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from("imports").upload(path, file, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
    if (upErr) {
      setPhase("idle");
      return setError(`Upload failed: ${upErr.message}`);
    }

    setPhase("importing");
    const res = await runImport({ storagePath: path, fileName: file.name });
    setPhase("idle");
    if (!res.ok) return setError(res.error);
    setResult(res.summary);
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = phase !== "idle";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="workbook" className="text-sm font-semibold">
          Ocean Master Data Base workbook (.xlsx)
        </label>
        <input
          ref={inputRef}
          id="workbook"
          name="workbook"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-3 file:py-2 file:font-semibold"
        />
        <p className="text-xs text-muted">
          Reads the <strong>Ocean_Traffic_Report</strong> sheet. Rows are matched by invoice number: existing
          invoices are updated, new ones added, and invoices missing from the file are kept.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          {phase === "uploading" ? "Uploading…" : phase === "importing" ? "Importing…" : "Upload and import"}
        </Button>
      </div>
      <div aria-live="polite">
        {error && <Alert tone="error">{error}</Alert>}
        {result && (
          <Alert tone={result.rejected ? "warning" : "success"}>
            Imported {result.imported} of {result.totalRows} rows
            {result.rejected > 0 && <> · {result.rejected} rejected</>}
            {result.warnings > 0 && <> · {result.warnings} warnings</>}.{" "}
            <Link href={`/imports/${result.batchId}`} className="underline">
              See the report
            </Link>
          </Alert>
        )}
      </div>
    </form>
  );
}
