"use client";

import React, { useState } from "react";
import { createClassroom } from "@/lib/classrooms/createClassroom2";

export default function CreateClassroomForm() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");
    setCreatedCode("");

    try {
      const classroom = await createClassroom({
        name,
        subject,
        term,
      });

      setSuccess("Classroom created successfully.");
      setCreatedCode(classroom.class_code);

      setName("");
      setSubject("");
      setTerm("");
    } catch (err: any) {
      setError(err?.message || "Failed to create classroom.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Create a Classroom
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Generate a class code for students to join.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Classroom name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Algebra 1 - Period 2"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Algebra 1"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Term
        </label>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Spring 2026"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <div>{success}</div>
          {createdCode && (
            <div className="mt-2 font-semibold">
              Class code:{" "}
              <span className="tracking-widest">{createdCode}</span>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create classroom"}
      </button>
    </form>
  );
}