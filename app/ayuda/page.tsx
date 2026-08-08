"use client";

import { useAguaData } from "../../lib/use-agua-data";

export default function AyudaPage() {
  const { data } = useAguaData();
  const contacts = (data.Contactos ?? []).filter((r) => (r.municipio || "").toLowerCase() === "arecibo");

  return (
    <>
      <h1 className="section-title">Necesito ayuda</h1>
      <section className="card">
        <h2>Teléfonos importantes</h2>
        {contacts.length === 0 ? (
          <div className="empty">
            <strong>Teléfonos pendientes de verificación oficial.</strong>
            <p>No publicamos números copiados de fuentes antiguas o sin confirmar.</p>
          </div>
        ) : (
          <div className="list">{contacts.map((c, i) => (
            <article className="item" key={i}>
              <h3>{c.organizacion}</h3>
              {c.telefono ? <a className="big-link" href={`tel:${c.telefono}`}>Llamar: {c.telefono}</a> : <p>Teléfono pendiente de verificación oficial.</p>}
              <p className="muted">Fuente: {c.fuente || "pendiente"}</p>
            </article>
          ))}</div>
        )}
      </section>

      <section className="notice">
        <strong>Información incorrecta</strong>
        <p>El módulo de reportes comunitarios entra en la siguiente iteración. Todo reporte deberá identificarse como no confirmado hasta revisión.</p>
      </section>
    </>
  );
}
