"use client";

import { useAguaData } from "../../lib/use-agua-data";

export default function ClimaPage() {
  const { data } = useAguaData();
  const forecast = (data.Pronostico ?? []).filter((r) => (r.municipio || "").toLowerCase() === "arecibo");
  const reservoirs = data.Embalses ?? [];

  return (
    <>
      <h1 className="section-title">Clima y embalses</h1>
      <section className="card">
        <h2>¿Va a llover en Arecibo?</h2>
        {forecast.length === 0 ? (
          <div className="empty">No hay un pronóstico oficial cargado en la fuente de Agua PR todavía.</div>
        ) : (
          <div className="list">{forecast.slice(0, 7).map((f, i) => (
            <article className="item" key={i}>
              <h3>{f.fecha}</h3>
              <p><strong>{f.probabilidad_lluvia || "—"}%</strong> de lluvia</p>
              <p>{f.descripcion}</p>
              <p className="muted">Fuente: {f.fuente}</p>
            </article>
          ))}</div>
        )}
        <p className="muted">La probabilidad de lluvia no indica cuánto tiempo lloverá ni cuánta agua caerá.</p>
      </section>

      <section className="card" id="embalses">
        <h2>Nivel de embalses</h2>
        {reservoirs.length === 0 ? (
          <div className="empty">No hay lecturas de embalses verificadas cargadas todavía.</div>
        ) : (
          <div className="list">{reservoirs.map((r, i) => (
            <article className="item" key={i}>
              <h3>{r.nombre}</h3>
              <p><strong>Estado:</strong> {r.estado || "pendiente"}</p>
              <p><strong>Nivel:</strong> {r.porcentaje_capacidad ? `${r.porcentaje_capacidad}%` : "pendiente"}</p>
              <p className="muted">Fuente: {r.fuente || "pendiente"}</p>
            </article>
          ))}</div>
        )}
      </section>
    </>
  );
}
