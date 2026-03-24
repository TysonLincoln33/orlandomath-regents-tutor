"use client";

import { useEffect, useState } from "react";
import {
  readLocalProgress,
  setSectionStatus,
  clearLocalProgress,
} from "@/lib/progressLocal";

export default function ProgressDebug() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setData(readLocalProgress());
  }, []);

  return (
    <div style={{ border: "1px solid #ccc", padding: 12, marginTop: 24 }}>
      <h3>Progress Debug</h3>

      <button
        onClick={() => setData(setSectionStatus("ch1_s1", "complete"))}
      >
        Mark ch1_s1 complete
      </button>

      <button
        onClick={() => setData(setSectionStatus("ch1_s2", "in_progress"))}
        style={{ marginLeft: 8 }}
      >
        Mark ch1_s2 in progress
      </button>

      <button
        onClick={() => {
          clearLocalProgress();
          setData(readLocalProgress());
        }}
        style={{ marginLeft: 8 }}
      >
        Clear
      </button>

      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
