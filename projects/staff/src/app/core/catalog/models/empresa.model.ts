/** Valores de `Empresa.estado` (la fuente de verdad es `ESTADOS_EMPRESA` del backend).
 * Alta asistida: `solicitud_recibida` (llegó el registro público) →
 * `pendiente` (staff la mandó a la cola) → `informacion_corroborada`
 * (llamada hecha, falta que el cliente confirme desde el enlace) → `activa`.
 * `rechazada` corta el alta; `suspendida` y `cancelada` son posteriores a `activa`. */
export type EstadoEmpresa =
  | 'solicitud_recibida'
  | 'pendiente'
  | 'informacion_corroborada'
  | 'activa'
  | 'rechazada'
  | 'suspendida'
  | 'cancelada';

/** Empresa como la devuelve el backend, con los campos que usa el panel de staff. */
export interface Empresa {
  id: number;
  nombre: string;
  rubro: string | null;
  correoContacto: string;
  telefonoContacto: string | null;
  estado: EstadoEmpresa;
  /** Motivo que escribió staff al rechazar; `null` si no está `rechazada`. */
  motivoRechazo: string | null;
  /** Si la Empresa puede operar de verdad, cosa que `estado` no dice: una
   * `activa` con la suscripción vencida no opera. Mismo cálculo que usa el backend. */
  acceso: AccesoResumen;
  /** Por qué se suspendió, se dio de baja o se reactivó. */
  motivoEstado: string | null;
  estadoCambiadoEn: string | null;
  /** Lo que el visitante escribió en el registro público, no la cuenta real:
   * esa se crea al finalizar la llamada (ver `EmpresaConDueno.duenoUsuario`). */
  duenoNombres: string | null;
  duenoApellidos: string | null;
  duenoCorreo: string | null;
  /** Llamada de alta programada; `null` si no hay. Viene del backend para
   * que no se pierda al recargar o cerrar el asistente. */
  llamadaProgramadaPara: string | null;
  /** Códigos de módulo que el visitante marcó como extra en el checkout.
   * Es solo una sugerencia (no da acceso); el asistente de activación la
   * usa para precargar los módulos. `null` si no marcó ninguno. */
  modulosSolicitados: string[] | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Resumen del usuario dueño (rol `admin`) de una Empresa. `tieneContrasena`
 * dice si el cliente ya confirmó y definió su contraseña o sigue esperando el enlace. */
export interface ResumenDuenoEmpresa {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  correoVerificado: boolean;
  tieneContrasena: boolean;
}

/** `GET /empresas/:id`: la Empresa más su dueño (`null` si todavía no se
 * creó). El listado no trae `duenoUsuario`. */
export interface EmpresaConDueno extends Empresa {
  duenoUsuario: ResumenDuenoEmpresa | null;
}

/** Misma forma que `RespuestaPaginada<T>` del backend; se repite porque no
 * hay un paquete de tipos compartido entre backend y frontend. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}

/** Si la Empresa puede operar y, si no, por qué. */
export interface AccesoResumen {
  /** `en_mora`: venció el pago, sigue operando dentro de la gracia.
   *  `en_prueba`: período de prueba, opera hasta `pruebaHasta`. */
  estado: 'ok' | 'en_mora' | 'en_prueba' | 'bloqueada';
  motivo: 'alta_en_curso' | 'rechazada' | 'suspendida' | 'cancelada' | 'sin_plan' | 'suscripcion_vencida' | 'prueba_terminada' | null;
  suscripcionEstado: string | null;
  fechaProximoVencimiento: string | null;
  pruebaHasta?: string | null;
  /** Descuento activo sobre el plan, en %. */
  descuentoPorcentaje?: number | null;
}

/** Marca extra junto al estado de la cuenta cuando no alcanza para saber si
 *  la Empresa opera (solo para Empresas `activa`). `null` = no hace falta. */
export function marcaAcceso(e: Pick<Empresa, 'estado' | 'acceso'>): { texto: string; tono: 'critical' | 'warning' | 'neutral' | 'info' } | null {
  if (e.estado !== 'activa' || !e.acceso || e.acceso.estado === 'ok') return null;
  if (e.acceso.estado === 'en_mora') return { texto: 'En mora', tono: 'warning' };
  if (e.acceso.estado === 'en_prueba') return { texto: 'En prueba', tono: 'info' };
  if (e.acceso.motivo === 'prueba_terminada') return { texto: 'Prueba terminada', tono: 'critical' };
  if (e.acceso.motivo === 'suscripcion_vencida') return { texto: 'Vencida', tono: 'critical' };
  return { texto: 'Sin plan', tono: 'neutral' };
}
