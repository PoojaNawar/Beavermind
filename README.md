# Call evaluation exercise

Stage two of hiring for the AI-Native Developer role at [BeaverMind](https://beavermind.ai).

This is a real slice of a system we built and run for a client. We cut one piece
out, changed every name in it, and put the client's scoring rubric in this repo.
Nothing here has been turned into a working evaluator yet. Doing that is the
exercise.

Read this whole file before you start. The constraints are the exercise, not the
paperwork around it.

## What you are building

An operator pastes a call transcript into a page and says whether it is a
kick-off or a coaching call. Your system scores that call against the rubric for
that call type and produces a report, and a PDF of it.

## What you deliver

1. A deployed URL on Vercel. Not a repo we have to run.
2. A GitHub repo we can read.
3. A Supabase database behind it.
4. One page of written defence. One page means one page.

## Constraints

**Every run has its own URL.** I paste a transcript, I get a link, I send that
link to a colleague and they see the same evaluation. I open it again next week
and it is still there.

**I can close the tab.** The evaluation keeps running once the browser is gone.
When I come back to the run URL it has finished, or it is still going, and either
way the page tells me which.

**A failed run says why.** Not a spinner that spins forever.

**Evidence or nothing.** Every dimension score carries the verbatim transcript
lines it rests on. When a behaviour is not in the transcript, the dimension says
so. It does not guess, and it does not read the general mood of the call. One of
the four transcripts exists to catch a system that guesses.

**The PDF is what the client sees.**

## What the report has to contain

This is the output, not a suggestion for one. Every item here comes from the
report the client reads today.

- **A total and a grade.** The score out of 100 and the band it falls in. The
  rubric defines both.
- **A verdict.** A few sentences on how the call went, written to the coach.
- **The one thing.** The single change that moves the number most, and what the
  call would have scored with it.
- **Retention risk.** Low, medium or high, with the reason. A good-looking score
  can still hide a client about to leave.
- **Every dimension, in full.** Score out of its maximum, the band it landed in,
  why it landed there, the transcript lines that reasoning rests on, and what the
  coach should do differently next time.
- **A PDF.** The coach reads it on a phone or prints it.

## Getting the files

Green **Code** button, then **Download ZIP**. Or clone it:

```
git clone https://github.com/lukecala/hiring-ai-dev-exercise.git
```

Do not open a pull request against this repo. Your work lives in your own.

## What is in here

### `rubrics/`

Two scoring rubrics, in the form the client wrote them.

| File | What it is |
|---|---|
| `kickoff-call-rubric.md` | 12 dimensions, 100 points, bands from Elite to Fail, a table of automatic caps, and calibration notes from real reviewer corrections. |
| `coaching-call-rubric.md` | 12 dimensions, 100 points, three pillars, automatic caps, and one dimension that switches off when the call had no movement coaching. |

These are grading documents written for humans. They are not instructions to a
model, and nobody has adapted them into any. Turning one into something that
scores a transcript the same way twice is the work.

### `transcripts/`

Four calls, two per rubric. They are synthetic. They are not all good calls, and
that is deliberate.

| File | Rubric | Size |
|---|---|---|
| `kickoff-01.txt` | kick-off | 35 kB |
| `kickoff-02.txt` | kick-off | 15 kB |
| `coaching-01.txt` | coaching | 36 kB |
| `coaching-02.txt` | coaching | 65 kB |

Every line is one speaking turn, `[Speaker Name]: what they said`. No
timestamps. That is the same flat text our pipeline sees in production once it
has flattened the recorder payload.

## What we do not tell you

How the rubric reaches the model and how a scored answer comes back. Which
tables. Which model or provider. How to keep work running after the response is
sent. How to get structured output out of a language model. Whether the PDF
renders in the browser or on the server. What to do with a transcript of 65,000
characters.

Those are the decisions we are hiring for. Make them, and be ready to say why.

## Cost and time

Use any model you like, cheap ones included. We are not grading how clever the
model is, we are grading the system you put around it. Keep spend under 20 EUR.

Budget eight hours of work across three days. If you spend thirty hours we will
see it in the repo and it counts against you. Knowing what to leave out is part
of the job.

## How we review it

Fifteen minutes, live, screen shared. We run your deployed app on a transcript
in front of you. Then we ask why: why that table, why that model, why that
number, why this way and not the other way.

Use whatever tools you want while you build. AI included, nothing is banned. In
the review there is no AI in the room, only you and the choices you made.

## Submit

Reply to the email you got this from with the deployed URL, the repo URL, and
your one page.

---

The people, the company and the calls in this repo are invented. Any resemblance
to a real coaching business is the point and the coincidence.
