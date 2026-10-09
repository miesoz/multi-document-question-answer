// Limits and checks shared by the page and the server.

// Vercel rejects request bodies above about 4.5 MB, so stop a little short.
export const MAX_CONTENT_BYTES = 4 * 1024 * 1024;

// The longest question the search accepts, in characters.
export const MAX_QUESTION_LENGTH = 1000;

// Returns an error message for the user, or null if the question is fine.
export function checkQuestion(question: string): string | null {
  if (!question) return "Type a question first.";
  if (question.length > MAX_QUESTION_LENGTH) {
    return `Keep the question under ${MAX_QUESTION_LENGTH} characters.`;
  }
  return null;
}

// Returns an error message for the user, or null if the document is fine.
export function checkDocument(title: string, content: string): string | null {
  if (!title) return "Give the document a title.";
  if (!content) return "The document has no text.";
  if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) {
    return "The text is larger than 4 MB.";
  }
  // A renamed binary file (an image, say) contains zero bytes, which Postgres
  // text columns cannot store.
  if (content.includes("\u0000")) {
    return "That does not look like plain text.";
  }
  return null;
}
