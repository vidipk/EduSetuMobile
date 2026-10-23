import type { CatalogCourse } from '@/api/contracts/learning';

export interface ChapterSummary {
  id: string;
  title: string;
  description: string | null;
  lessonCount: number;
}

export interface SubjectGroup {
  id: string;
  name: string;
  description: string | null;
  chapters: ChapterSummary[];
}

/**
 * Groups the student-authorised published courses by their real Subject record.
 * Names/descriptions come only from the Subject row; nothing is inferred from titles.
 * Courses without a subject are not shown (a chapter needs a subject to be navigable).
 */
export function groupSubjects(courses: CatalogCourse[]): SubjectGroup[] {
  const byId = new Map<string, SubjectGroup>();
  for (const course of courses) {
    if (!course.subject) continue;
    const group = byId.get(course.subject.id) ?? { id: course.subject.id, name: course.subject.name, description: course.subject.description, chapters: [] };
    group.chapters.push({ id: course.id, title: course.title, description: course.description, lessonCount: course._count?.lessons ?? 0 });
    byId.set(course.subject.id, group);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const norm = (value: string | null | undefined) => (value ?? '').toLocaleLowerCase();

/** Filters displayed content only: a subject matches by its own text or any of its chapter titles. */
export function filterSubjects(subjects: SubjectGroup[], query: string): SubjectGroup[] {
  const needle = norm(query.trim());
  if (!needle) return subjects;
  return subjects.filter((subject) =>
    norm(subject.name).includes(needle) ||
    norm(subject.description).includes(needle) ||
    subject.chapters.some((chapter) => norm(chapter.title).includes(needle) || norm(chapter.description).includes(needle)));
}

export function filterChapters(chapters: ChapterSummary[], query: string): ChapterSummary[] {
  const needle = norm(query.trim());
  return needle ? chapters.filter((chapter) => norm(chapter.title).includes(needle) || norm(chapter.description).includes(needle)) : chapters;
}

export const param = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw : undefined;
};
