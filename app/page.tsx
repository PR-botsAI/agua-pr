"use client";

import Link from "next/link";
import { StatusCard } from "../components/status-card";
import { useAguaData } from "../lib/use-agua-data";

export default function HomePage() {
  const { data } = useAguaData();
  const alerts = data.Alertas ?? [];

  return (
    <>
      <section className="card">
        <label className="label" htmlFor="municipio">¿Dónde estás?</label>
        <select id="municipio" className="select" defaultValue="Arecibo">
          <option>Arecibo</option>
        </select>
        <button className="secondary-button" type="button" onClick={() => navigator.geolocation?.getCurrentPosition(() => {}, () => {})}>
          Usar mi ubicación
        </button>
      </section>

      {alerts.length > 0 && (
        <section className="notice" aria-labelledby="alertas-titulo">
          <strong id="alertas-titulo">Alertas</strong>
          {alerts.slice(0, 3).map((a, i) => <p key={i}>{a.titulo || a.mensaje}</p>)}
        </section>
      )}

      <StatusCard />

      <section className="actions" aria-label="Acciones principales">
        <Link className="action-link" href="/estado/"><span>¿CUÁNDO TENDRÉ AGUA?</span><span>›</span></Link>
        <Link className="action-link" href="/agua/"><span>ENCUENTRA AGUA</span><span>›</span></Link>
        <Link className="action-link" href="/clima/"><span>¿VA A LLOVER?</span><span>›</span></Link>
        <Link className="action-link" href="/clima/#embalses"><span>NIVEL DE EMBALSES</span><span>›</span></Link>
        <Link className="action-link" href="/ayuda/"><span>NECESITO AYUDA</span><span>›</span></Link>
      </section>

      <p className="footer-note">Español | English (próximamente)<br />Agua PR — piloto Arecibo. Verifique información crítica con fuentes oficiales.</p>
    </>
  );
}
