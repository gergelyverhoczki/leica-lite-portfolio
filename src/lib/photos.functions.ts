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
};

function publicUrl(client: ReturnType<typeof createPublicClient>, path: string): string {
  return client.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

function toGalleryPhotos(
  client: ReturnType<typeof createPublicClient>,
  rows: PhotoRow[],
): GalleryPhoto[] {
  return rows.map((row) => ({
    id: row.id,
    src: row.storage_path ? publicUrl(client, row.storage_path) : row.url,
    alt: row.alt,
    sortOrder: row.sort_order,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
  }));
}

export const listPhotos = createServerFn({ method: "GET" }).handler(async () => {
  const client = createPublicClient();
  const { data, error } = await client
    .from("photos")
    .select("id, url, storage_path, alt, sort_order, width, height")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return toGalleryPhotos(client, (data ?? []) as PhotoRow[]);
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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("photos")
      .update({ alt: data.alt, sort_order: data.sortOrder })
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
      .select("id, url, storage_path, alt, sort_order, width, height")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as PhotoRow[];
    const publicClient = createPublicClient();

    return rows.map((row) => ({
      id: row.id,
      src: row.storage_path ? publicUrl(publicClient, row.storage_path) : row.url,
      alt: row.alt,
      sortOrder: row.sort_order,
      storagePath: row.storage_path,
      width: row.width,
      height: row.height,
    })) satisfies GalleryPhoto[];
  });
