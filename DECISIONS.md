# Decisions

What was chosen, why, and what was turned down. Newest entries at the bottom.

## 2026-10-04: planning

### Generated answers with citations, not just ranked passages
- **Chose:** full RAG: retrieve passages, then have an LLM write a cited answer.
- **Why:** the assignment mentioned RAG and chunking. The search step alone
  already returns ranked passages, so if only that is wanted, it is covered.
- **Open:** confirm with the colleague which one she wants.

### Next.js (React + TypeScript) for the whole app
- **Chose:** one Next.js project. React pages in the browser, Next.js's
  built-in server for the back end, TypeScript in both.
- **Why:** React is the industry-standard front end. Next.js is the simplest
  way to get React plus a server in one project, with one language and one
  deploy. Fewer moving parts while learning everything at once.
- **Turned down:**
  - Python back end (FastAPI) + Next.js front end: the most common shape for
    AI apps, and the logic would be in a familiar language, but it is two
    projects to wire together and deploy (about 1-2 extra hours).
  - Python server generating plain HTML pages: simplest of all, but no React.
- **Note:** language choice does not affect speed here. Nearly all the wait
  per question is the LLM writing its answer.

### Vercel for hosting
- **Chose:** Vercel, free hobby tier.
- **Why:** Vercel makes Next.js, so deploying needs almost no configuration:
  connect the GitHub repo and every push to `main` updates the live site.

### Hosted Postgres (Neon), not SQLite
- **Chose:** Neon, accessed with plain SQL (no ORM, which is a layer that
  writes SQL for you).
- **Why:** Vercel's servers have no permanent local disk, so a file-based
  database like SQLite would lose its data. Postgres also has search ranking
  built in, so one tool both stores the documents and searches them. Plain SQL
  keeps every query readable in the diff.

### Keyword search only, no embeddings
- **Chose:** Postgres full-text search.
- **Why:** it is built in and needs no ranking code. It is smarter than
  Ctrl+F: it ignores filler words, treats test/tests/testing as one word, and
  ranks chunks by how well they match.
- **Known limit:** it matches words, not meaning. Asking about "testing" can
  miss a passage that says "clinical trials".
- **Turned down for now:** embeddings (meaning-based search) and hybrid
  search. Revisit if keyword search misses obvious answers.

### Match ANY keyword, not ALL
- **Chose:** a chunk matches if it contains any of the question's keywords;
  chunks with more matches rank higher.
- **Why:** a full question rarely has every one of its words inside a single
  chunk, so requiring all of them would often return nothing.

### Chunks of about 1,000 characters with a small overlap
- **Chose:** split on paragraphs, pack into chunks of roughly 1,000 characters
  (about 200 words), repeating the last sentence or so into the next chunk.
- **Why:** big enough to hold a complete thought, small enough that 5 chunks
  make a short, cheap prompt. The overlap stops an answer being cut in half at
  a chunk boundary. Starting values, to be tuned once the eval set exists.

### Send the top 5 chunks to the LLM
- **Chose:** 5 chunks per question, taken from across all documents.
- **Why:** sending whole documents would be slow, costly, and would not fit
  for a large library. A few focused chunks also make it easier for the LLM to
  stay on the source text and cite it.

### Claude Haiku 4.5 through the Anthropic API
- **Chose:** Haiku 4.5, called from the server with an API key.
- **Why:** fast and cheap (well under a cent per question), and good enough
  for answering from 5 short passages. Changing models is a one-line change.
- **Billing:** pay-per-use on an API key from console.anthropic.com, separate
  from the Claude subscription. The key stays on the server and is never sent
  to the browser. Set a spending cap on it.

### Grounded prompt
- **Chose:** the prompt tells the LLM to answer only from the numbered
  passages, cite the passage number for each claim, and say "not found" if the
  answer is not there.
- **Why:** reduces made-up answers and lets the page link each claim to its source.

### Text, Markdown, and PDF uploads
- **Chose:** pasted text, .txt/.md files, and text-based PDFs.
- **Why:** the likely real documents (research papers) are PDFs. Once the text
  is extracted, a PDF goes through the same chunk-and-store path as anything else.
- **Limits:** scanned-image PDFs have no text to extract; uploads are capped
  at about 4 MB by Vercel.
- **If time runs short:** this is the first thing to drop.

### No login, one shared library
- **Chose:** no accounts. Everyone sees the same documents, and every question
  searches all of them.
- **Why:** saves 1-2 hours and is enough for a demo.
- **Risk:** anyone with the link can spend API credit; the spending cap limits that.
- **Later:** add an owner column to `documents` and filter search by it.

