import { describe, expect, it } from "vitest";
import { cleanText, parseBool, parseDate, parseId, parseNumber, upperText, type Issue } from "@/domain/normalize";

describe("cleanText", () => {
  it("treats placeholders as empty", () => {
    for (const v of ["TBD", "n/a", "NA", "NEEDS", "pending", "--", "#VALUE!", "  ", null]) {
      expect(cleanText(v)).toBeNull();
    }
  });
  it("collapses whitespace", () => {
    expect(cleanText("  Sanhua \n Singapore ")).toBe("Sanhua Singapore");
  });
});

describe("upperText", () => {
  it("applies aliases", () => {
    expect(upperText("cyn", "currency")).toBe("CNY");
    expect(upperText("Hapag Lloyd", "shipping_line")).toBe("HAPAG-LLOYD");
  });
});

describe("parseDate", () => {
  const run = (v: unknown) => {
    const issues: Issue[] = [];
    return { value: parseDate(v, "F", issues), issues };
  };

  it("reads Date objects in UTC", () => {
    expect(run(new Date(Date.UTC(2026, 5, 5))).value).toBe("2026-06-05");
  });
  it("reads Excel serial numbers", () => {
    expect(run(46178).value).toBe("2026-06-05");
  });
  it("reads ISO and day-first strings", () => {
    expect(run("2026-06-05").value).toBe("2026-06-05");
    expect(run("05/06/2026").value).toBe("2026-06-05");
    expect(run("13/06/2026").value).toBe("2026-06-13");
    expect(run("06/13/2026").value).toBe("2026-06-13");
  });
  it("returns null without an issue for placeholders", () => {
    expect(run("TBD")).toEqual({ value: null, issues: [] });
  });
  it("reports garbage", () => {
    const r = run("next week");
    expect(r.value).toBeNull();
    expect(r.issues).toHaveLength(1);
  });
  it("rejects impossible dates", () => {
    expect(run("2026-02-30").value).toBeNull();
  });
});

describe("parseNumber", () => {
  it("strips thousands separators and units", () => {
    const issues: Issue[] = [];
    expect(parseNumber("1,067,975.45", "v", issues)).toBe(1067975.45);
    expect(parseNumber("11130kg", "v", issues)).toBe(11130);
    expect(issues).toHaveLength(0);
  });
  it("reports non-numbers", () => {
    const issues: Issue[] = [];
    expect(parseNumber("abc", "v", issues)).toBeNull();
    expect(issues).toHaveLength(1);
  });
});

describe("parseBool / parseId", () => {
  it("parses booleans", () => {
    expect(parseBool(true)).toBe(true);
    expect(parseBool("Sí")).toBe(true);
    expect(parseBool("0")).toBe(false);
    expect(parseBool("#VALUE!")).toBeNull();
  });
  it("normalises identifiers", () => {
    expect(parseId(" pidu 4077791 ")).toBe("PIDU4077791");
    expect(parseId(692100362)).toBe("692100362");
    expect(parseId("TBD")).toBeNull();
  });
});
