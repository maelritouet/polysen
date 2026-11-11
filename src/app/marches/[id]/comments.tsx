"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { addCommentAction, deleteCommentAction } from "../actions";

const MAX = 500;

/** The comment box. The thread itself is rendered on the server. */
export function CommentForm({ marketId }: { marketId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const res = await addCommentAction(marketId, text);
      setError(res?.error);
      if (!res?.error) setText("");
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="comment" className="sr-only">
        Ton message
      </label>
      <textarea
        id="comment"
        value={text}
        maxLength={MAX}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) send();
        }}
        placeholder="Ton avis, tes infos, ton trash talk…"
        className="w-full resize-y rounded-lg border border-line bg-panel/40 px-3 py-2 text-sm placeholder:text-dim focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <FormMessage error={error} />
        <span className="ml-auto text-xs text-dim tabular-nums">{text.length > MAX - 100 ? `${text.length}/${MAX}` : ""}</span>
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          Publier
        </Button>
      </div>
    </form>
  );
}

export function DeleteComment({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Supprimer ce message ?")) start(async () => void (await deleteCommentAction(id)));
      }}
      className="text-xs text-dim hover:text-ink"
    >
      Supprimer
    </button>
  );
}
