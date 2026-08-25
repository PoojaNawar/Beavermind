# BeaverMind — AI Call Quality Evaluation

A rubric-driven evaluation system for coaching and kick-off calls.

An operator selects a call type, pastes or uploads a transcript, and receives a persistent, evidence-backed evaluation with a web report and downloadable PDF.

The model evaluates individual dimensions. The application validates evidence, applies rubric rules, calculates the final score, and assigns the grade.

---

## What We Built

BeaverMind evaluates calls against a fixed 12-dimension rubric.

### Flow

Transcript
→ Evidence extraction
→ Evidence aggregation
→ Rubric evaluation
→ Quote verification
→ Deterministic scoring
→ Supabase
→ Web report / PDF

The system supports:

- Kick-off and Coaching calls
- Paste or `.txt` / `.md` transcript upload
- Long-transcript chunking
- Evidence verification
- 12-dimension scoring
- Red flags and One Thing
- Persistent evaluation URLs
- Processing-stage visibility
- Retry handling
- PDF reports
- Evaluation audit metadata

---

## The Problem

The original workflow relied on pasting transcripts into a general-purpose LLM and asking it to evaluate the call.

That creates several problems:

- **Inconsistent scoring** — the model can calculate different totals across runs.
- **Hallucinated evidence** — a model can invent or alter transcript quotes.
- **Poor auditability** — it is difficult to see how an evaluation was produced.
- **Long transcripts** — large calls can exceed practical model limits.
- **Untrusted arithmetic** — caps, totals and grade bands should follow the rubric exactly.

The goal was therefore not to build another transcript summarizer, but a controlled evaluation pipeline.

---

## Architecture

BeaverMind uses a map-reduce style pipeline for larger transcripts.

```text
Transcript
    ↓
Chunking (when required)
    ↓
Evidence extraction
    ↓
Deterministic aggregation
    ↓
Rubric synthesis
    ↓
Quote verification
    ↓
Deterministic scoring
    ↓
Supabase persistence
    ↓
Web report / PDF