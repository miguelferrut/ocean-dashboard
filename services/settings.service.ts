import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  goalAllowance: { Normal: number; Aluminum: number; Prototype: number };
  targets: { customsDays: number; inlandDays: number };
};

const DEFAULTS: AppSettings = {
  goalAllowance: { Normal: 7, Aluminum: 12, Prototype: 20 },
  targets: { customsDays: 10, inlandDays: 3 },
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key,value");
  const byKey = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    goalAllowance: { ...DEFAULTS.goalAllowance, ...(byKey.goal_allowance_days as object) },
    targets: { ...DEFAULTS.targets, ...(byKey.targets as object) },
  };
});
