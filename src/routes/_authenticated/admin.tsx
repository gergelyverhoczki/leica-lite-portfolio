import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import {
  addPhoto,
  deletePhoto,
  getIsAdmin,
  listPhotosForAdmin,
  updatePhoto,
} from "@/lib/photos.functions";
import {
  addPhotoToProject,
  createProject,
  deleteProject,
  listProjectPhotosForAdmin,
  listProjectsForAdmin,
  removePhotoFromProject,
  setProjectPhotoHomepage,
  updateProject,
  updateProjectPhotoOrder,
} from "@/lib/projects.functions";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Manage portfolio — Gergely Verhoczki" },
      { name: "description", content: "Private admin area for managing portfolio projects and photographs." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Manage portfolio — Gergely Verhoczki" },
      { property: "og:description", content: "Private admin area for managing portfolio projects and photographs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type ProjectDraft = {
  title: string;
  year: string;
  description: string;
  status: "draft" | "published";
  sortOrder: number;
};

const blankProject: ProjectDraft = {
  title: "",
  year: "",
  description: "",
  status: "draft",
  sortOrder: 0,
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const projectFileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [projectDragging, setProjectDragging] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, { alt: string; sortOrder: number }>>({});
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(blankProject);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const checkAdmin = useServerFn(getIsAdmin);
  const fetchPhotos = useServerFn(listPhotosForAdmin);
  const runAddPhoto = useServerFn(addPhoto);
  const runUpdatePhoto = useServerFn(updatePhoto);
  const runDeletePhoto = useServerFn(deletePhoto);
  const fetchProjects = useServerFn(listProjectsForAdmin);
  const fetchProjectPhotos = useServerFn(listProjectPhotosForAdmin);
  const runCreateProject = useServerFn(createProject);
  const runUpdateProject = useServerFn(updateProject);
  const runDeleteProject = useServerFn(deleteProject);
  const runAddPhotoToProject = useServerFn(addPhotoToProject);
  const runRemovePhotoFromProject = useServerFn(removePhotoFromProject);
  const runUpdateProjectPhotoOrder = useServerFn(updateProjectPhotoOrder);
  const runSetProjectPhotoHomepage = useServerFn(setProjectPhotoHomepage);


  const adminQuery = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const photosQuery = useQuery({
    queryKey: ["admin-photos"],
    queryFn: () => fetchPhotos(),
    enabled: adminQuery.data?.isAdmin === true,
  });
  const projectsQuery = useQuery({
    queryKey: ["admin-projects"],
    queryFn: () => fetchProjects(),
    enabled: adminQuery.data?.isAdmin === true,
  });
  const activeProjectId = selectedProjectId ?? projectsQuery.data?.[0]?.id ?? null;
  const projectPhotosQuery = useQuery({
    queryKey: ["admin-project-photos", activeProjectId],
    queryFn: () => fetchProjectPhotos({ data: { projectId: activeProjectId as string } }),
    enabled: Boolean(activeProjectId),
  });

  const saveMutation = useMutation({
    mutationFn: (input: { id: string; alt: string; sortOrder: number }) => runUpdatePhoto({ data: input }),
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
      await queryClient.invalidateQueries({ queryKey: ["admin-project-photos"] });
    },
  });
  const projectMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title: projectDraft.title,
        year: projectDraft.year || null,
        description: projectDraft.description || null,
        status: projectDraft.status,
        sortOrder: projectDraft.sortOrder,
      };
      if (editingProjectId) return runUpdateProject({ data: { id: editingProjectId, ...data } });
      return runCreateProject({ data });
    },
    onSuccess: async (result) => {
      setMessage(editingProjectId ? "Project updated." : "Project created.");
      setEditingProjectId(null);
      setProjectDraft(blankProject);
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      if ("id" in result) setSelectedProjectId(result.id);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Project could not be saved."),
  });
  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => runDeleteProject({ data: { id } }),
    onSuccess: async () => {
      setMessage("Project removed.");
      setEditingProjectId(null);
      setProjectDraft(blankProject);
      setSelectedProjectId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
  });
  const assignmentMutation = useMutation({
    mutationFn: (input: { projectId: string; photoId: string; sortOrder: number }) => runAddPhotoToProject({ data: input }),
    onSuccess: async () => {
      setMessage("Photo assigned.");
      await queryClient.invalidateQueries({ queryKey: ["admin-project-photos", activeProjectId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Photo could not be assigned."),
  });
  const removeAssignmentMutation = useMutation({
    mutationFn: (id: string) => runRemovePhotoFromProject({ data: { id } }),
    onSuccess: async () => {
      setMessage("Photo removed from project.");
      await queryClient.invalidateQueries({ queryKey: ["admin-project-photos", activeProjectId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
  });
  const reorderMutation = useMutation({
    mutationFn: (input: { id: string; sortOrder: number }) => runUpdateProjectPhotoOrder({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-project-photos", activeProjectId] }),
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const uploadFiles = async (files: FileList | File[], projectId?: string) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (list.length === 0) return;
    setUploading(true);
    setMessage(null);
    let nextOrder = (photosQuery.data ?? []).reduce((max, photo) => Math.max(max, photo.sortOrder), 0) + 1;
    let nextProjectOrder = (projectPhotosQuery.data ?? []).reduce((max, photo) => Math.max(max, photo.projectSortOrder), -1) + 1;
    try {
      let done = 0;
      for (const original of list) {
        setMessage(`Uploading ${done + 1} of ${list.length}…`);
        const { file, width, height } = await compressImage(original);
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("photos").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const created = await runAddPhoto({
          data: {
            storagePath: path,
            alt: "",
            sortOrder: nextOrder,
            // Project uploads live in the project; the homepage picks them up
            // automatically while the project is published.
            inPortfolio: !projectId,
            ...(width > 0 && height > 0 ? { width, height } : {}),
          },
        });
        if (projectId) {
          await runAddPhotoToProject({ data: { projectId, photoId: created.id, sortOrder: nextProjectOrder } });
          nextProjectOrder += 1;
        }
        nextOrder += 1;
        done += 1;
      }
      setMessage(`${list.length} photo${list.length > 1 ? "s" : ""} uploaded.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-photos"] });
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ["admin-project-photos", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      if (projectFileInput.current) projectFileInput.current.value = "";
    }
  };


  const startEditing = (project: NonNullable<typeof projectsQuery.data>[number]) => {
    setSelectedProjectId(project.id);
    setEditingProjectId(project.id);
    setProjectDraft({
      title: project.title,
      year: project.year ?? "",
      description: project.description ?? "",
      status: project.status === "published" ? "published" : "draft",
      sortOrder: project.sortOrder,
    });
  };

  if (adminQuery.isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!adminQuery.data?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-heading text-2xl font-medium">Not authorised</h1>
        <p className="max-w-sm text-sm text-muted-foreground">This account doesn't have permission to manage the portfolio.</p>
        <button onClick={handleSignOut} className="text-sm underline underline-offset-4">Sign out</button>
      </div>
    );
  }

  const photos = photosQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const assignedPhotos = projectPhotosQuery.data ?? [];
  const assignedIds = new Set(assignedPhotos.map((photo) => photo.id));
  const availablePhotos = photos.filter((photo) => !assignedIds.has(photo.id));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-leica-red" aria-hidden="true" /><span className="font-heading text-lg font-medium tracking-tight">Manage portfolio</span></Link>
          <div className="flex items-center gap-6 text-sm"><Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">View site</Link><button onClick={handleSignOut} className="text-muted-foreground transition-colors hover:text-foreground">Sign out</button></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section>
          <div className="mb-6 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Projects</p><h1 className="mt-2 font-heading text-2xl font-medium tracking-tight">Build the work index</h1></div><button onClick={() => { setEditingProjectId(null); setProjectDraft({ ...blankProject, sortOrder: projects.length }); }} className="text-sm font-medium underline underline-offset-4">New project</button></div>
          <div className="grid gap-8 border-y border-border py-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
            <div>
              <ul className="divide-y divide-border">
                {projects.map((project) => (
                  <li key={project.id} className={`flex items-center gap-4 py-4 ${activeProjectId === project.id ? "text-foreground" : "text-muted-foreground"}`}>
                    <button onClick={() => setSelectedProjectId(project.id)} className="min-w-0 flex-1 text-left"><span className="font-heading text-lg font-medium">{project.title}</span><span className="ml-3 text-xs">{project.status} · {project.photoCount} photos</span></button>
                    <button onClick={() => startEditing(project)} className="text-sm underline underline-offset-4">Edit</button>
                  </li>
                ))}
              </ul>
              {projects.length === 0 && <p className="py-4 text-sm text-muted-foreground">No projects yet.</p>}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); projectMutation.mutate(); }} className="space-y-4 border-l-0 border-border lg:border-l lg:pl-8">
              <div><label className="text-xs text-muted-foreground" htmlFor="project-title">Title</label><input id="project-title" required value={projectDraft.title} onChange={(event) => setProjectDraft({ ...projectDraft, title: event.target.value })} className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-foreground" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-muted-foreground" htmlFor="project-year">Year</label><input id="project-year" value={projectDraft.year} onChange={(event) => setProjectDraft({ ...projectDraft, year: event.target.value })} className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-foreground" /></div><div><label className="text-xs text-muted-foreground" htmlFor="project-order">Order</label><input id="project-order" type="number" min="0" value={projectDraft.sortOrder} onChange={(event) => setProjectDraft({ ...projectDraft, sortOrder: Number(event.target.value) })} className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-foreground" /></div></div>
              <div><label className="text-xs text-muted-foreground" htmlFor="project-description">Description</label><textarea id="project-description" rows={3} value={projectDraft.description} onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })} className="mt-2 w-full resize-none border-b border-border bg-transparent py-2 text-sm outline-none focus:border-foreground" /></div>
              <div className="flex items-center justify-between gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={projectDraft.status === "published"} onChange={(event) => setProjectDraft({ ...projectDraft, status: event.target.checked ? "published" : "draft" })} /> Published</label><div className="flex gap-4"><button type="submit" disabled={projectMutation.isPending} className="text-sm font-medium underline underline-offset-4">{editingProjectId ? "Save project" : "Create project"}</button>{editingProjectId && <button type="button" onClick={() => { if (confirm("Remove this project?")) deleteProjectMutation.mutate(editingProjectId); }} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-leica-red">Delete</button>}</div></div>
            </form>
          </div>
        </section>

        {activeProjectId && <section className="mt-16"><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected project</p><h2 className="mt-2 font-heading text-2xl font-medium tracking-tight">{projects.find((project) => project.id === activeProjectId)?.title}</h2></div><select aria-label="Add photo to project" disabled={availablePhotos.length === 0 || assignmentMutation.isPending} value="" onChange={(event) => { if (event.target.value) assignmentMutation.mutate({ projectId: activeProjectId, photoId: event.target.value, sortOrder: assignedPhotos.length }); }} className="max-w-[220px] border-b border-border bg-background py-2 text-sm outline-none"><option value="">Add photograph…</option>{availablePhotos.map((photo) => <option key={photo.id} value={photo.id}>{photo.alt || photo.id.slice(0, 8)}</option>)}</select></div><div onDragOver={(event) => { event.preventDefault(); setProjectDragging(true); }} onDragLeave={() => setProjectDragging(false)} onDrop={(event) => { event.preventDefault(); setProjectDragging(false); void uploadFiles(event.dataTransfer.files, activeProjectId); }} onClick={() => projectFileInput.current?.click()} className={`mb-8 flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed px-4 py-8 text-center transition-colors sm:px-6 sm:py-10 ${projectDragging ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40"}`}><p className="font-heading text-base font-medium">{uploading ? "Optimising & uploading…" : "Upload photos to this project"}</p><p className="mt-2 text-sm text-muted-foreground">Drop files or click to choose — added to this project automatically</p><input ref={projectFileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && void uploadFiles(event.target.files, activeProjectId)} /></div><ul className="divide-y divide-border border-y border-border">{assignedPhotos.map((photo, index) => <li key={photo.projectPhotoId} className="flex items-center gap-4 py-4"><img src={photo.src} alt={photo.alt || "Portfolio photograph"} className="h-16 w-24 flex-none object-cover" loading="lazy" /><span className="min-w-0 flex-1 text-sm">{photo.alt || "Untitled photograph"}</span><input type="number" min="0" value={photo.projectSortOrder} aria-label={`Project order for photograph ${index + 1}`} onChange={(event) => reorderMutation.mutate({ id: photo.projectPhotoId, sortOrder: Number(event.target.value) })} className="w-16 border-b border-border bg-transparent py-1 text-sm outline-none" /><button onClick={() => removeAssignmentMutation.mutate(photo.projectPhotoId)} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-leica-red">Remove</button></li>)}</ul>{assignedPhotos.length === 0 && <p className="py-8 text-sm text-muted-foreground">Assign photographs to this project from the menu above.</p>}</section>}

        <section className="mt-20"><div className="mb-6 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Library</p><h2 className="mt-2 font-heading text-2xl font-medium tracking-tight">Photographs</h2></div><span className="text-sm text-muted-foreground">{photos.length} total</span></div><div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }} onClick={() => fileInput.current?.click()} className={`flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed px-6 py-12 text-center transition-colors ${dragging ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/40"}`}><p className="font-heading text-base font-medium">{uploading ? "Optimising & uploading…" : "Drop photographs here"}</p><p className="mt-2 text-sm text-muted-foreground">or click to choose files — resized to 1600px, compressed to ~200KB</p><input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && void uploadFiles(event.target.files)} /></div>{message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}<ul className="mt-10 divide-y divide-border border-y border-border">{photos.map((photo) => { const draft = drafts[photo.id] ?? { alt: photo.alt, sortOrder: photo.sortOrder }; const dirty = draft.alt !== photo.alt || draft.sortOrder !== photo.sortOrder; return <li key={photo.id} className="flex items-center gap-4 py-4"><img src={photo.src} alt={photo.alt || "Portfolio photograph"} className="h-16 w-24 flex-none object-cover" loading="lazy" /><input value={draft.alt} placeholder="Alt text" aria-label="Alt text" onChange={(event) => setDrafts((prev) => ({ ...prev, [photo.id]: { ...draft, alt: event.target.value } }))} className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 text-sm outline-none transition-colors focus:border-border" /><input type="number" value={draft.sortOrder} aria-label="Display order" onChange={(event) => setDrafts((prev) => ({ ...prev, [photo.id]: { ...draft, sortOrder: Number(event.target.value) } }))} className="w-16 flex-none border-b border-transparent bg-transparent py-1 text-sm outline-none transition-colors focus:border-border" /><button disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate({ id: photo.id, alt: draft.alt, sortOrder: draft.sortOrder })} className="flex-none text-sm font-medium transition-colors disabled:text-muted-foreground/50">Save</button><button onClick={() => { if (confirm("Remove this photograph?")) deleteMutation.mutate(photo.id); }} className="flex-none text-sm text-muted-foreground transition-colors hover:text-leica-red">Delete</button></li>; })}</ul>{photos.length === 0 && <p className="py-10 text-sm text-muted-foreground">No photographs yet.</p>}</section>
      </main>
    </div>
  );
}
