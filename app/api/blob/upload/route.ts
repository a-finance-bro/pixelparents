import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { currentUser } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// Optimized images arrive already small from the client; this is a safety cap.
const MAX_BYTES = 6 * 1024 * 1024;
// Board file contributions (PDFs, etc.) can be larger than an optimized photo.
const BOARD_FILE_MAX_BYTES = 20 * 1024 * 1024;

// Resource-board file contributions accept documents in addition to images.
// Keep this allow-list tight — these are community uploads surfaced to other
// members, so we don't want arbitrary executable/archive types.
const BOARD_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Extension fallback for when the browser reports no MIME type. Browsers often
// send an empty string or "application/octet-stream" for text formats they don't
// have a registered type for (notably .md, and sometimes .txt/.csv), so a file
// the picker's `accept` list explicitly allowed would otherwise be rejected here.
// Kept in lockstep with the picker's `accept` (board-client.tsx) so the two agree.
const BOARD_FILE_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "csv",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

// True when the type is absent/opaque — the case where we must fall back to the
// filename extension to decide whether the upload is allowed.
function typeIsUnknown(type: string): boolean {
  return type === "" || type === "application/octet-stream";
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export async function POST(request: Request) {
  // Auth gate: require a signed-in Clerk user. Identity comes from the session
  // (currentUser) — never the client — matching the rest of the app's server
  // routes/actions. Without this anyone could write to the blob store.
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  // Two upload purposes share this route:
  //  - default: private family photos (image-only, stored privately).
  //  - "board-file": resource-board contributions (PDFs/docs + images),
  //    stored PUBLICLY (unguessable URL) so any member can download them —
  //    the surfaces that expose these URLs are themselves OHS-gated.
  const purpose = form.get("purpose") === "board-file" ? "board-file" : "photo";
  const isBoardFile = purpose === "board-file";

  const isImage = file.type.startsWith("image/");
  if (isBoardFile) {
    // Accept when the MIME type is on the allow-list, OR — when the browser
    // gave us no usable type — when the filename extension is one we allow. This
    // keeps the server in agreement with the picker's `accept` list so a file
    // the dialog offered (e.g. a .md with an empty reported type) actually uploads.
    const allowedByType = isImage || BOARD_FILE_TYPES.has(file.type);
    const allowedByExtension =
      typeIsUnknown(file.type) && BOARD_FILE_EXTENSIONS.has(extensionOf(file.name));
    if (!allowedByType && !allowedByExtension) {
      return NextResponse.json({ error: "unsupported file type" }, { status: 415 });
    }
  } else if (!isImage) {
    return NextResponse.json({ error: "not an image" }, { status: 415 });
  }

  const maxBytes = isBoardFile ? BOARD_FILE_MAX_BYTES : MAX_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const width = Number(form.get("width")) || undefined;
  const height = Number(form.get("height")) || undefined;

  try {
    const blob = await put(
      `${isBoardFile ? "board-files" : "family-photos"}/${file.name}`,
      file,
      {
        access: isBoardFile ? "public" : "private",
        addRandomSuffix: true,
        contentType: file.type,
      },
    );
    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      width,
      height,
    });
  } catch (err) {
    console.error("Blob upload failed:", err);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
