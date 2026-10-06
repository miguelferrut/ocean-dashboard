import { cn } from "@/components/ui";

export type BarDatum = { label: string; value: number; display?: string; hint?: string };

/**
 * Single-series horizontal bar chart in plain HTML: server-rendered, zero client JS.
 * Bars use one hue (the series is named by the card title), values are direct-labelled, each
 * row has a hover tooltip, and a <details> table gives screen readers the exact numbers.
 */
export function BarList({
  data,
  max,
  caption,
  valueHeader = "Value",
  emptyText = "No data",
}: {
  data: BarDatum[];
  max?: number;
  caption: string;
  valueHeader?: string;
  emptyText?: string;
}) {
  if (!data.length) return <p className="text-sm text-muted">{emptyText}</p>;
  const top = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <figure>
      <ul className="flex flex-col gap-2" aria-hidden="true">
        {data.map((d) => (
          <li key={d.label} className="group grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${d.display ?? d.value}${d.hint ? ` — ${d.hint}` : ""}`}>
            <span className="truncate text-muted group-hover:text-ink">{d.label}</span>
            <span className="h-3 rounded-r bg-[var(--grid)]">
              <span
                className={cn("block h-3 rounded-r bg-[var(--chart)] transition-opacity group-hover:opacity-80")}
                style={{ width: `${Math.max((d.value / top) * 100, d.value > 0 ? 1.5 : 0)}%` }}
              />
            </span>
            <span className="tabular w-14 text-right font-semibold">{d.display ?? d.value}</span>
          </li>
        ))}
      </ul>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 font-semibold">Category</th>
              <th scope="col" className="py-1 text-right font-semibold">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="tabular py-1 text-right">{d.display ?? d.value}{d.hint ? ` (${d.hint})` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
