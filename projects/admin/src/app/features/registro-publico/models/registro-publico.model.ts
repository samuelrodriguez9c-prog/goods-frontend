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