### Build search before the LLM step
- **Chose:** step 6 (search) is finished and checked before step 7 (answers).
- **Why:** when an answer is wrong, it is then clear whether search or the LLM failed.

### Eval set: later
- **Deferred:** 10-15 test questions with known answers and known source
  passages. Score retrieval (right chunk in the top 3-5?) and the final answer
  (correct, right citation?) separately, and measure latency.

## 2026-10-04: step 1, init-webapp

### Node.js installed with Homebrew
- **Chose:** `brew install node` (Node 26.10, which includes npm, the tool
  that downloads JavaScript libraries, like pip for Python).
- **Why:** Homebrew was already installed, so this is one command and one
  place to update from.
- **Turned down:** a Node version manager (nvm). Only needed when juggling
  several projects on different Node versions.

### Starter options for `create-next-app`
- **Chose:** TypeScript, App Router, ESLint (a checker that flags likely
  mistakes), npm, no `src/` folder, no Tailwind.
- **Why:** matches the file layout in `PLAN.md` (`app/` and `lib/` at the top
  level). Tailwind is a styling library that is not in the plan; the starter's
  plain CSS files are enough.
- **How:** generated in a temporary folder and moved in, because
  `create-next-app` refuses to run in a folder that already has files. The
  starter's own one-line `CLAUDE.md` was dropped so ours was not overwritten.

### Neon and Anthropic API accounts deferred
- **Chose:** create the Neon account at step 2 and the Anthropic API key at
  step 7, not now.
- **Why:** nothing in step 1 uses them. Note the API key is separate from the
  Claude Pro subscription and is billed per use.

### PDF upload moved to the end of the roadmap
- **Chose:** build step 5 (PDF upload) last, after the deploy in step 8.
- **Why:** it was already the step to drop if time runs short, and step 1
  finished a day later than planned. Doing it last means the core app is
  deployed before any time goes into it.
- **Cost of doing it later:** low. A PDF only needs its text extracted; after
  that it goes through the same save-and-chunk path as pasted text.

## 2026-10-05: step 2, document-upload

### Neon project and tooling
- **Chose:** Neon project `multi-doc-qa` in N. Virginia, Postgres only (no
  Auth, no AI gateway).
- **Why N. Virginia:** Vercel runs server code in Washington, D.C. by
  default, and the server talks to the database on every request.
- **Chose:** install Neon's command-line tool (`neon`), its agent skills, and
  its MCP server (a connection that lets Claude Code query the database).
- **Why:** Jason can run database commands himself to learn, and Claude can
  check what is actually in the tables. `neon link` also wrote the connection
  string into `.env.local`, so nothing had to be pasted by hand.
- **Limits set:** the MCP server's key is restricted to this one project and
  installed for Claude Code only. Its config lives in `~/.claude.json`,
  outside the repo.
- **Turned down:** Neon's config-as-code system (`neon.ts`, `neon deploy`).
  One project with default settings has nothing to configure, and the tables
  are already defined in code by `schema.sql`.

### Delete moved up into step 2
- **Chose:** step 2 covers add, list, and delete. Edit stays in step 4.
- **Why:** delete is one button and one SQL statement once the list exists.

### Tables: one row per chunk, numeric ids
- **Chose:** `documents` and `chunks` as two tables, with one row per chunk
  and a `document_id` on each chunk pointing back to its document.
- **Why:** search has to rank and return individual passages. Postgres ranks
  and indexes rows, so each chunk being a row keeps search to one short,
  fast query. Packing a document's chunks into one row would save about 1%
  of the space and lose the index.
- **Chose:** ids are numbers that Postgres hands out. Titles can repeat and
  change, so they cannot identify a row.
- **Left out:** an authors column. Nothing in the plan filters by author, and
  an author named in the text is already searchable.
- **Deferred:** the search column and its index on `chunks`, until step 6.
- **Scale note:** a long book is about 1,200 chunks and 3 to 4 MB stored.
  Neon's free plan (about 500 MB) holds roughly 100 to 150 of them.

### Upload goes through API routes, checked on the server
- **Chose:** the page sends the form to `/api/documents`, which returns JSON,
  as laid out in `PLAN.md`.
- **Chose:** the server checks every upload: `.txt` or `.md` only, 4 MB at
  most, a title, some text, and no zero bytes (which catches a binary file
  renamed to `.txt`).
- **Why:** the browser's file filter is a convenience and can be bypassed, so
  the server cannot trust what it is sent.
- **Chose:** queries pass values as `${...}` parameters, never glued into the
  SQL text, so user input cannot be run as SQL.
