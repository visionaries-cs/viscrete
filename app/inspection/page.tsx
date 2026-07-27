"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import AppNav from "@/components/AppNav";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState } from "@/components/app/StatePanel";
import LocationPicker from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSite, deleteSite, listSites, type SiteResponse } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SiteCard({
  site,
  selected,
  onSelect,
  onDeleteRequest,
}: {
  site: SiteResponse;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  return (
    <article
      className={`group relative flex min-h-48 flex-col rounded-2xl border bg-card transition-[border-color,box-shadow,background-color] ${
        selected
          ? "border-primary/50 bg-primary/[0.035] ring-2 ring-primary/10"
          : "border-border hover:border-primary/35 hover:shadow-[0_12px_30px_rgb(25_32_39/0.07)]"
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <button
          onClick={() => onSelect(site.site_id)}
          className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition ${
            selected
              ? "border-primary bg-primary"
              : "border-input bg-card hover:border-primary/60"
          }`}
          aria-label={selected ? `Deselect ${site.name}` : `Select ${site.name}`}
        >
          {selected && (
            <svg className="size-3 text-primary-foreground" fill="none" viewBox="0 0 10 8">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          onClick={() => onDeleteRequest(site.site_id)}
          className="rounded-lg p-2 text-muted-foreground opacity-60 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          aria-label={`Delete ${site.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <Link href={`/sites/${site.site_id}`} className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/55 text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-foreground">{site.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {site.address || "No address set"}
            </p>
          </div>
          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <User className="size-3 shrink-0" />
            <span className="truncate">{site.inspector_name || "Unassigned"}</span>
          </span>
          <span className="flex items-center justify-end gap-1.5">
            <Calendar className="size-3" />
            {formatDate(site.created_at)}
          </span>
        </div>
      </Link>
    </article>
  );
}

export default function InspectionPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void loadSites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSites() {
    setLoading(true);
    setError(null);
    try {
      setSites(await listSites());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!siteName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const site = await createSite({
        name: siteName.trim(),
        address: address.trim(),
        inspector_name: inspectorName.trim(),
      });
      router.push(`/sites/${site.site_id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create site");
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!pendingDeleteIds.length) return;
    const ids = [...pendingDeleteIds];
    const snapshot = sites.filter((site) => ids.includes(site.site_id));
    setSites((current) => current.filter((site) => !ids.includes(site.site_id)));
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPendingDeleteIds([]);
    setDeleteError(null);
    try {
      await Promise.all(snapshot.map((site) => deleteSite(site.site_id)));
    } catch (e) {
      setSites((current) => [...snapshot, ...current]);
      setDeleteError(e instanceof Error ? e.message : "Failed to delete. Items were restored.");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredSites = sites.filter((site) =>
    !normalizedSearch ||
    site.name.toLowerCase().includes(normalizedSearch) ||
    site.address.toLowerCase().includes(normalizedSearch) ||
    site.inspector_name.toLowerCase().includes(normalizedSearch)
  );
  const allSelected = filteredSites.length > 0 && filteredSites.every((site) => selectedIds.has(site.site_id));

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allSelected) {
        const next = new Set(current);
        filteredSites.forEach((site) => next.delete(site.site_id));
        return next;
      }
      return new Set([...current, ...filteredSites.map((site) => site.site_id)]);
    });
  }

  function scrollToCreate() {
    document.getElementById("new-site")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="app-page">
      <AppNav subtitle="Site portfolio" />

      <main className="page-container page-main">
        <PageHeader
          eyebrow="Inspection portfolio"
          title="Sites"
          description="Organize inspections by building or project location, then track findings from capture through closeout."
          actions={
            <Button onClick={scrollToCreate} className="w-full sm:w-auto">
              <Plus className="size-4" />
              New site
            </Button>
          }
        />

        <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Inspection sites</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {loading ? "Loading portfolio…" : `${filteredSites.length} ${filteredSites.length === 1 ? "site" : "sites"}`}
                  </p>
                </div>
                {!loading && filteredSites.length > 0 && (
                  <button onClick={toggleSelectAll} className="text-xs font-semibold text-primary hover:underline">
                    {allSelected ? "Clear selection" : "Select all"}
                  </button>
                )}
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDeleteIds([...selectedIds]);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete {selectedIds.size}
                  </Button>
                )}
                <div className="relative min-w-0 flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search sites"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {deleteError && <ErrorState className="mb-4" title="Delete failed" description={deleteError} />}

            {loading && (
              <div className="surface-panel flex min-h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                <span className="text-sm">Loading sites…</span>
              </div>
            )}

            {error && !loading && <ErrorState title="Could not load sites" description={error} onRetry={loadSites} />}

            {!loading && !error && filteredSites.length === 0 && (
              <EmptyState
                icon={Building2}
                title={search ? "No matching sites" : "No inspection sites yet"}
                description={search ? "Try a different site, address, or inspector name." : "Create a site to group jobs, findings, and reports under one location."}
                actionLabel={search ? "Clear search" : "Create first site"}
                onAction={() => search ? setSearch("") : scrollToCreate()}
              />
            )}

            {!loading && !error && filteredSites.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredSites.map((site) => (
                  <SiteCard
                    key={site.site_id}
                    site={site}
                    selected={selectedIds.has(site.site_id)}
                    onSelect={toggleSelect}
                    onDeleteRequest={(id) => {
                      setDeleteError(null);
                      setPendingDeleteIds([id]);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <aside id="new-site" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-border bg-card">
              <CardContent className="p-5 sm:p-6">
                <p className="section-kicker">Create</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">New inspection site</h2>
                <p className="mb-6 mt-1.5 text-sm leading-6 text-muted-foreground">
                  Set up the location once, then attach multiple inspection jobs and reports.
                </p>

                <form onSubmit={handleCreate} className="space-y-5">
                  <div>
                    <Label htmlFor="siteName" className="field-label">
                      Site name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="siteName"
                      placeholder="e.g. Rizal Hall, Block A"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="field-label">Address</Label>
                    <LocationPicker value={address} onChange={setAddress} />
                  </div>
                  <div>
                    <Label htmlFor="inspector" className="field-label">Inspector / structural engineer</Label>
                    <Input
                      id="inspector"
                      placeholder="Full name"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                    />
                  </div>
                  {createError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {createError}
                    </div>
                  )}
                  <div className="border-t pt-5">
                    <Button type="submit" disabled={creating || !siteName.trim()} className="w-full">
                      {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      {creating ? "Creating…" : "Create site"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {pendingDeleteIds.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => setPendingDeleteIds([])}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-site-title"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
                  <Trash2 className="size-4" />
                </div>
                <div>
                  <h2 id="delete-site-title" className="text-sm font-semibold text-foreground">
                    {pendingDeleteIds.length === 1 ? "Delete site?" : `Delete ${pendingDeleteIds.length} sites?`}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Existing inspection jobs will not be deleted.</p>
                </div>
              </div>
              <button onClick={() => setPendingDeleteIds([])} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-5 text-sm leading-6 text-muted-foreground">
              {pendingDeleteIds.length === 1 ? (
                <>The site <strong className="font-semibold text-foreground">{sites.find((site) => site.site_id === pendingDeleteIds[0])?.name}</strong> will be removed from your portfolio.</>
              ) : (
                <>The selected <strong className="font-semibold text-foreground">{pendingDeleteIds.length} sites</strong> will be removed from your portfolio.</>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setPendingDeleteIds([])}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 border-t">
        <div className="page-container py-5">
          <p className="text-xs text-muted-foreground">© VISCRETE 2026 · Concrete inspection workspace</p>
        </div>
      </footer>
    </div>
  );
}
