export type SheetRow = Record<string, string>;

export type AguaData = {
  Municipios?: SheetRow[];
  Estado?: SheetRow[];
  PuntosAgua?: SheetRow[];
  Racionamiento?: SheetRow[];
  Pronostico?: SheetRow[];
  Embalses?: SheetRow[];
  Contactos?: SheetRow[];
  Alertas?: SheetRow[];
};

export const fallbackData: AguaData = {
  Municipios: [{ nombre: "Arecibo", activo: "TRUE" }],
  Estado: [{
    municipio: "Arecibo",
    codigo: "PENDIENTE",
    titulo: "Información pendiente de confirmar",
    descripcion: "Todavía no hay un estado oficial verificado cargado para Arecibo.",
    actualizado_at: "2026-08-08T00:48:00-04:00",
    fuente: "Agua PR bootstrap",
    confirmado: "FALSE"
  }],
  PuntosAgua: [],
  Racionamiento: [],
  Pronostico: [],
  Embalses: [],
  Contactos: [],
  Alertas: []
};
