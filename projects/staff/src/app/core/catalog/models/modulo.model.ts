/** Espejo de `DesgloseModuloEmpresa` del backend: una fila por cada módulo
 * activo del catálogo (lo tenga o no la Empresa), con de dónde sale su
 * estado. `id` es el del `Modulo` del catálogo (no del `EmpresaModulo`):
 * es el `moduloId` que piden `GestionarModuloPayload` y `quitar()`. */
export interface DesgloseModuloEmpresa {
  id: number;
  codigo: string;
  nombre: string;
  desdePlan: boolean;
  efectivo: boolean;
  override: OverrideModuloEmpresa | null;
  /** Si el módulo tiene ajustes por Empresa. */
  ajustable: boolean;
  /** Cuántos ajustes de esta Empresa se apartan de los defectos. */
  ajustesPropios: number;
}

/** Una perilla de un módulo; staff elige una de sus opciones. */
export interface CampoAjuste {
  clave: string;
  titulo: string;
  ayuda: string;
  opciones: { valor: string; texto: string }[];
}

/** Ajustes de un módulo para una Empresa (`GET /empresas/:id/modulos/:codigo/ajustes`). */
export interface AjustesModulo {
  codigo: string;
  nombre: string;
  campos: CampoAjuste[];
  defectos: Record<string, string>;
  /** Solo lo que se aparta de los defectos. */
  valores: Record<string, string>;
  efectivos: Record<string, string>;
  actualizadoEn: string | null;
  actualizadoPor: string | null;
}

export interface OverrideModuloEmpresa {
  tipo: 'concedido' | 'revocado';
  motivo: string | null;
  creadoPorId: number | null;
  creadoEn: string;
}

/** Body de `POST /empresas/:id/modulos` — espejo de
 * `GestionarEmpresaModuloDto` del backend. */
export interface GestionarModuloPayload {
  moduloId: number;
  tipo: 'concedido' | 'revocado';
  motivo?: string;
}

/** Espejo parcial de `Modulo` (`GET /modulos`). El asistente de activación
 * lo usa para ofrecer cualquier módulo como extra, no solo los pedidos en el checkout. */
export interface ModuloCatalogo {
  id: number;
  codigo: string;
  nombre: string;
}
