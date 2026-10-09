import { searchChunks } from "@/lib/search";
import { checkQuestion } from "@/lib/validate";

// GET /api/search?q=where did holmes meet irene adler
// Returns the best-matching chunks, best first.
export async function GET(request: Request) {
  const question = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const problem = checkQuestion(question);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  return Response.json(await searchChunks(question));
}
