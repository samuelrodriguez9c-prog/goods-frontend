/** Espejo del `Usuario` completo del backend, para `features/settings/`
 * (pedido 2026-09-22: "hay que ajustar para mostrar toda la
 * información" — el usuario pegó el JSON crudo de `GET /usuarios/:id`
 * como referencia de qué quería ver).
 *
 * Deliberadamente un modelo APARTE de `UsuarioGoods` (no se extendió ese
 * — ver su propio docstring: "No repite columnas de e-commerce que no
 * aplican al personal de Goods"). Esa exclusión era correcta para la
 * pantalla "Usuarios" (gestionar a OTROS colegas, donde dirección/
 * puntos de fidelidad/referidos no pintan nada) — pero acá es el propio
 * perfil de la cuenta logueada, y esos mismos campos sí son "su
 * información", aunque sea personal de Goods. De ahí el modelo
 * separado en vez de bolsear todo en `UsuarioGoods`.
 *
 * Deliberadamente NO incluye (aun siendo parte de la entidad real):
 * - `latitud`/`longitud`: coordenadas crudas sin mapa no son información
 *   legible, y no hay ningún flujo en Settings que las use (no hay
 *   selector de ubicación en un mapa, solo el texto de dirección).
 * - `tokenRecuperacionExpira`, `intentosFallidos`, `bloqueadoHasta`: son
 *   metadata interna de seguridad anti-fuerza-bruta/recuperación de
 *   contraseña, no "información del perfil" en el sentido que pidió el
 *   usuario — y encima siempre están vacíos/irrelevantes para una
 *   sesión que sí pudo loguearse (si `bloqueadoHasta` estuviera activo,
 *   la propia sesión actual no existiría).
 * - `eliminadoEn`/`motivoDesactivacion`: solo tienen sentido para una
 *   cuenta desactivada, y una cuenta desactivada no puede tener una
 *   sesión activa viendo su propio Settings.
 * - `empresaId`/`rolId`: `empresaId` siempre es `null` para staff (ver
 *   `CurrentUser` en `core/auth/`); `rolId` es redundante con `rol.id`.
 * - `preferenciasNotificaciones`: columna sin lógica de negocio todavía
 *   (ver el propio comentario de `Usuario` en el backend — "ninguna
 *   tiene todavía la lógica de negocio que las use").
 * - `referidoPorId`: un id crudo sin el nombre de quién refirió no dice
 *   nada útil, y resolverlo a un nombre real es una feature de
 *   referidos que todavía no existe. */
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
  /** Sin flujo de verificación propio todavía (a diferencia del correo,
   *  el backend no tiene un `POST /auth/send-verification` equivalente
   *  para teléfono) — Settings solo lo MUESTRA, no ofrece reenviar nada. */
  telefonoVerificado: boolean;
  direccionPrincipal: string | null;
  referenciaDireccion: string | null;
  imagenPerfil: string | null;
  rol: { id: number; nombre: string };
  /** Ver `TopbarComponent.esCrossPanelStaff` — esa es la sesión actual
   *  ("¿estoy usando el acceso especial AHORA?"); esto es la cuenta en
   *  sí ("¿esta cuenta TIENE ese acceso especial?"), un dato distinto
   *  que sí pertenece al perfil. */
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

/** Body de `PATCH /usuarios/:id` para el propio perfil — a diferencia de
 * `ActualizarUsuarioGoodsPayload` (acotado a lo que tiene sentido editar
 * de UN COLEGA desde la pantalla "Usuarios"), acá entra todo lo que
 * `UpdateUsuarioDto` permite tocar de la propia cuenta. Mismo criterio
 * que `MiPerfil` sobre qué NO se pidió mostrar/editar (dirección
 * geográfica cruda, metadata de seguridad, etc.) — ver ese docstring. */
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
