import { CHAPTERS as ALGEBRA_CHAPTERS, SECTIONS as ALGEBRA_SECTIONS } from "./algebra1";
import { GEOMETRY_CHAPTERS, GEOMETRY_SECTIONS } from "./geometry";
export type CourseId = "algebra1" | "geometry";
export const COURSES = {
  algebra1: { id: "algebra1" as const, title: "Algebra 1", dashboardPath: "/dashboard", banner: "/dashboard/algebra1-course-dashboard-banner.png", chapters: ALGEBRA_CHAPTERS, sections: ALGEBRA_SECTIONS },
  geometry: { id: "geometry" as const, title: "Geometry", dashboardPath: "/geometry", banner: "/dashboard/geometry-course-dashboard-banner.png", chapters: GEOMETRY_CHAPTERS, sections: GEOMETRY_SECTIONS },
};
export const CHAPTERS = [...ALGEBRA_CHAPTERS, ...GEOMETRY_CHAPTERS];
export const SECTIONS = [...ALGEBRA_SECTIONS, ...GEOMETRY_SECTIONS];
export function isCourseId(id: unknown): id is CourseId { return id === "algebra1" || id === "geometry"; }
export function getCourse(id: string | null | undefined = "algebra1") { return COURSES[id === "geometry" ? "geometry" : "algebra1"]; }
export function getCourseForChapter(id: string) { return getCourse(id.startsWith("geo-") ? "geometry" : "algebra1"); }
export function getCourseForSection(id: string) { return getCourseForChapter(id); }
export function getCourseForPath(path: string) { return getCourse(path === "/geometry" || /\/(?:chapter|section)\/geo-/.test(path) ? "geometry" : "algebra1"); }
