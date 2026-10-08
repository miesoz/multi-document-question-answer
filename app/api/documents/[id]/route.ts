import { chunkText } from "@/lib/chunk";
import { sql } from "@/lib/db";
import { checkDocument } from "@/lib/validate";

type Context = RouteContext<"/api/documents/[id]">;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// The id comes from the address, so check it is a whole number.
async function readId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  return /^\d+$/.test(id) ? id : null;
}

// GET /api/documents/3: one document with its full text.
export async function GET(_request: Request, context: Context) {
  const id = await readId(context);
  if (!id) return errorResponse("Invalid document id.", 400);

  const [document] = await sql`
    SELECT id, title, content FROM documents WHERE id = ${id}
  `;
  if (!document) return errorResponse("Document not found.", 404);
  return Response.json(document);
}

// PUT /api/documents/3: replace a document's title and text, and rebuild its
// chunks from the new text.
export async function PUT(request: Request, context: Context) {
  const id = await readId(context);
  if (!id) return errorResponse("Invalid document id.", 400);

  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "").trim();
  const problem = checkDocument(title, content);
  if (problem) return errorResponse(problem, 400);

  const chunks = chunkText(content);

  // A transaction: the three statements run in order and are all-or-nothing.
  // If the document no longer exists, the UPDATE changes no rows and the
  // INSERT finds no document to attach chunks to, so nothing is saved.
  const [updated] = await sql.transaction([
    sql`
      UPDATE documents
      SET title = ${title}, content = ${content}, updated_at = now()
      WHERE id = ${id}
      RETURNING id, title, length(content) AS characters, created_at
    `,
    sql`DELETE FROM chunks WHERE document_id = ${id}`,
    sql`
      INSERT INTO chunks (document_id, chunk_index, content)
      SELECT documents.id, piece.position - 1, piece.content
      FROM documents,
        unnest(${chunks}::text[]) WITH ORDINALITY AS piece(content, position)
      WHERE documents.id = ${id}
    `,
  ]);
  if (updated.length === 0) {
    return errorResponse("Document not found. It may have been deleted.", 404);
  }
  return Response.json({ ...updated[0], chunks: chunks.length });
}

// DELETE /api/documents/3: delete one document. Its chunks go with it.
export async function DELETE(_request: Request, context: Context) {
  const id = await readId(context);
  if (!id) return errorResponse("Invalid document id.", 400);

  const deleted = await sql`
    DELETE FROM documents WHERE id = ${id} RETURNING id
  `;
  if (deleted.length === 0) return errorResponse("Document not found.", 404);
  return new Response(null, { status: 204 });
}
