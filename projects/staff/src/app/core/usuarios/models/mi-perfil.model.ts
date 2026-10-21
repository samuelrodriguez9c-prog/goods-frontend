/**
 * El `Usuario` completo para Settings. Es aparte de `UsuarioGoods` porque en
 * el propio perfil sí interesan los datos personales que en la lista de
 * colegas sobran.
 *
 * @remarks
 * No incluye, a propósito: `latitud`/`longitud` (no hay mapa), los datos
 * de seguridad (`intentosFallidos`, `bloqueadoHasta`…), los de cuentas
 * desactivadas, `empresaId`/`rolId` (siempre `null` / igual a `rol.id`),
 * `preferenciasNotificaciones` (sin uso todavía) ni `referidoPorId`
 * (un id sin nombre no dice nada).
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
  /** Si la cuenta tiene el acceso especial de superadmin, use o no en esta
   *  sesión (eso lo dice `CurrentUser.esSesionCrossPanelStaff`). */
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

/** Body de `PATCH /usuarios/:id` para el propio perfil: más campos que
 * `ActualizarUsuarioGoodsPayload`, que es para editar a un colega. */
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
