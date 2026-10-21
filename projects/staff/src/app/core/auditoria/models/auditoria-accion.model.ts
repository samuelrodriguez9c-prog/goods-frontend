/** Una acción de escritura (POST/PATCH/PUT/DELETE) registrada por el backend.
 * Staff ve las de todo el sistema; el resto, solo las de su Empresa. */
export interface AuditoriaAccion {
  id: number;
  /** `null` en acciones anónimas (p. ej. el registro público). Solo llega
   * el id, no el nombre de quien hizo la acción. */
  usuarioId: number | null;
  empresaId: number | null;
  metodo: string;
  ruta: string;
  entidad: string | null;
  entidadId: string | null;
  exitoso: boolean;
  statusCode: number;
  cuerpo: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  creadoEn: string;
}
