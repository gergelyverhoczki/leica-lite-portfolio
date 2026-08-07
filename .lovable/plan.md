# Private admin page for uploading photos

## Goal
Add a minimal, password-protected admin page where you can upload new photos, set alt text, reorder, and delete — without changing the public gallery's minimalist look.

## What gets built

1. **Backend (Lovable Cloud)**
   - Enable Lovable Cloud (database, storage, login) for this project.
   - A `photos` table: image path, alt text, sort order, created date.
   - A public storage bucket for the image files.
   - Only the signed-in owner can upload, edit, or delete. Everyone can view photos.
   - Owner-only access: a separate roles table with an `admin` role; sign-up is not exposed anywhere in the UI, so only the account you create can reach the admin page.

2. **Migrate current photos**
   - The six existing CDN photos are inserted as rows so the gallery keeps looking identical from day one.

3. **Public gallery (`/`)**
   - Same design, same grid, same lightbox — but the photo list is read from the database instead of a hardcoded array.

4. **Sign-in page (`/auth`)**
   - Email + password only. No sign-up link, no social buttons.

5. **Admin page (`/admin`)**
   - Protected: signed-out visitors are redirected to `/auth`.
   - Drag-and-drop or click-to-select upload area, multiple files at once.
   - A simple list of existing photos: thumbnail, alt-text field, order number, delete button.
   - Save and sign-out buttons. Styling matches the site — white, restrained, no dashboard chrome.

## Technical notes
- Table `public.photos` (id, storage_path, alt, sort_order, created_at) with RLS: public `SELECT`, admin-only `INSERT/UPDATE/DELETE` via a `has_role(auth.uid(),'admin')` security-definer function and a separate `user_roles` table. Explicit grants included in the migration.
- Storage bucket `photos` (public read) with admin-only write policies on `storage.objects`.
- Public gallery reads via a public server function (publishable key, anon SELECT policy) so SSR and SEO keep working; admin mutations go through authenticated server functions using `requireSupabaseAuth`.
- Admin route lives under `src/routes/_authenticated/admin.tsx` using the managed auth gate.
- Existing `.asset.json` CDN photos are seeded as rows with their CDN URLs; nothing is deleted.
- Uploads are client-side to storage with the user session, then a row insert.

## After approval
You'll need to create your owner account once (sign up is done once by me/you via the Cloud users panel), and I'll grant it the admin role.

## Not included
- No captions, titles, or dates on the public site.
- No image editing, cropping, or multi-user accounts.
