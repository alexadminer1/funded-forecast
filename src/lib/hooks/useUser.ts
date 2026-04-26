"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { User } from "@/lib/types";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<{ success: boolean; user: User }>("/api/user/me")
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, error };
}
