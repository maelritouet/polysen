import sharp from "sharp";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { cleanup, createRootMember, openTestDb } from "@/test/db";
import { deleteAccount } from "./account";
import { getPhoto, initialsSvg, PHOTO_SIZE, removePhoto, setPhoto } from "./photos";

const t = openTestDb();
afterEach(() => cleanup(t.db, t.users));
afterAll(() => t.close());

/** A 600×400 JPEG carrying EXIF metadata, like a phone photo. */
async function phonePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 600, height: 400, channels: 3, background: "#3366cc" } })
    .jpeg()
    .withExif({ IFD0: { Make: "PhoneMaker", Artist: "Someone" } })
    .toBuffer();
}

describe("profile photos (decision 018)", () => {
  it("stores a small square WebP without the phone's metadata", async () => {
    const m = await createRootMember(t.db, t.users);
    const input = await phonePhoto();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    await setPhoto(t.db, m.id, input);
    const p = await getPhoto(t.db, m.id);
    expect(p?.kind).toBe("photo");
    const meta = await sharp((p as { image: Buffer }).image).metadata();
    expect(meta).toMatchObject({ format: "webp", width: PHOTO_SIZE, height: PHOTO_SIZE });
    expect(meta.exif).toBeUndefined();
  });

  it("refuses a file that is not an image, and an empty one", async () => {
    const m = await createRootMember(t.db, t.users);
    await expect(setPhoto(t.db, m.id, new TextEncoder().encode("<script>alert(1)</script>"))).rejects.toThrow(/pas une image/);
    await expect(setPhoto(t.db, m.id, new Uint8Array())).rejects.toThrow(/Choisis/);
  });

  it("replaces the photo, falls back to initials once removed, and knows no strangers", async () => {
    const m = await createRootMember(t.db, t.users);
    await setPhoto(t.db, m.id, await phonePhoto());
    await setPhoto(t.db, m.id, await phonePhoto());
    await removePhoto(t.db, m.id);
    expect(await getPhoto(t.db, m.id)).toMatchObject({ kind: "initials" });
    expect(await getPhoto(t.db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("is deleted with the account", async () => {
    const m = await createRootMember(t.db, t.users);
    await setPhoto(t.db, m.id, await phonePhoto());
    await deleteAccount(t.db, m.id);
    expect(await getPhoto(t.db, m.id)).toMatchObject({ kind: "initials" });
  });

  it("draws safe initials", () => {
    expect(initialsSvg("léa_92")).toContain(">LÉ<");
    expect(initialsSvg("<<>>")).toContain(">?<");
  });
});
