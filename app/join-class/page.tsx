"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { joinClassroomByCode, type JoinedClassroomResult } from "@/lib/classrooms/joinClassroomByCode";

export default function JoinClassPage() {
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedClassroom, setJoinedClassroom] = useState<JoinedClassroomResult | null>(null);

  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setCode(codeFromUrl.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setJoinedClassroom(null);

    try {
      const result = await joinClassroomByCode(code);
      setJoinedClassroom(result);
      setCode(result.class_code);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to join classroom.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Join a Classroom</h1>
        <p className="mt-1 text-slate-200">
          Enter your classroom code to join your teacher&apos;s class.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Enter Class Code</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-800">
              Class Code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={12}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {joinedClassroom && (
            <div className="bg-green-50 border border-green-300 text-green-800 p-4 rounded-lg text-sm space-y-1">
              <p className="font-semibold">Success — you joined the classroom.</p>
              <p>
                <span className="font-semibold text-green-900">{joinedClassroom.name}</span>
                {" • "}
                {joinedClassroom.subject}
                {" • "}
                {joinedClassroom.term}
              </p>
              <p>
                Code:{" "}
                <span className="font-mono font-bold text-green-900">
                  {joinedClassroom.class_code}
                </span>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join Classroom"}
          </button>
        </form>
      </div>
    </div>
  );
}