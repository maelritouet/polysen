"use client";

import { startTransition, useActionState } from "react";
import { Avatar } from "@/components/avatar";
import { FormMessage } from "@/components/form-message";
import { removePhotoAction, uploadPhotoAction, type PhotoState } from "./actions";

const MAX_SIDE = 768;

/** Shrinks a phone photo in the browser so the upload stays small (server actions accept 1 MB). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // the server will say if it can't read it
  }
}

export function PhotoForm({ memberId, version }: { memberId: string; version: number }) {
  const hasPhoto = version > 0;
  const [state, action, pending] = useActionState<PhotoState, FormData>(uploadPhotoAction, null);

  async function upload(form: FormData) {
    const file = form.get("photo");
    if (file instanceof File && file.size > 0) form.set("photo", await shrink(file), "photo.jpg");
    startTransition(() => action(form));
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar memberId={memberId} size={64} version={version} />
      <div className="flex flex-col gap-1 text-sm">
        <form action={upload}>
          <input
            type="file"
            name="photo"
            accept="image/*"
            className="sr-only"
            id="photo"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <label htmlFor="photo" className="cursor-pointer font-semibold text-gold underline-offset-4 hover:underline">
            {pending ? "Envoi…" : hasPhoto ? "Changer ma photo" : "Ajouter une photo"}
          </label>
        </form>
        {hasPhoto && (
          <form action={removePhotoAction}>
            <button type="submit" className="text-dim underline underline-offset-4">
              Retirer
            </button>
          </form>
        )}
        <FormMessage error={state?.error} ok={state?.ok} />
      </div>
    </div>
  );
}
