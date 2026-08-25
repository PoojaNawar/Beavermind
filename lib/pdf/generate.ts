import PDFDocument from "pdfkit";
import type { EvaluationAudit, EvaluationResult } from "@/lib/rubrics/types";
import {
  dimensionEvidenceUi,
  hydrateEvaluationResult,
} from "@/lib/transcripts/evidenceQuality";

function callTypeLabel(callType: string): string {
  return callType === "kickoff" ? "Kick-off Call" : "Coaching Call";
}

export async function buildEvaluationPdf(
  result: EvaluationResult,
  meta: {
    id: string;
    createdAt: string;
    audit?: EvaluationAudit | null;
    rubricVersion?: string;
    modelName?: string | null;
  },
): Promise<Buffer> {
  result = hydrateEvaluationResult(result);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: "LETTER",
      info: {
        Title: `Call Evaluation — ${callTypeLabel(result.callType)}`,
        Author: "BeaverMind Call Evaluator",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ink = "#1a1f1c";
    const muted = "#5c675f";
    const accent = "#2f5d50";
    const rule = "#d5ddd8";

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > doc.page.height - 50) {
        doc.addPage();
      }
    };

    const h1 = (text: string) => {
      ensureSpace(36);
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text(text);
      doc.moveDown(0.4);
    };

    const h2 = (text: string) => {
      ensureSpace(28);
      doc.fillColor(accent).font("Helvetica-Bold").fontSize(12).text(text);
      doc.moveDown(0.25);
    };

    const body = (text: string) => {
      doc.fillColor(ink).font("Helvetica").fontSize(10).text(text, {
        lineGap: 2,
      });
      doc.moveDown(0.4);
    };

    const metaLine = (text: string) => {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text(text);
    };

    // Header
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(11).text("BEAVERMIND");
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("Call Quality Evaluation");
    doc.moveDown(0.3);
    metaLine(`${callTypeLabel(result.callType)}  ·  Rubric ${result.rubricVersion}`);
    metaLine(`Evaluation ID: ${meta.id}`);
    metaLine(`Created: ${new Date(meta.createdAt).toLocaleString()}`);
    metaLine(`Model: ${result.modelName}`);
    doc.moveDown(0.6);
    doc
      .strokeColor(rule)
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(0.8);

    // Score
    h2("Overall");
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(`${result.overallScore}`, { continued: true })
      .font("Helvetica")
      .fontSize(14)
      .fillColor(muted)
      .text(` / 100`);
    doc
      .fillColor(accent)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(result.grade);
    if (result.scoreOutOf !== 100) {
      metaLine(
        `Raw score normalized from ${result.scoreOutOf} available points (optional dimensions disabled/N/A).`,
      );
    }
    doc.moveDown(0.3);
    h2("One Thing");
    body(result.oneThing.recommendation);
    body(`Why it matters: ${result.oneThing.impact}`);
    if (result.oneThing.scoreIfApplied !== null) {
      body(
        `Projected score if applied: ${result.oneThing.scoreIfApplied}/100 — ${result.oneThing.scoreIfAppliedBasis}`,
      );
    } else {
      body(
        `Projected score: not reliably determinable. ${result.oneThing.scoreIfAppliedBasis}`,
      );
    }

    h2("Brief");
    body(result.brief);

    h2("Red Flags");
    if (result.redFlags.length === 0) {
      body("No red flags identified from transcript evidence.");
    } else {
      for (const flag of result.redFlags) {
        ensureSpace(60);
        doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(flag.title);
        body(flag.explanation);
        doc
          .fillColor(muted)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text(`Evidence: ${flag.evidence}`);
        doc.moveDown(0.5);
      }
    }

    h2("Evidence quality");
    body(
      `Found: ${result.evidenceQuality.found}  ·  Verified: ${result.evidenceQuality.verified}  ·  Rejected: ${result.evidenceQuality.rejected}  ·  Not demonstrated: ${result.evidenceQuality.notDemonstratedDimensions} dimensions`,
    );
    if (result.firedCaps.length > 0) {
      body(
        `Caps applied: ${result.firedCaps.map((c) => c.effect).join("; ")}`,
      );
    }
    doc.moveDown(0.4);

    h1("Twelve Dimensions");

    for (const dim of result.dimensions) {
      ensureSpace(120);
      const scoreLabel = dim.disabled
        ? "Disabled"
        : dim.notApplicable
          ? "N/A"
          : `${dim.score}/${dim.maxScore}`;

      doc
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`${dim.name}`, { continued: true })
        .font("Helvetica")
        .fillColor(muted)
        .text(`  —  ${scoreLabel}${dim.band ? ` (${dim.band})` : ""}`);

      if (dim.disabled && dim.disabledReason) {
        body(`Disabled: ${dim.disabledReason}`);
      }
      if (dim.notApplicable && dim.notApplicableReason) {
        body(`Not applicable: ${dim.notApplicableReason}`);
      }

      if (!dim.disabled && !dim.notApplicable) {
        const evidenceUi = dimensionEvidenceUi(dim);
        doc
          .fillColor(
            evidenceUi.tone === "warning" || evidenceUi.tone === "caution"
              ? "#8a5a2b"
              : muted,
          )
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(`Evidence status: ${evidenceUi.label}`);
        doc
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(9)
          .text(`Evidence strength: ${dim.evidenceStrength} (does not affect score)`);
        if (evidenceUi.explanation) {
          doc
            .fillColor(ink)
            .font("Helvetica")
            .fontSize(9)
            .text(evidenceUi.explanation);
        }
        doc.moveDown(0.2);
      }

      body(dim.rationale);

      const verified = dim.evidence.filter((e) => e.verificationStatus === "verified");
      const unverified = dim.evidence.filter((e) => e.verificationStatus === "unverified");
      const ndItems = dim.evidence.filter(
        (e) => e.verificationStatus === "not_demonstrated",
      );

      doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("Verified evidence");
      if (verified.length === 0 && unverified.length === 0 && ndItems.length === 0) {
        body("No transcript evidence attached.");
      }
      for (const ev of verified) {
        const speaker = ev.speaker ? `[${ev.speaker}] ` : "";
        const loc = ev.location ? ` (${ev.location})` : "";
        doc
          .fillColor(ink)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text(`“${ev.quote}” — ${speaker}VERIFIED${loc}`);
      }
      for (const ev of ndItems) {
        doc
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(9)
          .text(`${ev.quote} — NOT DEMONSTRATED`);
      }
      if (unverified.length > 0) {
        doc
          .fillColor("#8a5a2b")
          .font("Helvetica-Bold")
          .fontSize(9)
          .text("Proposed but unverified evidence");
        for (const ev of unverified) {
          const speaker = ev.speaker ? `[${ev.speaker}] ` : "";
          doc
            .fillColor(ink)
            .font("Helvetica-Oblique")
            .fontSize(9)
            .text(`“${ev.quote}” — ${speaker}UNVERIFIED — not found in original transcript`);
        }
      }
      doc.moveDown(0.3);

      doc.fillColor(accent).font("Helvetica-Bold").fontSize(9).text("Quick fix");
      body(dim.quickFix);

      doc
        .strokeColor(rule)
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();
      doc.moveDown(0.6);
    }

    const audit = meta.audit;
    metaLine(
      `Pipeline: ${audit?.pipelineVersion ?? "Not recorded"}  ·  Path: ${audit?.processingPath ?? "Not recorded"}  ·  Model: ${meta.modelName ?? result.modelName ?? "Not recorded"}`,
    );
    metaLine(`Evaluation ID: ${meta.id}`);

    doc.end();
  });
}
