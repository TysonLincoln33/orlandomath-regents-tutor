import Link from "next/link";
import { COURSES } from "@/lib/course/registry";
export default function HomePage() {
 return <main className="mx-auto max-w-6xl px-4 py-12 md:py-20">
  <div className="mb-10 text-center text-white"><p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200">OrlandoMath Regents Tutor</p>
   <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Choose your course</h1>
   <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-200">Practice by topic, build your skills, and track your progress toward the Regents.</p></div>
  <div className="grid gap-7 md:grid-cols-2">{Object.values(COURSES).map(course => <Link key={course.id} href={course.dashboardPath} className="group overflow-hidden rounded-3xl border border-white/25 bg-[rgba(10,12,35,0.7)] shadow-2xl transition hover:-translate-y-1 hover:border-cyan-300 focus-visible:outline-4 focus-visible:outline-cyan-300">
   <img src={course.banner} alt={course.title + " Course Dashboard"} className="h-auto w-full object-contain" />
   <div className="p-7 text-white"><h2 className="text-2xl font-bold">{course.title}</h2><p className="mt-3 leading-7 text-slate-200">{course.id === "geometry" ? "Explore shapes, transformations, trigonometry, and guided proof tables." : "Build confidence with equations, functions, graphing, and algebraic reasoning."}</p>
    <div className="mt-6 flex items-center justify-between gap-4"><span className="text-sm text-slate-300">{course.chapters.length} chapters · {course.sections.length} topics</span><span className="font-bold text-cyan-200">Open course →</span></div></div>
  </Link>)}</div></main>;
}
