# Multi-document Q&A

A multi-document Q&A app where users upload documents they don't feel like
reading, or want a recap of, and ask questions about them. Claude then
generates a response using only the passages found to be most relevant to the
question, across all the uploaded documents, and shows both the quotes it used
and the passages they came from.

## What you can do

- Add a document by pasting text or choosing a `.txt` or `.md` file.
- View, edit, and delete documents.
- Ask a question in plain English and get a short answer with numbered
  sources. Each source shows the document it came from and the exact text
  that was quoted.
- If the documents do not hold the answer, the app says so and does not guess.

## How it works

The app follows the RAG pattern (retrieval-augmented generation).

**When a document is uploaded**

1. The server cuts the text into chunks of at most 1,000 characters. It cuts
   at paragraph breaks first, then at sentence ends, then between words, and
   only goes to a smaller unit when a piece is still too long.
2. Each chunk after the first starts with the last sentence of the chunk
   before it, so an idea that crosses a boundary is not cut in half.
3. The document and its chunks are saved to Postgres in one statement.

**When a question is asked**

1. **Retrieve:** Postgres full-text search finds the 5 chunks that best match
   the words in the question, across every document.
2. **Augment:** the server builds a prompt holding those 5 chunks and the
   question, with instructions to answer only from the chunks.
3. **Generate:** Claude writes the answer and cites the text it relied on.
   The page shows the answer next to its sources.

Claude never sees the full documents, only the 5 chunks the search returns.

## Built with

- **Framework:** Next.js (App Router), React, TypeScript
- **Database:** Postgres, hosted on Neon
- **Search:** Postgres built-in full-text search
- **Answers:** Claude Haiku 5.5 through the Anthropic API, with its citations feature
- **Hosting:** Vercel

`PLAN.md` describes the design in more detail. `DECISIONS.md` lists each
choice and the reason for it.

## Limitations

- **Questions need specific words.** Search matches the words in the question
  against the words in each chunk; it does not understand meaning. A question
  that uses distinctive words from the text ("Who was the ecologist of Dune?")
  finds the right passage far more often than one made of common words. A
  passage that says the same thing in different words can be missed.
- **Claude can only answer from what search returns.** If the right passage is
  not among the 5 chunks, the answer is partial or the app reports that it
  could not find it.
- **An answer spread over many passages** may be only partly retrieved.
- **Common words count as much as rare ones** when chunks are ranked.
- **No login.** There is one shared library, and anyone who can open the app
  can edit or delete any document.
- **Text and Markdown files only.** PDF upload is not built.
- **Edits are last-write-wins.** If two people edit the same document, the
  second save replaces the first.

## What I would add next

- Meaning-based search (embeddings) alongside keyword search.
- Fetching the chunks on either side of a matching chunk.
- A test set of questions with known answers, to measure each change.
- PDF upload.
- Login, with documents limited to their owner.

## Run it yourself

Built and tested with Node.js 26. You need a Postgres database (a free Neon
project works) and an Anthropic API key.

1. Install the packages:

   ```bash
   npm install
   ```

2. Create a file named `.env.local` in the project folder with these two
   values. This file is ignored by git; do not commit it.

   ```
   DATABASE_URL=your-postgres-connection-string
   ANTHROPIC_API_KEY=your-api-key
   ```

3. Create the tables by running `schema.sql` against the database:

   ```bash
   psql "your-postgres-connection-string" -f schema.sql
   ```

4. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

To see how a piece of text is cut into chunks, without the database:

```bash
npm run try-chunk
```

## License

MIT. See `LICENSE`.
