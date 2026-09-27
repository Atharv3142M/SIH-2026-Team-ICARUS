import { useCallback, useEffect, useState } from "react";
import { fetchJson, type Job } from "../api";

export function useProjects() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<Job[]>("/jobs");
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  return { jobs, error, refresh };
}

export function useProject(id: string | undefined) {
  const [job, setJob] = useState<Job | null>(null);
  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setJob(await fetchJson<Job>(`/jobs/${id}`));
    } catch {
      setJob(null);
    }
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { job, refresh };
}
