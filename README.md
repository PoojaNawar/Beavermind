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

Three things, and all three have to be there.

1. **A public GitHub repo.** The source code, readable by us without an invite.
2. **The deployed link.** Your app on Vercel, live, so we can paste a transcript
   into it ourselves.
3. **A Loom, webcam on.** Walk us through what you built and why you built it
   that way. The decisions, the trade-offs, what fought you. This is the part no
   tool can write for you.

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

- **The one thing.** The single change that moves the number most, and what the
  call would have scored with it.
- **The brief.** A few sentences on how the call went, written to the coach.
- **Red flags.** What puts this client at risk of leaving, and why. A
  good-looking score can still hide one.
- **A grade and a total.** The score out of 100 and the stage it puts the call
  in, from at risk up to excellent. The rubric defines both.
- **Twelve dimensions, each one openable.** Score out of its maximum, the
  reasoning behind it, the transcript lines that reasoning rests on, and the
  quick fix: what the coach had to do to reach full marks.
- **A download PDF button.** It gives the coach the same report as a file. Taste
  in how it looks earns points.

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

## Time and tools

Three or four hours. That is what this took to scope, so that is what we are
asking for. Do your best inside it. Knowing what to leave out is part of the job.

Supabase and Vercel unless you have a reason to do otherwise. Both are free at
this size and we can open your app and click around in it. Bring your own API
key or your own subscription for the model.

Any tool while you build, AI included. Nothing is banned. Use what you would use
on a Tuesday. We read the decisions, not the keystrokes.

No voice agent, and no scope you were not asked for. Kick-off and coaching
calls, scored from a pasted transcript. That is the whole surface.

## Submit

Reply to the email you got this from with all three.

---

The company, the coaches and the clients in this repo are invented, and so are
the calls. Nothing here comes from a real recording.
