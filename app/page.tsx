"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

type DocumentSummary = {
  id: string;
  title: string;
  characters: number;
  chunks: number;
  created_at: string;
};

export default function Home() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Runs once when the page first appears: ask the server for the list.
  useEffect(() => {
    fetch("/api/documents")
      .then((response) => response.json())
      .then(setDocuments)
      .catch(() => setError("Could not load the documents."));
  }, []);

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

  async function handleDelete(id: string) {
    setError("");
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete the document.");
      return;
    }
    setDocuments((current) => current.filter((doc) => doc.id !== id));
  }

  return (
    <main className={styles.main}>
      <h1>Multi-document Q&amp;A</h1>

      <section>
        <h2>Add a document</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Title
            <input name="title" type="text" />
          </label>
          <label>
            Paste text
            <textarea name="content" rows={8} />
          </label>
          <label>
            Or choose a .txt or .md file
            <input name="file" type="file" accept=".txt,.md" />
          </label>
          <button type="submit" disabled={saving}>
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
                <div>
                  <strong>{doc.title}</strong>
                  <span className={styles.muted}>
                    {doc.characters.toLocaleString()} characters ·{" "}
                    {doc.chunks.toLocaleString()} chunks · added{" "}
                    {new Date(doc.created_at).toLocaleString()}
                  </span>
                </div>
                <button type="button" onClick={() => handleDelete(doc.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
