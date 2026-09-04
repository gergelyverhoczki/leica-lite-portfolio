import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type GalleryPhoto = {
  id: string;
  src: string;
  alt: string;
  sortOrder: number;
  storagePath: string | null;
  width: number | null;
  height: number | null;
  inPortfolio?: boolean;
  projectTitle?: string | null;
  projectSlug?: string | null;
};


function createPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type PhotoRow = {
  id: string;
  url: string;
  storage_path: string | null;
  alt: string;
  sort_order: number;
  width: number | null;
  height: number | null;
  in_portfolio?: boolean;
};

function publicUrl(client: ReturnType<typeof createPublicClient>, path: string): string {
  return client.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

export function toGalleryPhoto(
  client: ReturnType<typeof createPublicClient>,
  row: PhotoRow,
): GalleryPhoto {
  return {
    id: row.id,
    src: row.storage_path ? publicUrl(client, row.storage_path) : row.url,
    alt: row.alt,
    sortOrder: row.sort_order,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    inPortfolio: row.in_portfolio ?? true,
  };
}

export const listPhotos = createServerFn({ method: "GET" }).handler(async () => {
  const client = createPublicClient();
  const columns = "id, url, storage_path, alt, sort_order, width, height, in_portfolio, created_at";

  // The homepage gallery is: standalone library photographs (not part of any
  // project) plus the photographs explicitly selected as "show on homepage"
  // inside a published project (RLS hides links of unpublished projects).
  const [portfolio, links, projects] = await Promise.all([
    client.from("photos").select(columns).eq("in_portfolio", true),
    client.from("project_photos").select("photo_id, project_id, show_on_homepage, sort_order"),
    client.from("projects").select("id, title, slug").eq("status", "published"),
  ]);
  if (portfolio.error) throw new Error(portfolio.error.message);
  if (links.error) throw new Error(links.error.message);
  if (projects.error) throw new Error(projects.error.message);

  type Link = { photo_id: string; project_id: string; show_on_homepage: boolean | null };
  const linkRows = (links.data ?? []) as Link[];
  const projectMap = new Map(
    ((projects.data ?? []) as Array<{ id: string; title: string; slug: string }>).map((p) => [p.id, p]),
  );

  const linkedPhotoIds = new Set(linkRows.map((link) => link.photo_id));
  // photo id -> owning published project (first published link wins)
  const photoProject = new Map<string, { title: string; slug: string }>();
  const selectedIds = new Set<string>();
  for (const link of linkRows) {
    const project = projectMap.get(link.project_id);
    if (!project) continue;
    if (!photoProject.has(link.photo_id)) {
      photoProject.set(link.photo_id, { title: project.title, slug: project.slug });
    }
    if (link.show_on_homepage) selectedIds.add(link.photo_id);
  }

  const rows = new Map<string, PhotoRow & { created_at: string }>();
  for (const row of (portfolio.data ?? []) as Array<PhotoRow & { created_at: string }>) {
    // Photographs belonging to a project only appear when explicitly selected.
    if (linkedPhotoIds.has(row.id) && !selectedIds.has(row.id)) continue;
    rows.set(row.id, row);
  }

  const missing = [...selectedIds].filter((id) => !rows.has(id));
  if (missing.length > 0) {
    const { data, error } = await client.from("photos").select(columns).in("id", missing);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<PhotoRow & { created_at: string }>) rows.set(row.id, row);
  }

  // Keep the existing curated ordering: sort_order first, then upload time.
  return [...rows.values()]
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((row) => {
      const project = photoProject.get(row.id);
      return {
        ...toGalleryPhoto(client, row),
        projectTitle: project?.title ?? null,
        projectSlug: project?.slug ?? null,
      };
    });
});



export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true, userId: context.userId };
  });

export const addPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        storagePath: z.string().min(1).max(300),
        alt: z.string().max(300).default(""),
        sortOrder: z.number().int().min(0).max(100000),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        inPortfolio: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("photos")
      .insert({
        url: "",
        storage_path: data.storagePath,
        alt: data.alt,
        sort_order: data.sortOrder,
        in_portfolio: data.inPortfolio,
        ...(data.width && data.height ? { width: data.width, height: data.height } : {}),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updatePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        alt: z.string().max(300),
        sortOrder: z.number().int().min(0).max(100000),
        inPortfolio: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("photos")
      .update({
        alt: data.alt,
        sort_order: data.sortOrder,
        ...(data.inPortfolio === undefined ? {} : { in_portfolio: data.inPortfolio }),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("photos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase.from("photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row?.storage_path) {
      await context.supabase.storage.from("photos").remove([row.storage_path]);
    }
    return { ok: true };
  });

export const listPhotosForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("photos")
      .select("id, url, storage_path, alt, sort_order, width, height, in_portfolio")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as PhotoRow[];
    const publicClient = createPublicClient();
    return rows.map((row) => toGalleryPhoto(publicClient, row));
  });
