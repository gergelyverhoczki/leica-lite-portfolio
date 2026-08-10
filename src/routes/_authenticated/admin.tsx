import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  addPhoto,
  deletePhoto,
  getIsAdmin,
  listPhotosForAdmin,
  updatePhoto,
} from "@/lib/photos.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Manage photos — Gergely Verhoczki" },
      { name: "description", content: "Private admin area for managing portfolio photographs." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Manage photos — Gergely Verhoczki" },
      { property: "og:description", content: "Private admin area for managing portfolio photographs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const checkAdmin = useServerFn(getIsAdmin);
  const fetchPhotos = useServerFn(listPhotosForAdmin);
  const runAddPhoto = useServerFn(addPhoto);
  const runUpdatePhoto = useServerFn(updatePhoto);
  const runDeletePhoto = useServerFn(deletePhoto);

  const adminQuery = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const photosQuery = useQuery({
    queryKey: ["admin-photos"],
    queryFn: () => fetchPhotos(),
    enabled: adminQuery.data?.isAdmin === true,
  });

  const [drafts, setDrafts] = useState<Record<string, { alt: string; sortOrder: number }>>({});

  const saveMutation = useMutation({
    mutationFn: (input: { id: string; alt: string; sortOrder: number }) =>
      runUpdatePhoto({ data: input }),
    onSuccess: async () => {
      setMessage("Saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-photos"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runDeletePhoto({ data: { id } }),
    onSuccess: async () => {
      setMessage("Photo removed.");
      await queryClient.invalidateQueries({ queryKey: ["admin-photos"] });
    },
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    setUploading(true);
    setMessage(null);
    let nextOrder =
      (photosQuery.data ?? []).reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;

    try {
      for (const file of list) {
        const optimised = await compressImage(file);
        const path = `${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(path, optimised, {
            contentType: "image/jpeg",
            upsert: false,
            cacheControl: "31536000",
          });
        if (uploadError) throw new Error(uploadError.message);

        await runAddPhoto({
          data: { storagePath: path, alt: "", sortOrder: nextOrder },
        });
        nextOrder += 1;
      }

      setMessage(`${list.length} photo${list.length > 1 ? "s" : ""} uploaded.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-photos"] });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (adminQuery.isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!adminQuery.data?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-2xl font-medium">Not authorised</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This account doesn't have permission to manage photographs.
        </p>
        <button onClick={handleSignOut} className="text-sm underline underline-offset-4">
          Sign out
        </button>
      </div>
    );
  }

  const photos = photosQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-leica-red" aria-hidden="true" />
            <span className="font-heading text-lg font-medium tracking-tight">Manage photos</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
              View site
            </Link>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void uploadFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed px-6 py-16 text-center transition-colors ${
            dragging ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40"
          }`}
        >
          <p className="font-heading text-base font-medium">
            {uploading ? "Uploading…" : "Drop photographs here"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">or click to choose files</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
        </div>

        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-14">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-heading text-xl font-medium tracking-tight">Photographs</h2>
            <span className="text-sm text-muted-foreground">{photos.length} total</span>
          </div>

          <ul className="divide-y divide-border border-y border-border">
            {photos.map((photo) => {
              const draft = drafts[photo.id] ?? { alt: photo.alt, sortOrder: photo.sortOrder };
              const dirty = draft.alt !== photo.alt || draft.sortOrder !== photo.sortOrder;

              return (
                <li key={photo.id} className="flex items-center gap-4 py-4">
                  <img
                    src={photo.src}
                    alt={photo.alt || "Portfolio photograph"}
                    className="h-16 w-24 flex-none object-cover"
                    loading="lazy"
                  />
                  <input
                    value={draft.alt}
                    placeholder="Alt text"
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [photo.id]: { ...draft, alt: e.target.value },
                      }))
                    }
                    className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 text-sm outline-none transition-colors focus:border-border"
                  />
                  <input
                    type="number"
                    value={draft.sortOrder}
                    aria-label="Display order"
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [photo.id]: { ...draft, sortOrder: Number(e.target.value) },
                      }))
                    }
                    className="w-16 flex-none border-b border-transparent bg-transparent py-1 text-sm outline-none transition-colors focus:border-border"
                  />
                  <button
                    disabled={!dirty || saveMutation.isPending}
                    onClick={() =>
                      saveMutation.mutate({
                        id: photo.id,
                        alt: draft.alt,
                        sortOrder: draft.sortOrder,
                      })
                    }
                    className="flex-none text-sm font-medium transition-colors disabled:text-muted-foreground/50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Remove this photograph?")) deleteMutation.mutate(photo.id);
                    }}
                    className="flex-none text-sm text-muted-foreground transition-colors hover:text-leica-red"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>

          {photos.length === 0 && (
            <p className="py-10 text-sm text-muted-foreground">No photographs yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
