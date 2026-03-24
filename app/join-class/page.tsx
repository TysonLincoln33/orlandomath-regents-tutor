import JoinClassForm from "@/components/classrooms/JoinClassForm";

export default function JoinClassPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-white">
        Join a Class
      </h1>

      <p className="mb-6 text-sm text-slate-300">
        Enter your class code below to join your teacher’s classroom.
      </p>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 shadow-lg">
        <JoinClassForm />
      </div>
    </div>
  );
}