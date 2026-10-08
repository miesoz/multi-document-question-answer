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
  const [question, setQuestion] = useState("");

  // Runs once when the page first appears: ask the server for the list.
  useEffect(() => {
    fetch("/api/documents")
      .then((response) => response.json())
      .then(setDocuments)
      .catch(() => setError("Could not load the documents."));
  }, []);

  // Ask button. For now it only keeps the question; search comes next.
  function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setQuestion(String(form.get("question")).trim());
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

  async function handleDelete(id: string) {
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

  return (
    <main className={styles.main}>
      <h1>Multi-document Q&amp;A</h1>

      <section>
        <h2>Ask a question</h2>
        <form className={styles.form} onSubmit={handleAsk}>
          <textarea name="question" rows={8} aria-label="Question" />
          <button type="submit">Ask</button>
        </form>
        {question && (
          <p className={styles.muted}>
            You asked: {question} (search is not connected yet)
          </p>
        )}
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
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(doc.id)}>
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
