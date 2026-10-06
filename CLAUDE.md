# Multi-document question answering

Full-stack CRUD app for multi-document Q&A using RAG. Users upload documents,
the app chunks and stores them, and a plain-English question gets an
LLM-generated answer with citations to the source passages.

Read `PLAN.md` (architecture, data model, roadmap with "done when" checks) and
`DECISIONS.md` (what was chosen and why) before starting any step.

## Project rules

- Keep it simple. Do not add features, libraries, or abstractions beyond PLAN.md.
- Record each choice and its reason in `DECISIONS.md` as it is made.
- One branch per roadmap step. Commit after each step. Merge to `main` when
  the step's "done when" check passes.
- Secrets (database URL, API key) go in `.env.local`, which is never committed.
- This Next.js version differs from older ones. See `AGENTS.md` before
  writing Next.js code.
