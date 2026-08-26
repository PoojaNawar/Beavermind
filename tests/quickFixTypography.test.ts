import { describe, expect, it } from "vitest";
import {
  quickFixForDisplay,
  quickFixForPdf,
  sanitizeQuickFixTypography,
} from "@/lib/ui/quickFixTypography";

describe("quick fix typography", () => {
  it("replaces malformed separators with a clean ASCII arrow", () => {
    expect(
      sanitizeQuickFixTypography(
        "Confirm the diagnostic !' film !' upload pipeline",
      ),
    ).toBe("Confirm the diagnostic -> film -> upload pipeline");
  });

  it("normalizes unicode arrows for storage and PDF", () => {
    expect(
      sanitizeQuickFixTypography("diagnostics → film → upload"),
    ).toBe("diagnostics -> film -> upload");
    expect(quickFixForPdf("diagnostics → film → upload")).toBe(
      "diagnostics -> film -> upload",
    );
  });

  it("uses a real arrow only in the web display form", () => {
    expect(quickFixForDisplay("diagnostic -> film -> upload")).toBe(
      "diagnostic → film → upload",
    );
  });

  it("collapses duplicated punctuation", () => {
    expect(sanitizeQuickFixTypography("Lock the North Star..  then confirm.")).toBe(
      "Lock the North Star. then confirm.",
    );
  });
});
