"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CreateClassroomForm from "@/components/classrooms/CreateClassroomForm";
import { getTeacherClassrooms } from "@/lib/classrooms/getTeacherClassrooms";
import type { Classroom } from "@/types/classroom";

export default function TeacherClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getTeacherClassrooms();
      setClassrooms(data ?? []);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load classrooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassrooms();
  }, []);

  const handleCreated = (newClassroom: Classroom) => {
    setClassrooms((prev) => [newClassroom, ...prev]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Teacher Classrooms</h1>
        <p className="text-slate-200 mt-1">
          Create and manage your classrooms. Share class codes with students.
        </p>
      </div>

      <CreateClassroomForm onCreated={handleCreated} />

      <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Classrooms
          </h2>

          <button
            onClick={loadClassrooms}
            className="text-sm font-medium text-gray-700 px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-100"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <p className="text-gray-700 text-sm font-medium">
            Loading classrooms...
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!loading && classrooms.length === 0 && (
          <p className="text-gray-700 text-sm">
            No classrooms yet. Create your first class above.
          </p>
        )}

        <div className="space-y-4">
          {classrooms.map((c) => (
            <div
              key={c.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-700">
                  {c.subject} • {c.term}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div>
                  <span className="text-xs font-medium text-gray-700 mr-2">
                    Class Code:
                  </span>
                  <span className="font-mono font-bold text-gray-900 bg-white border border-gray-300 px-2 py-1 rounded">
                    {c.class_code}
                  </span>
                </div>

                <Link
                  href={`/teacher/classrooms/${c.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  View Classroom
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}