"use client";

import { useEffect, useState } from "react";
import type { AnswerPart } from "@/lib/answer";
import { NOT_FOUND_MESSAGE } from "@/lib/messages";
import type { SearchResult } from "@/lib/search";
import { MAX_QUESTION_LENGTH } from "@/lib/validate";
import styles from "./page.module.css";

type DocumentSummary = {
  id: string;
  title: string;
  characters: number;
  chunks: number;
  created_at: string;
};

// The document open in the edit popup, as it was when loaded.
type EditingDocument = {
  id: string;
  title: string;
  content: string;
};

export default function Home() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingDocument | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // null until the first question is asked.
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<AnswerPart[] | null>(null);
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);
  const [questionLength, setQuestionLength] = useState(0);

  // Runs once when the page first appears: ask the server for the list.
  useEffect(() => {
    fetch("/api/documents")
      .then((response) => response.json())
      .then(setDocuments)
      .catch(() => setError("Could not load the documents."));
  }, []);

  // Ask button: send the question to the server, then show the answer and the
  // passages it was written from.
  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question")).trim();

    setAskError("");
    setAsking(true);
    const response = await fetch(`/api/ask?q=${encodeURIComponent(question)}`);
    const result = await response.json();
    setAsking(false);

    if (!response.ok) setAskError(result.error);
    setAnswer(result.answer ?? null);
    // The passages come back even when the answer could not be written.
    setResults(result.chunks ?? null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser's default full-page reload
    const form = event.currentTarget;
    setError("");
    setSaving(true);

    const response = await fetch("/api/documents", {
      method: "POST",
      body: new FormData(form),
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(result.error);
      return;
    }
    setDocuments((current) => [result, ...current]);
    form.reset();
  }

  async function handleDelete(id: string, title: string) {
    // Deleting cannot be undone, so ask first.
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setError("");
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete the document.");
      return;
    }
    setDocuments((current) => current.filter((doc) => doc.id !== id));
  }

  // Edit button: load the document's full text, then open the popup.
  async function handleEdit(id: string) {
    setError("");
    const response = await fetch(`/api/documents/${id}`);
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return;
    }
    setEditError("");
    setEditing(result);
  }

  // Save button in the popup.
  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")).trim();
    const content = String(form.get("content")).trim();

    // Nothing changed: close without sending anything to the server.
    if (title === editing.title && content === editing.content) {
      setEditing(null);
      return;
    }

    setEditError("");
    setEditSaving(true);
    const response = await fetch(`/api/documents/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const result = await response.json();
    setEditSaving(false);

    if (!response.ok) {
      setEditError(result.error);
      return;
    }
    setDocuments((current) =>
      current.map((doc) => (doc.id === result.id ? result : doc)),
    );
    setEditing(null);
  }

  // The passages the answer cites, in the order the answer first uses them.
  // Each holds a position in `results`. A passage's place in this list, plus
  // one, is the source number the user sees: [1], [2], [3]...
  const citedPassages = [
    ...new Set(
      (answer ?? []).flatMap((part) => part.citations.map((c) => c.passage)),
    ),
  ].filter((passage) => results?.[passage]);

  // True when the answer is the sorry message, which gets its own colour.
  const notFound =
    (answer ?? []).map((part) => part.text).join("").trim() ===
    NOT_FOUND_MESSAGE;

  return (
    <main className={styles.main}>
      <h1>Multi-document Q&amp;A</h1>

      <section>
        <h2>Ask a question</h2>
        <form className={styles.form} onSubmit={handleAsk}>
          <textarea
            name="question"
            className={styles.fixedSize}
            rows={4}
            aria-label="Question"
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(event) => setQuestionLength(event.target.value.length)}
          />
          <span className={styles.muted}>
            Character limit: {questionLength}/{MAX_QUESTION_LENGTH}
          </span>
          <button type="submit" disabled={asking}>
            {asking && <span className={styles.spinner} aria-hidden="true" />}
            {asking ? "Answering…" : "Ask"}
          </button>
        </form>
        {askError && (
          <p className={styles.error} role="alert">
            {askError}
          </p>
        )}
        {/* While a new question is being answered, the previous answer stays
            on screen, faded to show it is the old one. */}
        <div className={asking ? styles.stale : undefined}>
          {answer && (
            <p
              className={
                notFound ? `${styles.answer} ${styles.notFound}` : styles.answer
              }
            >
              {answer.map((part, index) => (
                <span
                  key={index}
                  // A statement backed by a source is underlined.
                  className={part.citations.length > 0 ? styles.cited : undefined}
                >
                  {part.text}
                  {/* One link per source this statement is based on. */}
                  {[...new Set(part.citations.map((c) => c.passage))]
                    .filter((passage) => citedPassages.includes(passage))
                    .map((passage) => {
                      const number = citedPassages.indexOf(passage) + 1;
                      return (
                        <sup key={passage}>
                          <a href={`#source-${number}`}>[{number}]</a>
                        </sup>
                      );
                    })}
                </span>
              ))}
            </p>
          )}
          {results && citedPassages.length > 0 && (
            <>
              <h3 className={styles.sourcesHeading}>Sources</h3>
              <ol className={styles.results}>
                {citedPassages.map((passage, index) => {
                  const source = results[passage];
                  // The sentences the answer quoted from this passage.
                  const quotes = (answer ?? [])
                    .flatMap((part) => part.citations)
                    .filter((citation) => citation.passage === passage)
                    .map((citation) => citation.quote.trim());
                  return (
                    <li key={source.id} id={`source-${index + 1}`}>
                      <strong>{source.title}</strong>{" "}
                      <span className={styles.chunkLabel}>
                        chunk {source.chunk_index}
                      </span>
                      {[...new Set(quotes)].map((quote) => (
                        <blockquote key={quote} className={styles.quote}>
                          {quote}
                        </blockquote>
                      ))}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          {results && results.length > 0 && (
            // Closed by default. For checking what search returned.
            <details className={styles.searched}>
              <summary>
                Show all {results.length} passages searched
              </summary>
              <ol className={styles.results}>
                {results.map((result) => (
                  <li key={result.id}>
                    <strong>{result.title}</strong>{" "}
                    <span className={styles.chunkLabel}>
                      chunk {result.chunk_index} · score{" "}
                      {result.score.toFixed(4)}
                    </span>
                    <p>{result.content}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </section>

      <section>
        <h2>Add a document</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Title
            <input name="title" type="text" />
          </label>
          <label>
            Paste text
            <textarea name="content" className={styles.fixedSize} rows={8} />
          </label>
          <label>
            Or choose a .txt or .md file
            <input name="file" type="file" accept=".txt,.md" />
          </label>
          <button type="submit" disabled={saving}>
            {saving && <span className={styles.spinner} aria-hidden="true" />}
            {saving ? "Saving…" : "Add document"}
          </button>
        </form>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2>Documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <p className={styles.muted}>No documents yet.</p>
        ) : (
          <ul className={styles.list}>
            {documents.map((doc) => (
              <li key={doc.id}>
                <div className={styles.details}>
                  <strong>{doc.title}</strong>
                  <span className={styles.muted}>
                    {doc.characters.toLocaleString()} characters ·{" "}
                    {doc.chunks.toLocaleString()} chunks · added{" "}
                    {new Date(doc.created_at).toLocaleString()}
                  </span>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={() => handleEdit(doc.id)}>
                    View / Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(doc.id, doc.title)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <dialog
          className={styles.dialog}
          // Runs when the popup is added to the page: open it as a modal.
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          // Runs when it closes, including by the Esc key.
          onClose={() => setEditing(null)}
        >
          <button
            type="button"
            className={styles.close}
            aria-label="Close without saving"
            onClick={() => setEditing(null)}
          >
            ×
          </button>
          <h2>Edit document</h2>
          <form className={styles.form} onSubmit={handleSave}>
            <label>
              Title
              <input name="title" type="text" defaultValue={editing.title} />
            </label>
            <label>
              Text
              <textarea
                name="content"
                rows={16}
                defaultValue={editing.content}
              />
            </label>
            <button type="submit" disabled={editSaving}>
              {editSaving && <span className={styles.spinner} aria-hidden="true" />}
              {editSaving ? "Saving…" : "Save"}
            </button>
          </form>
          {editError && (
            <p className={styles.error} role="alert">
              {editError}
            </p>
          )}
        </dialog>
      )}
    </main>
  );
}
