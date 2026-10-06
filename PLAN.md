# Plan

## What the app does

Upload documents, ask a question in plain English, get a short answer that
uses only those documents and points to the passages it came from.

Two terms:

- **CRUD** = Create, Read, Update, Delete. The document-management half:
  upload a document, list them, edit one, delete one.
- **RAG** = Retrieval-Augmented Generation. The question-answering half:
  - **Retrieve:** find the few chunks most likely to contain the answer.
  - **Augment:** paste those chunks into the prompt alongside the question.
  - **Generate:** the LLM writes an answer from that pasted text and cites it.

The LLM cannot fetch or read the documents itself. It only sees what the
server puts in the prompt, so if search picks the wrong chunks the answer
will be wrong. Answer quality depends on retrieval quality.

## Architecture

```
┌──────────┐      ┌──────────────────────┐      ┌────────────┐
│ Browser  │ ───> │ Server (our code)    │ ───> │ Database   │
│ React    │ <─── │  • document manager  │ <─── │ documents  │
│ page     │      │  • chunker           │      │ chunks     │
└──────────┘      │  • search            │      └────────────┘
                  │  • answer builder    │ ───> LLM (Claude, over
                  └──────────────────────┘ <─── the internet)
```

- **Browser:** shows the page, sends clicks to the server. No logic, no secrets.
- **Server:** all our code. The only thing that talks to the database and the LLM.
- **Database:** stores documents and chunks, and does the search ranking.
- **LLM:** rented per call. Only sees what the server sends it.

The server sends the HTML page on first load. After that the browser sends
small requests and gets data back as JSON, and React redraws only the part of
the page that changed.

## Walkthrough

**Upload time (once per document).** A user uploads three research papers, on
drugs A, B, and C.

1. The browser sends each file to the server.
2. The server extracts the text (for PDFs), saves the document, splits the
   text into chunks, and saves every chunk, tagged with its document and its
   position in that document.

No LLM is involved. The chunks stay in the database until the document is
edited or deleted, and are reused for every later question.

**Question time (every question).** The user types "What was the conclusion
on drug B?"

1. The browser sends the question to the server.
2. **Retrieve:** the server passes the question to Postgres, which returns the
   5 best-matching chunks across all documents. Chunks from the drug B paper
   rank highest because they mention it most.
3. **Augment:** the server builds a prompt: the 5 chunks numbered [1] to [5],
   the question, and the rules (below).
4. **Generate:** the server sends the prompt to Claude and gets back an answer
   such as "The trial concluded drug B reduced symptoms by 30% [2]."
5. The server returns the answer plus the cited chunks, and the page shows the
   answer next to its source passages.

Asking a question stores nothing; it only reads.

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js (App Router): React front end + built-in server, one project |
| Language | TypeScript for both front end and back end |
| Hosting | Vercel, free hobby tier, deploys from `main` on every push |
| Database | Neon (hosted Postgres), accessed with plain SQL via `@neondatabase/serverless` |
| Search | Postgres built-in full-text search |
| LLM | Claude Haiku 4.5 via the Anthropic API (`@anthropic-ai/sdk`) |
| PDF text | `unpdf`, on the server |

Reasons for each are in `DECISIONS.md`.

## Data model

- `documents`: id, title, content (the full text), created_at, updated_at
- `chunks`: id, document_id (deleting a document automatically deletes its
  chunks), chunk_index (position in the document), content, and `search`, a
  column Postgres fills in automatically with the searchable form of the
  text, with an index on it so search is fast.

## The three pieces of logic

1. **Chunking** (`lib/chunk.ts`). Split the text into paragraphs at blank
   lines, then pack paragraphs into chunks of about 1,000 characters (roughly
   200 words). Repeat the last sentence or so of each chunk at the start of
   the next ("overlap"). Big enough to hold a complete thought, small enough
   that 5 chunks make a cheap prompt; the overlap stops an answer being cut in
   half at a chunk boundary. Both sizes are named constants so they can be tuned.
