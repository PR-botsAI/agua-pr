"use client";

import { StatusCard } from "../../components/status-card";
import { useAguaData } from "../../lib/use-agua-data";

export default function EstadoPage() {
  const { data } = useAguaData();
  const rows = (data.Racionamiento ?? []).filter((r) => (r.municipio || "").toLowerCase() === "arecibo");

  return (
    <>
      <h1 className="section-title">Estado del servicio</h1>
      <StatusCard />
      <section className="card">
        <h2>Horario de racionamiento</h2>
        {rows.length === 0 ? (
          <div className="empty">No hay un horario de racionamiento verificado cargado para Arecibo.</div>
        ) : (
          <div className="list">{rows.map((r, i) => (
            <article className="item" key={i}>
              <h3>{r.comunidad || r.zona || "Zona"}</h3>
              <p>{r.estado || "Estado pendiente"}</p>
              <p className="muted">Fuente: {r.fuente || "pendiente"}</p>
            </article>
          ))}</div>
        )}
      </section>
    </>
  );
}
