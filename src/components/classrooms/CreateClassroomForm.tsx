"use client";

import { useState } from "react";
import { createClassroom } from "@/lib/classrooms/createClassroom2";

type Props = {
  onCreated?: (classroom: any) => void;
};

export default function CreateClassroomForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Algebra 1");
  const [term, setTerm] = useState("2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Classroom name is required");
      return;
    }

    setLoading(true);
    setError(null);
    setCreatedCode(null);

    try {
      const classroom = await createClassroom({
        name,
        subject,
        term,
      });

      setCreatedCode(classroom.code);
      setName("");

      if (onCreated) {
        onCreated(classroom);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create classroom");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-lg font-semibold mb-4 text-gray-900">
        Create Classroom
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-800">
            Classroom Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Algebra 1 Period 3"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-800">
            Subject
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option>Algebra 1</option>
            <option>Algebra 2</option>
            <option>Geometry</option>
            <option>Statistics</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-800">
            Term
          </label>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="2025"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {createdCode && (
          <div className="bg-green-50 border border-green-300 text-green-800 p-3 rounded-lg text-sm">
            Classroom created. Code:{" "}
            <span className="font-mono font-bold text-green-900">
              {createdCode}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Classroom"}
        </button>
      </form>
    </div>
  );
}