2. **Search** (`lib/search.ts`). One SQL query. Postgres drops filler words,
   reduces words to their root (test, tests, testing all match), scores every
   chunk against the question, and returns the top 5 with document titles.
   Match chunks containing ANY of the question's keywords, not ALL of them: a
   full question rarely has every word inside one chunk, and chunks matching
   more keywords still rank higher.
   Known limit: this matches words, not meaning. A question about "testing"
   can miss a passage that only says "clinical trials".
3. **Answering** (`lib/answer.ts`). Build the prompt with the chunks numbered
   [1] to [5] and these rules: answer only from the passages; cite the passage
   number for each claim; say "not found" if the answer is not there. If
   search returns nothing, skip the LLM call and return "not found".

**Keeping search in sync.** Creating a document chunks it. Editing one deletes
its old chunks and re-chunks, as a single all-or-nothing database transaction.
Deleting one removes its chunks automatically.

## Files

- `app/page.tsx`: the main page: question box, answer + sources, document list, upload form
- `app/documents/[id]/page.tsx`: view, edit, delete one document; shows its chunks
- `app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`: create, list, read, update, delete
- `app/api/search/route.ts`: question in, ranked chunks out
- `app/api/ask/route.ts`: question in, answer + cited chunks out
- `lib/db.ts`, `lib/chunk.ts`, `lib/pdf.ts`, `lib/search.ts`, `lib/answer.ts`
- `schema.sql`: the two tables
- `.env.local`: database URL and API key, never committed

## Roadmap

Each step is its own branch, ends with something visible, and merges to
`main` when its check passes.

| # | Branch | What gets built | Done when |
|---|---|---|---|
| 1 | `init-webapp` | Mac tools (Homebrew, Node, VS Code), Next.js starter, Neon and Anthropic accounts | Starter page loads at localhost:3000 and is pushed to GitHub |
| 2 | `document-upload` | Database tables; paste or upload text; list documents | An uploaded document is still listed after refreshing the page |
| 3 | `chunking` | Split on upload; document page shows its chunks | You can open a document and read its numbered chunks |
| 4 | `edit-delete` | Edit re-chunks; delete removes chunks | After an edit, the chunks shown match the new text |
| 5 | `pdf-upload` | Extract text from a PDF, then reuse steps 2-3 | A text-based PDF shows readable chunks; a scanned PDF gives a clear "no text found" message |
| 6 | `search` | Question box returns top 5 passages with document title and score. No LLM | "Where did Harry meet Sally?" puts the right passage in the top 5 |
| 7 | `llm-answers` | Answer with [1][2] citations shown beside the source passages | A known question is answered correctly with the right citation; an unanswerable one returns "not found" |
| 8 | (on `main`) | Connect repo to Vercel; add database URL and API key as environment variables; set a spending cap on the API key | The public URL passes the step 7 checks |

Search (6) is built and checked before the LLM (7) so that when an answer is
wrong, you can tell which half failed.

Suggested pace: step 1-2 Sunday, 3 Monday, 4-5 Tuesday, 6 Wednesday,
7 Thursday, 8 Friday, Saturday as buffer.

## Each step, in order

1. Claude says what is being built and why (under 5 plain sentences).
2. Claude writes the code.
3. Claude walks through what was written and the key choices.
4. Jason tries it in the browser against the "done when" check.
5. Claude updates `DECISIONS.md` and the status in `CLAUDE.md`, then commits.

Only Jason can do these (Claude prompts at the right moment): create the
Neon, Anthropic, and Vercel accounts, and paste the two secret values into
`.env.local`.

## Testing

A small set of test documents with known facts, including one short story with
a "where did X meet Y" answer, used for the step 6 and 7 checks.

## Later, not now

- **Eval set:** 10-15 questions with known answers and known source passages.
  Score two things separately: did search put the right chunk in the top 3-5,
  and was the final answer correct with the right citation. That shows whether
  a failure came from search or from the LLM. Also measure latency.
- Login, and limiting search to a user's own documents (an owner column on
  `documents` plus a filter in the search query).
- Embeddings / meaning-based search, if keyword search misses obvious answers.
