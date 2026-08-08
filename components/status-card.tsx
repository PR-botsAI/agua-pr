"use client";

import { useAguaData } from "../lib/use-agua-data";

export function StatusCard() {
  const { data, offline, loadedAt } = useAguaData();
  const row = (data.Estado ?? []).find((r) => (r.municipio || "").toLowerCase() === "arecibo") ?? data.Estado?.[0];
  const confirmed = row?.confirmado?.toUpperCase() === "TRUE";
  const noWater = row?.codigo === "SIN_AGUA";

  return (
    <>
      {offline && (
        <div className="notice offline" role="status">
          <strong>Sin conexión.</strong> Se muestra la última información guardada{loadedAt ? ` (${new Date(loadedAt).toLocaleString("es-PR")})` : ""}. Puede haber cambiado.
        </div>
      )}
      <section className={`card status ${confirmed ? "confirmed" : ""} ${noWater ? "no-water" : ""}`} aria-label="Estado del servicio">
        <div className="eyebrow">Estado en tu área</div>
        <div className="status-title">{row?.titulo || "Información pendiente de confirmar"}</div>
        <p>{row?.descripcion || "No hay información verificada disponible."}</p>
        <div className="row">
          <span className={`chip ${confirmed ? "confirmed" : "pending"}`}>
            {confirmed ? "Información confirmada" : "Información pendiente de confirmar"}
          </span>
        </div>
        <div className="status-meta">
          Fuente: {row?.fuente || "Sin fuente verificada"}<br />
          Actualizado: {row?.actualizado_at ? new Date(row.actualizado_at).toLocaleString("es-PR") : "pendiente"}
        </div>
      </section>
    </>
  );
}
