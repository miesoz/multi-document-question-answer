// Prints the chunks that chunkText produces, to see what the chunker does.
//
//   npm run try-chunk                              built-in sample, size 60, overlap 30
//   npm run try-chunk -- path/to/file.txt          a file, size 1000, overlap 200
//   npm run try-chunk -- path/to/file.txt 500 0    a file, size 500, no overlap

import { readFileSync } from "node:fs";
import { chunkText, CHUNK_SIZE, CHUNK_OVERLAP } from "../lib/chunk.ts";

const SAMPLE = `Holmes sat by the fire.

Watson read the paper.

A client arrived at noon. She was pale and nervous. She asked for help at once.`;

const [path, size, overlapSize] = process.argv.slice(2);
const text = path ? readFileSync(path, "utf8") : SAMPLE;
const chunkSize = size ? Number(size) : path ? CHUNK_SIZE : 60;
const overlap = overlapSize ? Number(overlapSize) : path ? CHUNK_OVERLAP : 30;

const chunks = chunkText(text, chunkSize, overlap);

console.log(
  `${text.length} characters -> ${chunks.length} chunks ` +
    `(chunk size ${chunkSize}, overlap ${overlap})\n`,
);
chunks.forEach((chunk, index) => {
  console.log(`--- chunk ${index} (${chunk.length} characters)`);
  console.log(chunk + "\n");
});
