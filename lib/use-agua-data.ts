"use client";

import { useEffect, useMemo, useState } from "react";
import { AguaData, fallbackData } from "./types";

const CACHE_KEY = "agua-pr:last-data";
const CACHE_TIME_KEY = "agua-pr:last-data-at";

export function useAguaData() {
  const [data, setData] = useState<AguaData>(fallbackData);
  const [offline, setOffline] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const cached = localStorage.getItem(CACHE_KEY);
    const cachedAt = localStorage.getItem(CACHE_TIME_KEY);
    if (cached) {
      try {
        setData(JSON.parse(cached) as AguaData);
        setLoadedAt(cachedAt);
      } catch {}
    }

    const url = process.env.NEXT_PUBLIC_AGUA_PR_DATA_URL;
    if (url && navigator.onLine) {
      fetch(url, { headers: { "Accept": "application/json" } })
        .then((r) => {
          if (!r.ok) throw new Error("No se pudo cargar la fuente");
          return r.json();
        })
        .then((payload) => {
          const normalized = normalizePayload(payload);
          setData(normalized);
          const now = new Date().toISOString();
          setLoadedAt(now);
          localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
          localStorage.setItem(CACHE_TIME_KEY, now);
        })
        .catch(() => setOffline(true));
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return useMemo(() => ({ data, offline, loadedAt }), [data, offline, loadedAt]);
}

function normalizePayload(payload: unknown): AguaData {
  if (!payload || typeof payload !== "object") return fallbackData;
  const p = payload as Record<string, unknown>;
  const candidate = (p.data ?? p.sheets ?? p) as Record<string, unknown>;
  const result: AguaData = {};
  for (const key of ["Municipios", "Estado", "PuntosAgua", "Racionamiento", "Pronostico", "Embalses", "Contactos", "Alertas"] as const) {
    const value = candidate[key];
    if (Array.isArray(value)) result[key] = value as Record<string, string>[];
  }
  return Object.keys(result).length ? result : fallbackData;
}
