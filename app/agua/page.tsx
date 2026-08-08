"use client";

import { useState } from "react";
import { useAguaData } from "../../lib/use-agua-data";

export default function AguaPage() {
  const { data } = useAguaData();
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const points = (data.PuntosAgua ?? []).filter((r) => (r.municipio || "").toLowerCase() === "arecibo");

  return (
    <>
      <h1 className="section-title">Puntos de agua cercanos</h1>
      <section className="card">
        <div className="row" aria-label="Cambiar vista">
          <button type="button" className="big-link" onClick={() => setView("lista")} aria-pressed={view === "lista"}>Lista</button>
          <button type="button" className="big-link" onClick={() => setView("mapa")} aria-pressed={view === "mapa"}>Mapa</button>
        </div>
      </section>

      {view === "mapa" ? (
        <section className="card">
          <h2>Mapa</h2>
          <div className="empty">El mapa se carga solo cuando usted lo solicita. En este MVP no se cargan mosaicos hasta tener puntos verificados.</div>
        </section>
      ) : (
        <section className="card">
          {points.length === 0 ? (
            <div className="empty">
              <strong>No hay puntos de distribución verificados cargados todavía.</strong>
              <p>Verifique fuentes oficiales antes de trasladarse. No publicamos lugares sin confirmar.</p>
            </div>
          ) : (
            <div className="list">{points.map((p, i) => (
              <article className="item" key={i}>
                <h3>{p.nombre}</h3>
                <p>{p.direccion}</p>
                <p><strong>Estado:</strong> {p.estado || "NO_VERIFICADO"}</p>
                {p.horario && <p>{p.horario}</p>}
                <p className="muted">Fuente: {p.fuente || "pendiente"}</p>
              </article>
            ))}</div>
          )}
        </section>
      )}
    </>
  );
}
