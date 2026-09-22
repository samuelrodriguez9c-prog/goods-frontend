import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconAlertTriangle,
  IconCamera,
  IconCheck,
  IconMailCheck,
  IconShieldLock,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { ActualizarPerfilPayload, MiPerfil } from '../../../../core/usuarios/models/mi-perfil.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { etiquetaRolTexto } from '../../../usuarios/pages/usuarios-page/usuarios-page.component';

const MIME_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

/** Buffer de edición del formulario "Datos" — strings vacíos en vez de
 *  `null` (a diferencia de `MiPerfil`) porque son el modelo de un
 *  `[ngModel]` de texto, no la respuesta cruda del backend; ver
 *  `sincronizarBuffer()` para el mapeo `null` → `''` en cada dirección. */
interface DatosPerfilBuffer {
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  genero: string;
  telefono: string;
  direccionPrincipal: string;
  referenciaDireccion: string;
  aceptaMarketing: boolean;
}

/**
 * Settings del panel de staff — pedido explícito 2026-09-22: "hay que
 * agregar la opcion de settings en el sidebar como en el panel de admin,
 * y allí quiero que con base a los estilos que hay y que estamos usando
 * me des el modulo de settings completo".
 *
 * A diferencia de `admin/features/settings/` (que gestiona el equipo de
 * UNA Empresa — otras personas), acá Settings es el perfil de la PROPIA
 * cuenta: no hay nada que copiar de ahí porque esa página ni siquiera
 * tiene contenido definido todavía (placeholder reconocido en su propio
 * código) y sus únicas sub-páginas reales (Usuarios/Roles) administran a
 * otros, algo que en staff ya vive en los ítems de primer nivel del
 * sidebar. El "estilo que hay y que estamos usando" (lo que sí pidió
 * replicar) sale de `ficha-usuario-panel`/`usuarios-page` de
 * `features/usuarios/`: mismo patrón de tarjeta de datos editables,
 * mismo signal `guardando`, mismo toast de aviso/error abajo.
 *
 * Contenido acordado con el usuario (decisiones 2026-09-22, ver
 * ADMIN_DISENO.md):
 * - Perfil completo (`GET /usuarios/:id` propio, sin gating por permiso —
 *   ver `UsuarioService.obtener`) con nombres/apellidos/teléfono editables
 *   (`PATCH /usuarios/:id`, mismo endpoint que ya usaba `ficha-usuario-panel`
 *   para editar a otros).
 * - Foto de perfil: `UploadService.subir()` (POST /upload genérico) +
 *   PATCH para asociar la URL resultante a `imagenPerfil`.
 * - Aviso de correo sin verificar con reenvío + código (`AuthService`
 *   `reenviarVerificacionCorreo`/`verificarCorreoConCodigo`).
 * - Último acceso: dato que ya viaja en el perfil (`ultimoAcceso`), solo
 *   se muestra, no hace falta pedir nada aparte.
 * - Cambiar contraseña: el usuario eligió NO construir un endpoint nuevo
 *   de "cambiar con la actual" — reusa el flujo de recuperación por
 *   correo que ya existe (`AuthService.solicitarRecuperacionPassword`),
 *   mismo que la pantalla de login. El botón manda el correo a la propia
 *   cuenta; la persona lo completa fuera del panel.
 *
 * Ajuste 2026-09-22 (mismo día, segunda vuelta): el usuario pegó el JSON
 * crudo de `GET /usuarios/:id` y pidió mostrar "toda la información" —
 * de mostrar solo nombres/apellidos/teléfono se pasó al perfil completo
 * (documento, fecha de nacimiento, género, dirección, acepta marketing,
 * puntos de fidelidad, etc., todo editable vía el mismo `PATCH
 * /usuarios/:id` de siempre — `UpdateUsuarioDto` ya lo permitía, cero
 * cambios de backend). Ver `MiPerfil`/`ActualizarPerfilPayload` para el
 * detalle exacto de qué campos entran y cuáles se excluyeron a propósito
 * (coordenadas crudas, metadata interna de seguridad, etc.) y por qué.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly uploadService = inject(UploadService);

  protected readonly iconCamara = IconCamera;
  protected readonly iconCheck = IconCheck;
  protected readonly iconAviso = IconAlertTriangle;
  protected readonly iconCorreoOk = IconMailCheck;
  protected readonly iconCandado = IconShieldLock;

  protected readonly perfil = signal<MiPerfil | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly datos = signal<DatosPerfilBuffer>({
    tipoDocumento: '',
    numeroDocumento: '',
    nombres: '',
    apellidos: '',
    fechaNacimiento: '',
    genero: '',
    telefono: '',
    direccionPrincipal: '',
    referenciaDireccion: '',
    aceptaMarketing: false,
  });
  protected readonly guardandoDatos = signal(false);
  protected readonly subiendoFoto = signal(false);

  protected readonly enviandoVerificacion = signal(false);
  protected readonly mostrarCodigoVerificacion = signal(false);
  protected readonly codigoVerificacion = signal('');
  protected readonly verificandoCodigo = signal(false);

  protected readonly solicitandoPassword = signal(false);

  protected readonly iniciales = computed(() => {
    const p = this.perfil();
    if (!p) {
      return '…';
    }
    return `${p.nombres.trim().charAt(0)}${p.apellidos.trim().charAt(0)}`.toUpperCase() || '?';
  });

  protected readonly rolTexto = computed(() => {
    const p = this.perfil();
    return p ? etiquetaRolTexto(p.rol.nombre) : '';
  });

  protected readonly ultimoAccesoTexto = computed(() => {
    const p = this.perfil();
    if (!p?.ultimoAcceso) {
      return 'Todavía no hay un primer acceso registrado';
    }
    return new Date(p.ultimoAcceso).toLocaleString('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  protected readonly miembroDesdeTexto = computed(() => {
    const p = this.perfil();
    if (!p) {
      return '';
    }
    return new Date(p.creadoEn).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  protected readonly terminosAceptadosTexto = computed(() => {
    const p = this.perfil();
    if (!p?.terminosAceptadosEn) {
      return null;
    }
    return new Date(p.terminosAceptadosEn).toLocaleDateString('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  protected readonly actualizadoTexto = computed(() => {
    const p = this.perfil();
    if (!p) {
      return '';
    }
    return new Date(p.actualizadoEn).toLocaleString('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  private cargaIniciada = false;

  /** `AuthService.currentUser` NO se persiste (solo el accessToken, ver
   *  `ShellComponent.ngOnInit`): tras un F5/deep-link directo a
   *  `/settings`, el shell dispara `GET /auth/me` recién en su propio
   *  `ngOnInit`, así que leer `currentUser()?.id` una sola vez en el
   *  constructor de esta página (como se hacía al principio) corre el
   *  riesgo real de encontrarlo todavía en `null` — no es un caso de
   *  borde raro, pasa siempre que esta pantalla es la primera en cargar.
   *  Un `effect()` que reacciona cuando el signal por fin trae el id
   *  evita esa carrera sin depender de que el shell termine antes. */
  constructor() {
    effect(() => {
      const id = this.authService.currentUser()?.id;
      if (id === undefined || this.cargaIniciada) {
        return;
      }
      this.cargaIniciada = true;
      this.cargar(id);
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.usuarioService.obtener<MiPerfil>(id).subscribe({
      next: (usuario) => {
        this.perfil.set(usuario);
        this.sincronizarBuffer(usuario);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar tu perfil. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  private sincronizarBuffer(usuario: MiPerfil): void {
    this.datos.set({
      tipoDocumento: usuario.tipoDocumento ?? '',
      numeroDocumento: usuario.numeroDocumento ?? '',
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      fechaNacimiento: usuario.fechaNacimiento ?? '',
      genero: usuario.genero ?? '',
      telefono: usuario.telefono ?? '',
      direccionPrincipal: usuario.direccionPrincipal ?? '',
      referenciaDireccion: usuario.referenciaDireccion ?? '',
      aceptaMarketing: usuario.aceptaMarketing,
    });
  }

  protected actualizarDato<K extends keyof DatosPerfilBuffer>(campo: K, valor: DatosPerfilBuffer[K]): void {
    this.datos.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected guardarDatos(): void {
    const p = this.perfil();
    if (!p || this.guardandoDatos()) {
      return;
    }
    const d = this.datos();
    const payload: ActualizarPerfilPayload = {
      tipoDocumento: d.tipoDocumento || undefined,
      numeroDocumento: d.numeroDocumento || undefined,
      nombres: d.nombres,
      apellidos: d.apellidos,
      fechaNacimiento: d.fechaNacimiento || undefined,
      genero: d.genero || undefined,
      telefono: d.telefono || undefined,
      direccionPrincipal: d.direccionPrincipal || undefined,
      referenciaDireccion: d.referenciaDireccion || undefined,
      aceptaMarketing: d.aceptaMarketing,
    };
    this.guardandoDatos.set(true);
    this.usuarioService.actualizar<MiPerfil>(p.id, payload).subscribe({
      next: (actualizado) => {
        this.perfil.set(actualizado);
        this.sincronizarBuffer(actualizado);
        this.guardandoDatos.set(false);
        this.mostrarAviso('Datos guardados');
        // El bloque de usuario del topbar (nombre/iniciales) sale de
        // `AuthService.currentUser`, un snapshot aparte de `GET /auth/me`
        // — sin este refresh, cambiar el nombre acá lo dejaría
        // desactualizado ahí hasta el próximo login.
        this.authService.cargarPerfil().subscribe({ error: () => undefined });
      },
      error: () => {
        this.guardandoDatos.set(false);
        this.error.set('No se pudieron guardar los datos. Intenta de nuevo.');
      },
    });
  }

  protected onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) {
      return;
    }
    if (!MIME_TIPOS_PERMITIDOS.includes(archivo.type)) {
      this.error.set('Formato no admitido — usá JPG, PNG, WEBP o GIF.');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      this.error.set('La imagen pesa más de 5 MB — probá con una más liviana.');
      return;
    }
    const p = this.perfil();
    if (!p || this.subiendoFoto()) {
      return;
    }
    this.subiendoFoto.set(true);
    this.uploadService.subir(archivo).subscribe({
      next: ({ url }) => {
        this.usuarioService.actualizar<MiPerfil>(p.id, { imagenPerfil: url }).subscribe({
          next: (actualizado) => {
            this.perfil.set(actualizado);
            this.subiendoFoto.set(false);
            this.mostrarAviso('Foto actualizada');
            this.authService.cargarPerfil().subscribe({ error: () => undefined });
          },
          error: () => {
            this.subiendoFoto.set(false);
            this.error.set('Se subió la imagen pero no se pudo asociar a tu perfil. Intenta de nuevo.');
          },
        });
      },
      error: () => {
        this.subiendoFoto.set(false);
        this.error.set('No se pudo subir la imagen. Intenta de nuevo.');
      },
    });
  }

  protected reenviarVerificacion(): void {
    const p = this.perfil();
    if (!p || this.enviandoVerificacion()) {
      return;
    }
    this.enviandoVerificacion.set(true);
    this.authService.reenviarVerificacionCorreo(p.correo).subscribe({
      next: () => {
        this.enviandoVerificacion.set(false);
        this.mostrarCodigoVerificacion.set(true);
        this.mostrarAviso('Te enviamos un código a tu correo');
      },
      error: () => {
        this.enviandoVerificacion.set(false);
        this.error.set('No se pudo enviar el código. Intenta de nuevo.');
      },
    });
  }

  protected verificarCodigo(): void {
    const p = this.perfil();
    const codigo = this.codigoVerificacion().trim();
    if (!p || codigo.length !== 6 || this.verificandoCodigo()) {
      return;
    }
    this.verificandoCodigo.set(true);
    this.authService.verificarCorreoConCodigo(p.correo, codigo).subscribe({
      next: () => {
        this.perfil.update((actual) => (actual ? { ...actual, correoVerificado: true } : actual));
        this.verificandoCodigo.set(false);
        this.mostrarCodigoVerificacion.set(false);
        this.codigoVerificacion.set('');
        this.mostrarAviso('Correo verificado');
      },
      error: (err: unknown) => {
        this.verificandoCodigo.set(false);
        this.error.set(this.mensajeDeError(err, 'El código no es válido o venció. Pedí uno nuevo.'));
      },
    });
  }

  protected solicitarCambioPassword(): void {
    const p = this.perfil();
    if (!p || this.solicitandoPassword()) {
      return;
    }
    this.solicitandoPassword.set(true);
    this.authService.solicitarRecuperacionPassword(p.correo).subscribe({
      next: () => {
        this.solicitandoPassword.set(false);
        this.mostrarAviso('Te enviamos un correo con instrucciones para cambiar tu contraseña');
      },
      error: () => {
        this.solicitandoPassword.set(false);
        this.error.set('No se pudo enviar el correo. Intenta de nuevo.');
      },
    });
  }

  private mostrarAviso(texto: string): void {
    this.error.set(null);
    this.aviso.set(texto);
    setTimeout(() => this.aviso.set(null), 2600);
  }

  private mensajeDeError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return fallback;
  }
}
