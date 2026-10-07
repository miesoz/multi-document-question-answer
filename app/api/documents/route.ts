import { chunkText } from "@/lib/chunk";
import { sql } from "@/lib/db";

// Vercel rejects request bodies above about 4.5 MB, so stop a little short.
const MAX_CONTENT_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".md"];

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// GET /api/documents: list every document, newest first.
export async function GET() {
  const documents = await sql`
    SELECT
      id,
      title,
      length(content) AS characters,
      (SELECT count(*)::int FROM chunks WHERE document_id = documents.id) AS chunks,
      created_at
    FROM documents
    ORDER BY created_at DESC
  `;
  return Response.json(documents);
}

// POST /api/documents: save a new document from pasted text or a file,
// split into chunks.
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  let title = String(form.get("title") ?? "").trim();
  let content = String(form.get("content") ?? "");

  // A chosen file wins over pasted text.
  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      return badRequest("Only .txt and .md files are supported.");
    }
    if (file.size > MAX_CONTENT_BYTES) {
      return badRequest("The file is larger than 4 MB.");
    }
    content = await file.text();
    if (!title) title = file.name;
  }

  content = content.trim();
  if (!title) return badRequest("Give the document a title.");
  if (!content) return badRequest("Paste some text or choose a file.");
  if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) {
    return badRequest("The text is larger than 4 MB.");
  }
  // A renamed binary file (an image, say) contains zero bytes, which Postgres
  // text columns cannot store.
  if (content.includes("\u0000")) {
    return badRequest("That file does not look like plain text.");
  }

  const chunks = chunkText(content);

  // One statement saves the document and all of its chunks. A single
  // statement is all-or-nothing, so a document is never saved without its
  // chunks. unnest turns the array into rows, and WITH ORDINALITY numbers
  // them 1, 2, 3...
  const [document] = await sql`
    WITH new_document AS (
      INSERT INTO documents (title, content)
      VALUES (${title}, ${content})
      RETURNING id, title, length(content) AS characters, created_at
    ),
    new_chunks AS (
      INSERT INTO chunks (document_id, chunk_index, content)
      SELECT new_document.id, piece.position - 1, piece.content
      FROM new_document,
        unnest(${chunks}::text[]) WITH ORDINALITY AS piece(content, position)
    )
    SELECT * FROM new_document
  `;
  return Response.json({ ...document, chunks: chunks.length }, { status: 201 });
}
