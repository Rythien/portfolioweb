import { create } from "zustand";

/**
 * What the visitor has done in THE ARCHIVE, kept across visits.
 * Free of three.js so the awake page (project cards) can read it.
 *
 * - freed:     seals broken open (three facet hits); counts toward
 *              "PROJECTS RECOVERED n / 3" and stays freed next visit
 * - recovered: projects whose panel the visitor floated into; their card
 *              on the awake page carries "Recovered from the dream"
 * - pendingCase: the last panel floated into this visit; its case study
 *              opens once the visitor wakes (not persisted)
 * - hintSeen:  the one-line hint shows on a first visit only
 */

const KEY = "archive-progress-v1";

interface Saved {
  freed: string[];
  recovered: string[];
  hintSeen: boolean;
}

interface ArchiveProgress extends Saved {
  pendingCase: string | null;
  hydrated: boolean;
  hydrate: () => void;
  free: (slug: string) => void;
  recover: (slug: string) => void;
  takePendingCase: () => string | null;
  seeHint: () => void;
}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { freed: [], recovered: [], hintSeen: false };
    const v = JSON.parse(raw) as Partial<Saved>;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);
    return { freed: list(v.freed), recovered: list(v.recovered), hintSeen: v.hintSeen === true };
  } catch {
    return { freed: [], recovered: [], hintSeen: false };
  }
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ freed: s.freed, recovered: s.recovered, hintSeen: s.hintSeen }));
  } catch {
    // Private mode / storage blocked: progress lasts this visit only
  }
}

const add = (list: string[], slug: string) => (list.includes(slug) ? list : [...list, slug]);

export const useArchiveProgress = create<ArchiveProgress>((set, get) => ({
  freed: [],
  recovered: [],
  hintSeen: false,
  pendingCase: null,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...read(), hydrated: true });
  },
  free: (slug) => {
    const s = get();
    if (s.freed.includes(slug)) return;
    const next = { freed: add(s.freed, slug), recovered: s.recovered, hintSeen: s.hintSeen };
    write(next);
    set(next);
  },
  recover: (slug) => {
    const s = get();
    const next = { freed: add(s.freed, slug), recovered: add(s.recovered, slug), hintSeen: s.hintSeen };
    write(next);
    set({ ...next, pendingCase: slug });
  },
  takePendingCase: () => {
    const slug = get().pendingCase;
    if (slug) set({ pendingCase: null });
    return slug;
  },
  seeHint: () => {
    const s = get();
    if (s.hintSeen) return;
    const next = { freed: s.freed, recovered: s.recovered, hintSeen: true };
    write(next);
    set(next);
  },
}));
