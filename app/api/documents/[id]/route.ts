import { sql } from "@/lib/db";

// DELETE /api/documents/3: delete one document. Its chunks go with it.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/documents/[id]">,
) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: "Invalid document id." }, { status: 400 });
  }

  const deleted = await sql`
    DELETE FROM documents WHERE id = ${id} RETURNING id
  `;
  if (deleted.length === 0) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
