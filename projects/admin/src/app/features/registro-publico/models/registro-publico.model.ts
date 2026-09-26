/** Body de `POST /empresas/registro-publico` — espejo exacto de
 * `RegistroPublicoEmpresaDto` del backend (paso 1 del flujo de alta
 * asistida, PIVOTE_SAAS_MULTITENANT.md §5). */
export interface RegistroPublicoEmpresaPayload {
  nombre: string;
  rubro?: string;
  correoContacto: string;
  telefonoContacto?: string;
  duenoNombres: string;
  duenoApellidos: string;
  duenoCorreo: string;
  planId: number;
  /** Códigos de módulo marcados como "extra" (§11.6 de
   * PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md) — los que el plan elegido NO
   * trae de por sí. Sugerencia, no confirmación: staff la corrobora en el
   * asistente de activación antes de que se vuelva un acceso real. */
  modulosSolicitados?: string[];
}

/** Respuesta de `POST /empresas/registro-publico` — la `Empresa` recién
 * creada, ya en estado `'pendiente'` (ver `EmpresaService.registrarPublico`).
 * Solo se listan los campos que esta pantalla necesita para la pantalla de
 * confirmación, no toda la fila. */
export interface EmpresaRegistrada {
  id: number;
  nombre: string;
  estado: string;
}
