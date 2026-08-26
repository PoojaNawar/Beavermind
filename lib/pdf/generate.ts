import PDFDocument from "pdfkit";
import type { EvaluationAudit, EvaluationResult } from "@/lib/rubrics/types";
import { hydrateCompletedReport } from "@/lib/scoring/hydrateReport";
import { presentQuickFix } from "@/lib/ui/quickFixDisplay";
import { quickFixForPdf } from "@/lib/ui/quickFixTypography";
import { pdfSafeText } from "@/lib/pdf/text";
import {
  briefSections,
  dimensionImpact,
  impactLabel,
  notApplicableCopy,
  scoreExplanation,
  scoreHeadline,
  scoringNotes,
} from "@/lib/ui/reportPresentation";
import { coachingPillars } from "@/lib/scoring/scoreIfApplied";

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
    clientName?: string | null;
    coachName?: string | null;
    clientDetails?: string | null;
    transcript?: string | null;
  },
): Promise<Buffer> {
  try {
    result = hydrateCompletedReport(result, meta.transcript);
  } catch (err) {
    console.warn(
      `[pdf] hydrateCompletedReport failed; using stored result: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: "LETTER",
      info: {
        Title: pdfSafeText(`Call Evaluation - ${callTypeLabel(result.callType)}`),
        Author: "BeaverMind Call Evaluator",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ink = "#111111";
    const muted = "#6b6b6b";
    const accent = "#111111";
    const rule = "#e4e1da";

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > doc.page.height - 50) {
        doc.addPage();
      }
    };

    const h1 = (text: string) => {
      ensureSpace(36);
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text(pdfSafeText(text));
      doc.moveDown(0.4);
    };

    const h2 = (text: string) => {
      ensureSpace(28);
      doc.fillColor(accent).font("Helvetica-Bold").fontSize(12).text(pdfSafeText(text));
      doc.moveDown(0.25);
    };

    const body = (text: string) => {
      doc.fillColor(ink).font("Helvetica").fontSize(10).text(pdfSafeText(text), {
        lineGap: 2,
      });
      doc.moveDown(0.4);
    };

    const metaLine = (text: string) => {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text(pdfSafeText(text));
    };

    // Header
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text(pdfSafeText("BEAVERMIND  |  FULL ANALYSIS"));
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(pdfSafeText(meta.clientName?.trim() || callTypeLabel(result.callType)));
    doc.moveDown(0.3);
    if (meta.coachName?.trim()) {
      metaLine(`Coached by ${meta.coachName.trim()}`);
    }
    if (meta.clientDetails?.trim()) {
      metaLine(meta.clientDetails.trim());
    }
    metaLine(`${callTypeLabel(result.callType)}  ·  ${result.rubricVersion}`);
    metaLine(`Evaluation ID: ${meta.id}`);
    metaLine(`Created: ${new Date(meta.createdAt).toLocaleString()}`);
    doc.moveDown(0.6);
    doc
      .strokeColor(rule)
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(0.8);

    const notes = scoringNotes(result);
    const brief = briefSections(result);
    const headline = scoreHeadline(result);

    h2("Score");
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(pdfSafeText(`${result.overallScore}`), { continued: true })
      .font("Helvetica")
      .fontSize(14)
      .fillColor(muted)
      .text(pdfSafeText(` / 100`));
    doc
      .fillColor(accent)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(pdfSafeText(result.grade.toUpperCase()));
    metaLine(`Based on ${result.scoreOutOf} applicable points`);
    doc.moveDown(0.25);
    body(headline);

    h2("One Thing");
    body(result.oneThing.recommendation);
    if (result.oneThing.impact) {
      body(result.oneThing.impact);
    }
    if (result.oneThing.scoreIfApplied !== null) {
      body(
        `If applied: ${result.oneThing.scoreIfApplied}/100 — ${result.oneThing.scoreIfAppliedBasis}`,
      );
    } else if (result.oneThing.scoreIfAppliedBasis) {
      body(result.oneThing.scoreIfAppliedBasis);
    }

    if (result.callType === "coaching") {
      const pillars = coachingPillars(result);
      if (pillars.length > 0) {
        h2("Pillars");
        metaLine("Connection · Confidence · Continuity");
        doc.moveDown(0.2);
        for (const pillar of pillars) {
          const pct =
            pillar.ratio === null ? 0 : Math.round(pillar.ratio * 100);
          ensureSpace(40);
          doc
            .fillColor(ink)
            .font("Helvetica-Bold")
            .fontSize(10)
            .text(
              pdfSafeText(
                `${pillar.name}  ${pct}%  (${pillar.earned}/${pillar.available})`,
              ),
            );
          if (pillar.dragged) {
            metaLine("Dragged the score");
          }
          if (pillar.weakest) {
            metaLine(
              `Weakest: ${pillar.weakest.name} (${pillar.weakest.score}/${pillar.weakest.maxScore})`,
            );
          } else {
            metaLine("Full marks across this pillar");
          }
          doc.moveDown(0.25);
        }
      }
    }

    h2("What went well");
    body(brief.well);
    h2("What held the score back");
    body(brief.held);
    h2("What to do next");
    body(brief.next);

    if (result.redFlags.length > 0) {
      h2("Red Flags");
      for (const flag of result.redFlags) {
        ensureSpace(60);
        doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(pdfSafeText(flag.title));
        body(flag.explanation);
      }
    }

    h2("Evidence quality");
    body(
      `${result.evidenceQuality.verified} / ${result.evidenceQuality.found} verified`,
    );
    metaLine(
      `${result.evidenceQuality.rejected} rejected  ·  ${result.evidenceQuality.notDemonstratedDimensions} not demonstrated`,
    );
    doc.moveDown(0.3);

    if (notes.length > 0) {
      h2("Scoring notes");
      for (const note of notes) {
        body(`*  ${note}`);
      }
    }

    h1("Dimensions");
    metaLine(`${result.dimensions.length} evaluation dimensions`);
    doc.moveDown(0.4);

    for (const [index, dim] of result.dimensions.entries()) {
      ensureSpace(120);
      const na = notApplicableCopy(dim);
      const scoreLabel = na ? "Not applicable" : `${dim.score}/${dim.maxScore}`;
      const impact = dimensionImpact(dim, result);

      doc
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(pdfSafeText(`${index + 1}.  ${dim.name}`), { continued: true })
        .font("Helvetica-Bold")
        .fillColor(muted)
        .text(pdfSafeText(`    ${scoreLabel}`));

      if (impact) {
        metaLine(impactLabel(impact).toUpperCase());
      }

      body(na ? na.explanation : scoreExplanation(dim));

      const verified = dim.evidence.filter((e) => e.verificationStatus === "verified");
      const unverified = dim.evidence.filter((e) => e.verificationStatus === "unverified");
      const ndItems = dim.evidence.filter(
        (e) => e.verificationStatus === "not_demonstrated",
      );

      doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("EVIDENCE");
      doc.moveDown(0.15);
      if (verified.length === 0 && unverified.length === 0 && ndItems.length === 0) {
        body(na ? "This dimension was not scored." : "No transcript evidence attached.");
      }
      for (const ev of verified) {
        const speaker = ev.speaker ? `${ev.speaker}: ` : "";
        const loc = ev.location ? ` (${ev.location})` : "";
        doc
          .fillColor(ink)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text(pdfSafeText(`VERIFIED  ${speaker}"${ev.quote}"${loc}`));
        metaLine("Evidence appears in transcript.");
      }
      for (const ev of unverified) {
        const speaker = ev.speaker ? `${ev.speaker}: ` : "";
        doc
          .fillColor("#8a5a2b")
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text(pdfSafeText(`UNVERIFIED  ${speaker}"${ev.quote}"`));
        metaLine("Proposed evidence could not be found in transcript.");
      }
      for (const ev of ndItems) {
        doc
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(9)
          .text(pdfSafeText(`NOT DEMONSTRATED  ${ev.quote}`));
        metaLine("Insufficient evidence that the behavior occurred.");
      }
      doc.moveDown(0.3);

      const quickFix = presentQuickFix(dim, result.callType);
      if (quickFix) {
        doc.fillColor(muted).font("Helvetica-Bold").fontSize(9).text("QUICK FIX");
        doc.moveDown(0.15);
        doc
          .fillColor(ink)
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(
            quickFixForPdf(
              quickFix.complete ? "Full marks reached" : quickFix.title,
            ),
          );
        if (quickFix.body) {
          doc.moveDown(0.12);
          body(quickFixForPdf(quickFix.body));
        } else {
          doc.moveDown(0.35);
        }
        if (quickFix.steps && quickFix.steps.length > 0) {
          for (const step of quickFix.steps) {
            doc
              .fillColor(ink)
              .font("Helvetica")
              .fontSize(10)
              .text(pdfSafeText(`*  ${quickFixForPdf(step)}`), {
                indent: 12,
                lineGap: 1,
              });
          }
          doc.moveDown(0.35);
        }
      }

      doc
        .strokeColor(rule)
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();
      doc.moveDown(0.6);
    }

    metaLine(`Evaluation ID: ${meta.id}`);

    doc.end();
  });
}
