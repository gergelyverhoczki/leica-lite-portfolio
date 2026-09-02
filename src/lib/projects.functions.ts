import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { GalleryPhoto } from "@/lib/photos.functions";

// Public project pages use the same editorial photo shape without needing portfolio-only fields.


type ProjectRow = {
  id: string;
  title: string;
  slug: string;
  year: string | null;
  description: string | null;
  status: string;
  sort_order: number;
};

type ProjectPhotoRow = {
  id: string;
  project_id: string;
  photo_id: string;
  sort_order: number;
};

type PhotoRow = {
  id: string;
  url: string;
  storage_path: string | null;
  alt: string;
  sort_order: number;
  width: number | null;
  height: number | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  slug: string;
  year: string | null;
  description: string | null;
  status: string;
  sortOrder: number;
  photoCount: number;
};

export type ProjectDetail = ProjectSummary & { photos: GalleryPhoto[] };

export type AdminProjectPhoto = GalleryPhoto & { projectPhotoId: string; projectSortOrder: number };

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

function publicUrl(client: ReturnType<typeof createPublicClient>, path: string): string {
  return client.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

function toPhoto(client: ReturnType<typeof createPublicClient>, row: PhotoRow): GalleryPhoto {
  return {
    id: row.id,
    src: row.storage_path ? publicUrl(client, row.storage_path) : row.url,
    alt: row.alt,
    sortOrder: row.sort_order,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    inPortfolio: true,
  };
}

function toSummary(row: ProjectRow, photoCount: number): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    year: row.year,
    description: row.description,
    status: row.status,
    sortOrder: row.sort_order,
    photoCount,
  };
}

async function getPublishedProjects() {
  const client = createPublicClient();
  const [{ data: projects, error: projectError }, { data: links, error: linkError }] = await Promise.all([
    client
      .from("projects")
      .select("id, title, slug, year, description, status, sort_order")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client.from("project_photos").select("project_id"),
  ]);
  if (projectError) throw new Error(projectError.message);
  if (linkError) throw new Error(linkError.message);

  const counts = new Map<string, number>();
  for (const link of (links ?? []) as Array<{ project_id: string }>) {
    counts.set(link.project_id, (counts.get(link.project_id) ?? 0) + 1);
  }
  return ((projects ?? []) as ProjectRow[])
    .map((project) => toSummary(project, counts.get(project.id) ?? 0))
    .filter((project) => project.photoCount > 0);
}

export const listPublishedProjects = createServerFn({ method: "GET" }).handler(async () =>
  getPublishedProjects(),
);

export const getPublishedProject = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const client = createPublicClient();
    let { data: project, error } = await client
      .from("projects")
      .select("id, title, slug, year, description, status, sort_order")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!project) {
      const { data: history, error: historyError } = await client
        .from("project_slug_history")
        .select("project_id")
        .eq("slug", data.slug)
        .maybeSingle();
      if (historyError) throw new Error(historyError.message);
      if (history) {
        const result = await client
          .from("projects")
          .select("id, title, slug, year, description, status, sort_order")
          .eq("id", history.project_id)
          .eq("status", "published")
          .maybeSingle();
        project = result.data;
        error = result.error;
        if (error) throw new Error(error.message);
      }
    }

    if (!project) return null;
    const { data: links, error: linkError } = await client
      .from("project_photos")
      .select("id, project_id, photo_id, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true });
    if (linkError) throw new Error(linkError.message);

    const projectLinks = (links ?? []) as ProjectPhotoRow[];
    if (projectLinks.length === 0) return null;
    const photoIds = projectLinks.map((link) => link.photo_id);
    const { data: photos, error: photoError } = await client
      .from("photos")
      .select("id, url, storage_path, alt, sort_order, width, height")
      .in("id", photoIds);
    if (photoError) throw new Error(photoError.message);
    const photoMap = new Map(((photos ?? []) as PhotoRow[]).map((photo) => [photo.id, toPhoto(client, photo)]));

    return {
      ...toSummary(project as ProjectRow, projectLinks.length),
      photos: projectLinks.flatMap((link) => {
        const photo = photoMap.get(link.photo_id);
        return photo ? [photo] : [];
      }),
    } satisfies ProjectDetail;
  });

function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

async function uniqueSlug(
  client: ReturnType<typeof createPublicClient>,
  title: string,
  currentId?: string,
): Promise<string> {
  const base = slugify(title);
  const [{ data: projects }, { data: history }] = await Promise.all([
    client.from("projects").select("id, slug"),
    client.from("project_slug_history").select("slug"),
  ]);
  const used = new Set([
    ...((projects ?? []) as Array<{ id: string; slug: string }>)
      .filter((project) => project.id !== currentId)
      .map((project) => project.slug),
    ...((history ?? []) as Array<{ slug: string }>).map((item) => item.slug),
  ]);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export const listProjectsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title, slug, year, description, status, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: links, error: linkError } = await context.supabase
      .from("project_photos")
      .select("project_id");
    if (linkError) throw new Error(linkError.message);
    const counts = new Map<string, number>();
    for (const link of (links ?? []) as Array<{ project_id: string }>) {
      counts.set(link.project_id, (counts.get(link.project_id) ?? 0) + 1);
    }
    return ((data ?? []) as ProjectRow[]).map((project) => toSummary(project, counts.get(project.id) ?? 0));
  });

const projectInput = z.object({
  title: z.string().trim().min(1).max(160),
  year: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]),
  sortOrder: z.number().int().min(0).max(100000),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => projectInput.parse(input))
  .handler(async ({ data, context }) => {
    const slug = await uniqueSlug(createPublicClient(), data.title);
    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({
        title: data.title,
        slug,
        year: data.year || null,
        description: data.description || null,
        status: data.status,
        sort_order: data.sortOrder,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: project.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), ...projectInput.shape }).parse(input))
  .handler(async ({ data, context }) => {
    const slug = await uniqueSlug(createPublicClient(), data.title, data.id);
    const { error } = await context.supabase
      .from("projects")
      .update({
        title: data.title,
        slug,
        year: data.year || null,
        description: data.description || null,
        status: data.status,
        sort_order: data.sortOrder,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { slug };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProjectPhotosForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: links, error: linkError } = await context.supabase
      .from("project_photos")
      .select("id, project_id, photo_id, sort_order")
      .eq("project_id", data.projectId)
      .order("sort_order", { ascending: true });
    if (linkError) throw new Error(linkError.message);
    const projectLinks = (links ?? []) as ProjectPhotoRow[];
    if (projectLinks.length === 0) return [] satisfies AdminProjectPhoto[];
    const { data: photos, error: photoError } = await context.supabase
      .from("photos")
      .select("id, url, storage_path, alt, sort_order, width, height")
      .in("id", projectLinks.map((link) => link.photo_id));
    if (photoError) throw new Error(photoError.message);
    const publicClient = createPublicClient();
    const photoMap = new Map(((photos ?? []) as PhotoRow[]).map((photo) => [photo.id, toPhoto(publicClient, photo)]));
    return projectLinks.flatMap((link) => {
      const photo = photoMap.get(link.photo_id);
      return photo ? [{ ...photo, projectPhotoId: link.id, projectSortOrder: link.sort_order }] : [];
    });
  });

export const addPhotoToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), photoId: z.string().uuid(), sortOrder: z.number().int().min(0).max(100000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_photos").insert({
      project_id: data.projectId,
      photo_id: data.photoId,
      sort_order: data.sortOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePhotoFromProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProjectPhotoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(100000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_photos")
      .update({ sort_order: data.sortOrder })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
