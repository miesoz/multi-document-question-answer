import Anthropic from "@anthropic-ai/sdk";
import { answerQuestion } from "@/lib/answer";
import { searchChunks } from "@/lib/search";
import { checkQuestion } from "@/lib/validate";

// GET /api/ask?q=what was the speckled band
// Returns the answer with its citations, and the passages it was given.
export async function GET(request: Request) {
  const question = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const problem = checkQuestion(question);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const chunks = await searchChunks(question);
  try {
    const answer = await answerQuestion(question, chunks);
    return Response.json({ answer, chunks });
  } catch (error) {
    // The model could not be reached or refused the request: a bad or expired
    // key, no credit left, too many requests, or an outage. The passages are
    // still returned so the page can show them.
    if (error instanceof Anthropic.APIError) {
      console.error("Answer request failed:", error.status, error.message);
      return Response.json(
        {
          error: "The answer service is unavailable right now.",
          chunks,
        },
        { status: 502 },
      );
    }
    throw error;
  }
}
