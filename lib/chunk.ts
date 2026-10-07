// Splits a document's text into chunks for search (recursive chunking).
//
// 1. Cut the text into paragraphs and fill each chunk with whole paragraphs
//    up to CHUNK_SIZE.
// 2. A paragraph that is over CHUNK_SIZE by itself is cut into sentences,
//    which are filled into chunks the same way. A sentence that is too long
//    is cut into words, and a word that is too long is cut every CHUNK_SIZE
//    characters.
// 3. Each chunk after the first then gets the last sentence of the chunk
//    before it added at its start (the overlap).

// Target chunk length in characters (letters, spaces, punctuation, line breaks).
// Overlap is added on top, so a stored chunk can be up to
// CHUNK_SIZE + CHUNK_OVERLAP + 1 characters long.
export const CHUNK_SIZE = 1000;

// The most characters repeated from the end of one chunk at the start of the next.
export const CHUNK_OVERLAP = 200;

// The end of a sentence: . ? or ! (and any closing quote or bracket after
// it), followed by whitespace. The cut is made at the whitespace.
const SENTENCE_END = /(?<=[.?!]["'”’)\]]*)\s+/;

// The ways to cut text, from largest pieces to smallest. `separator` is where
// to cut. `join` is put between two pieces that share a chunk.
const LEVELS = [
  { separator: /\n\s*\n/, join: "\n\n" }, // paragraphs (cut at blank lines)
  { separator: SENTENCE_END, join: " " }, // sentences
  { separator: /\s+/, join: " " }, // words
];

// TODO (PDF step): extracted PDF text often has a line break at the end of
// every line and no blank lines, so paragraphs cannot be detected this way.

export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  // Windows files end lines with \r\n. Keep only the \n.
  text = text.replace(/\r\n/g, "\n");

  const chunks = split(text, chunkSize, 0);
  if (overlap === 0) return chunks;

  return chunks.map((chunk, index) => {
    if (index === 0) return chunk;
    const repeated = lastSentence(chunks[index - 1], overlap);
    return repeated === "" ? chunk : repeated + " " + chunk;
  });
}

// Cuts `text` using LEVELS[level] and fills chunks with the pieces. A piece
// that is over chunkSize by itself is cut again at the next level.
function split(text: string, chunkSize: number, level: number): string[] {
  if (level === LEVELS.length) return cutEvery(text, chunkSize);

  const { separator, join } = LEVELS[level];
  const pieces = text
    .split(separator)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  const chunks: string[] = [];
  let current = ""; // the chunk being built

  for (const piece of pieces) {
    if (piece.length > chunkSize) {
      // Too big for any chunk: finish the chunk being built, then cut this
      // piece into smaller pieces and add the chunks that produces.
      if (current !== "") chunks.push(current);
      current = "";
      chunks.push(...split(piece, chunkSize, level + 1));
    } else if (current === "") {
      current = piece;
    } else if (current.length + join.length + piece.length <= chunkSize) {
      // It fits: append it to the chunk being built.
      current += join + piece;
    } else {
      // It does not fit: finish this chunk and start the next with it.
      chunks.push(current);
      current = piece;
    }
  }

  if (current !== "") chunks.push(current);
  return chunks;
}

// Last resort, for a "word" with no spaces that is over chunkSize.
function cutEvery(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    // An emoji is stored as two units that must stay together. If the cut
    // would land between them, cut one unit earlier.
    if (end < text.length && isFirstHalfOfPair(text.charCodeAt(end - 1))) {
      end -= 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

function isFirstHalfOfPair(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

// The last sentence of `chunk`. If that sentence is longer than maxLength,
// only its final whole words that fit in maxLength ("" if no whole word fits).
function lastSentence(chunk: string, maxLength: number): string {
  const sentences = chunk.split(SENTENCE_END);
  const last = sentences[sentences.length - 1];
  if (last.length <= maxLength) return last;

  const tail = last.slice(-maxLength);
  const firstSpace = tail.search(/\s/);
  if (firstSpace === -1) return "";
  return tail.slice(firstSpace + 1).trim(); // drop the cut-off first word
}
