import { searchChunks } from "@/lib/search";
import { MAX_QUESTION_LENGTH } from "@/lib/validate";

// GET /api/search?q=where did holmes meet irene adler
// Returns the best-matching chunks, best first.
export async function GET(request: Request) {
  const question = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!question) {
    return Response.json({ error: "Type a question first." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Keep the question under ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }
  return Response.json(await searchChunks(question));
}
