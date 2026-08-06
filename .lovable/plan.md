# Photo update workflow

## Goal
Define a simple, repeatable way to add or replace portfolio photos later without adding an admin UI or changing the minimalist image-only gallery.

## Current state
- Photos live as local JPG files in `src/assets/`.
- The gallery list is hardcoded in `src/routes/index.tsx`.
- The site shows images only — no titles, dates, or captions.
- `lovable-assets` is available in the sandbox for CDN upload.

## Proposed workflow

1. **(Recommended) Migrate existing photos to CDN assets**
   - Run `lovable-assets create --file src/assets/photo-N.jpg > src/assets/photo-N.jpg.asset.json` for each image.
   - Delete the original `src/assets/photo-N.jpg` files.
   - Update `src/routes/index.tsx` to import the `.asset.json` pointers and use their `.url` values.
   - This keeps the repository small and avoids committing large binaries.

2. **Add a new photo**
   - Place the new image in the sandbox (e.g. `/tmp/new-photo.jpg`) or in `src/assets/` temporarily.
   - Run `lovable-assets create --file /tmp/new-photo.jpg --filename new-photo.jpg > src/assets/new-photo.jpg.asset.json`.
   - Open `src/routes/index.tsx` and add an entry to the `photos` array:
     ```ts
     {
       src: newPhotoAsset.url,
       alt: "Describe the photograph",
       orientation: "landscape" | "portrait",
     }
     ```
   - Import the asset pointer at the top of the file.

3. **Replace or remove a photo**
   - Add the replacement image as in step 2.
   - Remove the old entry from the `photos` array.
   - Run `lovable-assets delete --file src/assets/old-photo.jpg.asset.json` to remove the orphaned CDN object, then delete the local pointer.

4. **Verify**
   - Run `bun run build` to confirm the site compiles.
   - Check the preview to confirm the new image appears in the grid.

## What we will not build
- No upload form or admin page.
- No database or Lovable Cloud storage.
- No titles, captions, or dates — the gallery stays image-only.

## Result
A lightweight developer workflow: drop a photo into the sandbox, run one CLI command, add one line to the photo list, and rebuild.