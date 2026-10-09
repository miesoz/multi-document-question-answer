import { sql } from "@/lib/db";

// How many chunks a search returns.
export const SEARCH_LIMIT = 5;

export type SearchResult = {
  id: string;
  document_id: string;
  title: string;
  chunk_index: number;
  content: string;
  score: number;
};

// Returns the chunks that best match the question, best first, from every
// document. This is keyword search: it matches words, not meaning.
export async function searchChunks(question: string): Promise<SearchResult[]> {
  // plainto_tsquery puts the question through the same filter as the chunks
  // (filler words dropped, the rest cut to their root) and joins the terms
  // with & ("and"). Swapping & for | ("or") makes a chunk match when it has
  // any of the terms, because a full question rarely has every one of its
  // words inside a single chunk. ts_rank scores chunks with more of the terms
  // higher. The last ORDER BY entry keeps the order steady between equal scores.
  const rows = await sql`
    WITH search AS (
      SELECT
        replace(plainto_tsquery('english', ${question})::text, '&', '|')::tsquery
          AS terms
    )
    SELECT
      chunks.id,
      chunks.document_id,
      documents.title,
      chunks.chunk_index,
      chunks.content,
      ts_rank(chunks.text_search_vec, search.terms) AS score
    FROM chunks
    JOIN documents ON documents.id = chunks.document_id
    CROSS JOIN search
    WHERE chunks.text_search_vec @@ search.terms
    ORDER BY score DESC, chunks.id
    LIMIT ${SEARCH_LIMIT}
  `;
  return rows as SearchResult[];
}
