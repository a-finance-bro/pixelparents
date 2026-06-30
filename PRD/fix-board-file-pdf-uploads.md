## Progress Update as of June 30, 2026 — 2:32 PM Pacific

### Summary of changes since last update
Enabled real file uploads (PDFs + documents) for resource-board "file" contributions. The shared /api/blob/upload route was image-only; added a `purpose=board-file` mode that allow-lists PDF/doc/spreadsheet/text/image types, raises the cap to 20 MB, and stores board files PUBLICLY (unguessable URL) so any member can download them — the photo path stays private/image-only and unchanged.

### Detail of changes made:
- app/api/blob/upload/route.ts: added BOARD_FILE_TYPES allow-list + BOARD_FILE_MAX_BYTES (20MB); branch on form field `purpose`; board files → access:"public", path `board-files/`; photos → unchanged (private, `family-photos/`, image-only).
- app/(authed)/resources/[boardId]/board-client.tsx: upload sends `purpose=board-file`; `accept` now includes pdf/doc/xls/ppt/csv/txt/md/images; removed the "PDF support coming soon" copy; added a "PDFs, documents, or images — up to 20 MB" hint and clearer error messages.
- actions.ts host validation already accepts the public blob host, so PDFs pass unchanged.

### Potential concerns to address:
- Public access means anyone with the (unguessable) URL can fetch a board file; acceptable since the surfaces exposing it are OHS-gated, but worth noting vs. the private photo store.
- Consider virus/type sniffing on the server beyond MIME if abuse appears; current allow-list is by client-declared type.
