'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { COURSES, type CourseId } from '@/lib/course/registry';
import { selectedCourseId } from '@/lib/course/selection';

export default function CourseWorkspace({ children }: { children: (courseId: CourseId) => ReactNode }) {
 const [courseId,setCourseId]=useState<CourseId | null>(null);
 useEffect(()=>setCourseId(selectedCourseId()),[]);
 if(!courseId) return <p className="p-8 text-white" role="status">Loading course…</p>;
 return <><div className="no-print mx-auto flex max-w-screen-2xl items-center gap-3 px-6 pt-6 text-white"><label htmlFor="workspace-course" className="font-semibold">Course</label><select id="workspace-course" value={courseId} className="rounded-xl border border-white/20 bg-slate-900 px-4 py-2 text-white" onChange={event=>{const url=new URL(window.location.href);url.searchParams.set('courseId',event.target.value);window.location.assign(url.toString());}}>{Object.values(COURSES).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}</select></div>{children(courseId)}</>;
}
