/** Los 7 valores reales de `Empresa.estado` — ver `ESTADOS_EMPRESA` en
 * `ListarEmpresasQueryDto` del backend, es la fuente de verdad (es
 * `varchar`, no un enum de Postgres, así que ampliarla no pide
 * migración). Los tres primeros son el flujo de alta asistida nuevo
 * (PROPUESTA_FLUJO_ALTA_ASISTIDA.md §1/§5.1/§10): `solicitud_recibida`
 * (recién llegó el registro público) → `pendiente` (el staff la mandó a
 * la cola) → `informacion_corroborada` (llamada hecha, esperando que el
 * cliente confirme desde el enlace) → `activa`. `rechazada` es aparte
 * (§5.3). `suspendida`/`cancelada` son del ciclo de vida posterior a
 * `activa`, sin relación con el alta. */
export type EstadoEmpresa =
  | 'solicitud_recibida'
  | 'pendiente'
  | 'informacion_corroborada'
  | 'activa'
  | 'rechazada'
  | 'suspendida'
  | 'cancelada';

/** Espejo de la entidad `Empresa` del backend (`empresa.entity.ts`) — solo
 * los campos que el panel de staff necesita mostrar, no re-declara toda la
 * fila si algún día suma columnas que acá no hacen falta. */
export interface Empresa {
  id: number;
  nombre: string;
  rubro: string | null;
  correoContacto: string;
  telefonoContacto: string | null;
  estado: EstadoEmpresa;
  /** Motivo de texto libre cargado por el staff al rechazar (`PATCH
   * /empresas/:id/rechazar`, `estado === 'rechazada'`) — `null` en
   * cualquier otro estado. */
  motivoRechazo: string | null;
  /** Texto que el propio visitante tipeó en el registro público
   * (`POST /empresas/registro-publico`) — NO es la cuenta real todavía,
   * es solo lo que declaró en el formulario. La cuenta real (`Usuario`
   * con login) recién existe cuando el staff termina la llamada
   * (`PATCH /empresas/:id/llamada-finalizada`) — ver `duenoUsuario` en
   * `EmpresaConDueno`, que es ese Usuario ya creado, no este texto. */
  duenoNombres: string | null;
  duenoApellidos: string | null;
  duenoCorreo: string | null;
  /** Cuándo el staff programó "Programar llamada" en el asistente de
   * activación (`PATCH /empresas/:id/programar-llamada`) — vive en
   * `GestionAlta.llamadaProgramadaPara` del backend, no en la fila de
   * Empresa, pero tanto `findAll` como `findOne` ya la traen acá (ver el
   * comentario en `EmpresaService.findAll` del backend). `null` si no hay
   * ninguna programada. Antes de que el backend la trajera,
   * `AltasPendientesPageComponent`/`ActivarEmpresaWizardComponent` la
   * llevaban solo en memoria del propio componente — se perdía al
   * recargar la página o al cerrar el asistente (bug real reportado por
   * el cliente, 2026-09-22). */
  llamadaProgramadaPara: string | null;
  /** Códigos de `Modulo` que el visitante marcó como "extra" en el
   * checkout público (Fase 2 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md,
   * §11.6) — vive en `GestionAlta.modulosSolicitados` del backend, no en
   * la fila de Empresa, pero `findOne` ya lo trae acá (mismo criterio que
   * `motivoRechazo`/`llamadaProgramadaPara` de arriba). Una SUGERENCIA,
   * todavía no un acceso real: `null` si el checkout no pidió nada extra.
   * `ActivarEmpresaWizardComponent` lo usa para pre-cargar la sección de
   * módulos del paso 1, antes de "Llamada finalizada" (§11.7). */
  modulosSolicitados: string[] | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Resumen del `Usuario` dueño real (rol `admin`) de una Empresa — lo que
 * devuelve `UsuarioService.buscarResumenDuenoDeEmpresa` del backend, sin
 * el hash de contraseña. `tieneContrasena` es justo el dato que hace
 * falta para saber si el cliente ya confirmó y definió su contraseña
 * (`/reset-password`) o todavía está esperando el enlace. */
export interface ResumenDuenoEmpresa {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  correoVerificado: boolean;
  tieneContrasena: boolean;
}

/** Lo que devuelve `GET /empresas/:id` — la Empresa más el resumen de su
 * dueño real (`null` si todavía no se creó, ver `ResumenDuenoEmpresa`).
 * `GET /empresas` (el listado) NO trae este campo — solo `findOne` del
 * backend lo resuelve, ver el comentario ahí. */
export interface EmpresaConDueno extends Empresa {
  duenoUsuario: ResumenDuenoEmpresa | null;
}

/** Misma forma que `RespuestaPaginada<T>` del backend
 * (`common/pagination.util.ts`) — se repite acá en vez de compartirse
 * porque no hay un paquete de tipos compartido entre backend y frontend
 * todavía (ninguno de los dos proyectos Angular lo tiene, ver
 * `admin/core/auth/models/current-user.model.ts`, que hace lo mismo). */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
