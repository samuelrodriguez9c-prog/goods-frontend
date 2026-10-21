/**
 * El propio perfil de la cuenta logueada (`GET /usuarios/:id`), para Settings.
 *
 * @remarks
 * Deja afuera campos de la entidad que no sirven en esta pantalla:
 * coordenadas, datos internos de seguridad (intentos fallidos, bloqueo),
 * datos de cuentas desactivadas, `empresaId`/`rolId` (están en `CurrentUser`
 * y en `rol.id`), preferencias de notificación sin uso y `referidoPorId`.
 */
export interface MiPerfil {
  id: number;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  genero: string | null;
  correo: string;
  correoVerificado: boolean;
  telefono: string | null;
  /** Solo se muestra: el backend no tiene verificación de teléfono. */
  telefonoVerificado: boolean;
  direccionPrincipal: string | null;
  referenciaDireccion: string | null;
  imagenPerfil: string | null;
  rol: { id: number; nombre: string };
  /** Si la cuenta tiene acceso especial al panel de staff. */
  accesoStaffGoods: boolean;
  activo: boolean;
  aceptaMarketing: boolean;
  terminosAceptadosEn: string | null;
  origenRegistro: string | null;
  codigoReferido: string | null;
  puntosFidelidad: number;
  ultimoAcceso: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Body de `PATCH /usuarios/:id` para el propio perfil. */
export interface ActualizarPerfilPayload {
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  genero?: string;
  telefono?: string;
  direccionPrincipal?: string;
  referenciaDireccion?: string;
  imagenPerfil?: string;
  aceptaMarketing?: boolean;
}
