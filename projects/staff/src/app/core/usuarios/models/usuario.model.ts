/** Espejo (parcial) de la entidad `Usuario` del backend — solo los
 * campos que el panel de staff necesita para gestionar a su propio
 * personal (ver `UsuarioService.filtroTenantUsuarios` del backend: acá
 * siempre `empresaId === null`). No repite columnas de e-commerce que no
 * aplican al personal de Goods (dirección, puntos de fidelidad,
 * referidos, etc.).
 *
 * `imagenPerfil`/`correoVerificado` se sumaron para `features/settings/`
 * (pedido 2026-09-22, "el módulo de settings completo" con foto de
 * perfil y aviso de correo sin verificar) — siguen sin ser columnas de
 * e-commerce, son identidad de la propia cuenta, por eso entran acá y no
 * ameritan un modelo aparte solo para Settings. */
export interface UsuarioGoods {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  /** Ver `AuthController.sendVerification`/`verifyEmail` — el backend
   *  nunca revela si un correo distinto está o no verificado, pero el
   *  propio (acá) sí lo trae de una en `GET /usuarios/:id`. */
  correoVerificado: boolean;
  telefono: string | null;
  imagenPerfil: string | null;
  rolId: number;
  /** Cargada `eager: true` en el backend (`Usuario.rol`), siempre viene. */
  rol: { id: number; nombre: string };
  activo: boolean;
  creadoEn: string;
  /** `null` hasta el primer login real desde el fix de
   * `AuthService.registrarAccesoExitoso` (ver ADMIN_DISENO.md) — antes de
   * eso la columna existía en el backend pero nadie la escribía. Se
   * combina con la reconstrucción vía auditoría en vez de reemplazarla
   * (ver `ultimoMsEfectivo` en `usuarios-page.component.ts`), para no
   * perder el historial de accesos que ya estaba auditado antes del fix. */
  ultimoAcceso: string | null;
}

/** Espejo de `RespuestaPaginada<T>` — repetido a propósito, ver el mismo
 * comentario en `core/catalog/models/empresa.model.ts`. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
