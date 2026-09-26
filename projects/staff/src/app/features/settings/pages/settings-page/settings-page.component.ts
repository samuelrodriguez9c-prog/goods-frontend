import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IconAddressBook,
  IconArrowRight,
  IconArrowUpRight,
  IconCamera,
  IconCheck,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconClock,
  IconCopy,
  IconCrown,
  IconFileCheck,
  IconHistory,
  IconIdBadge2,
  IconKey,
  IconLock,
  IconLogin2,
  IconMail,
  IconMailExclamation,
  IconMailForward,
  IconMailOpened,
  IconPencil,
  IconSend,
  IconSettings2,
  IconShieldLock,
  IconSparkles,
  IconUser,
  IconUserPlus,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { ActualizarPerfilPayload, MiPerfil } from '../../../../core/usuarios/models/mi-perfil.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { EstadoAlerta, EstadoIconoComponent } from '../../../../shared/ui/estado-icono/estado-icono.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';

type Seccion = 'perfil' | 'contacto' | 'seguridad' | 'cuenta';

/** Buffer de edición — strings vacíos en vez de `null` porque es el modelo
 *  de `[ngModel]`; `desdePerfil()` / `aPayload()` mapean en cada dirección. */
interface DatosPerfil {
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaNacimiento: string;
  genero: string;
  telefono: string;
  direccionPrincipal: string;
  referenciaDireccion: string;
}

const CAMPOS_PERFIL: (keyof DatosPerfil)[] = [
  'nombres',
  'apellidos',
  'tipoDocumento',
  'numeroDocumento',
  'fechaNacimiento',
  'genero',
];
const CAMPOS_CONTACTO: (keyof DatosPerfil)[] = ['telefono', 'direccionPrincipal', 'referenciaDireccion'];

const TIPOS_DOCUMENTO = ['DNI', 'CE', 'Pasaporte'];
const GENEROS = ['Femenino', 'Masculino', 'Otro', 'Prefiero no decir'];
const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const LARGO_CODIGO = 6;
const ESPERA_REENVIO_CODIGO = 30;
const ESPERA_REENVIO_PASSWORD = 60;

const VACIO: DatosPerfil = {
  nombres: '',
  apellidos: '',
  tipoDocumento: '',
  numeroDocumento: '',
  fechaNacimiento: '',
  genero: '',
  telefono: '',
  direccionPrincipal: '',
  referenciaDireccion: '',
};

function desdePerfil(p: MiPerfil): DatosPerfil {
  return {
    nombres: p.nombres,
    apellidos: p.apellidos,
    tipoDocumento: p.tipoDocumento ?? '',
    numeroDocumento: p.numeroDocumento ?? '',
    fechaNacimiento: p.fechaNacimiento?.slice(0, 10) ?? '',
    genero: p.genero ?? '',
    telefono: p.telefono ?? '',
    direccionPrincipal: p.direccionPrincipal ?? '',
    referenciaDireccion: p.referenciaDireccion ?? '',
  };
}

function aPayload(d: DatosPerfil): ActualizarPerfilPayload {
  return {
    nombres: d.nombres.trim(),
    apellidos: d.apellidos.trim(),
    tipoDocumento: d.tipoDocumento || undefined,
    numeroDocumento: d.numeroDocumento.trim() || undefined,
    fechaNacimiento: d.fechaNacimiento || undefined,
    genero: d.genero || undefined,
    telefono: d.telefono.trim() || undefined,
    direccionPrincipal: d.direccionPrincipal.trim() || undefined,
    referenciaDireccion: d.referenciaDireccion.trim() || undefined,
  };
}

/** `superadmin_goods` → `Superadmin goods`. Local a propósito: el rediseño de
 *  `usuarios-page` ya no exporta `etiquetaRolTexto`. */
function etiquetaRol(nombre: string): string {
  const t = nombre.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Settings del panel de staff — rediseño 2026-09-22 ("Settings Staff -
 * Rediseño.dc.html"). Perfil de la PROPIA cuenta, mismos endpoints que la
 * versión anterior (cero cambios de backend):
 *
 * - `GET/PATCH /usuarios/:id` para leer y guardar.
 * - `POST /upload` + PATCH `imagenPerfil` para la foto.
 * - `reenviarVerificacionCorreo` / `verificarCorreoConCodigo` para el correo.
 * - `solicitarRecuperacionPassword` para la contraseña (mismo flujo del login).
 *
 * Lo que cambió respecto a la versión anterior:
 * - Cuatro secciones con subnavegación en vez de una columna larga.
 * - El guardado es por **barra de cambios** (aparece solo si hay diff contra
 *   el perfil del servidor) en vez de un botón fijo al final del formulario.
 * - El código de verificación vive en un **modal** con 6 cajas y
 *   verificación automática al completarse.
 * - Las confirmaciones salen por `AlertaService` (no más toast local).
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, EstadoIconoComponent, CabeceraModuloComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);
  private readonly upload = inject(UploadService);
  private readonly alertas = inject(AlertaService);
  private readonly route = inject(ActivatedRoute);
  /** `?seccion=` — el menú de cuenta del topbar navega acá con la sección
   *  pedida (LEEME §17, 2026-09-24). Reactivo (no `snapshot`): si ya
   *  estás en Settings y clicás "Configuración" en el menú, Angular
   *  reutiliza este componente en vez de recrearlo. */
  private readonly seccionUrl = toSignal(this.route.queryParamMap, { initialValue: null });

  protected readonly i = {
    user: IconUser,
    contacto: IconAddressBook,
    lock: IconLock,
    cuenta: IconIdBadge2,
    camara: IconCamera,
    corona: IconCrown,
    mail: IconMail,
    mailPendiente: IconMailExclamation,
    mailAbierto: IconMailOpened,
    mailForward: IconMailForward,
    verificado: IconCircleCheckFilled,
    verificadoLinea: IconCircleCheck,
    reloj: IconClock,
    flechaDer: IconArrowRight,
    flechaDiag: IconArrowUpRight,
    enviar: IconSend,
    llave: IconKey,
    historial: IconHistory,
    escudo: IconShieldLock,
    copiar: IconCopy,
    check: IconCheck,
    lapiz: IconPencil,
    chispas: IconSparkles,
    alta: IconUserPlus,
    cerrar: IconX,
    ajustes: IconSettings2,
  };
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly generos = GENEROS;
  protected readonly cajas = Array.from({ length: LARGO_CODIGO }, (_, n) => n);

  // ── Carga ─────────────────────────────────────────────────────────────
  protected readonly perfil = signal<MiPerfil | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);

  protected readonly seccion = signal<Seccion>('perfil');

  // ── Edición ───────────────────────────────────────────────────────────
  protected readonly datos = signal<DatosPerfil>({ ...VACIO });
  private readonly base = computed(() => {
    const p = this.perfil();
    return p ? desdePerfil(p) : VACIO;
  });
  private readonly cambiados = computed(() => {
    const d = this.datos();
    const b = this.base();
    return (Object.keys(d) as (keyof DatosPerfil)[]).filter((k) => d[k] !== b[k]);
  });
  protected readonly cambiosPerfil = computed(() => this.cambiados().some((k) => CAMPOS_PERFIL.includes(k)));
  protected readonly cambiosContacto = computed(() => this.cambiados().some((k) => CAMPOS_CONTACTO.includes(k)));
  protected readonly nCambios = computed(() => this.cambiados().length);
  protected readonly errNombres = computed(() => !this.datos().nombres.trim());
  protected readonly errApellidos = computed(() => !this.datos().apellidos.trim());
  protected readonly guardando = signal(false);
  protected readonly puedeGuardar = computed(
    () => this.nCambios() > 0 && !this.errNombres() && !this.errApellidos() && !this.guardando(),
  );

  // ── Foto / marketing / referido ───────────────────────────────────────
  protected readonly subiendoFoto = signal(false);
  protected readonly guardandoMarketing = signal(false);
  protected readonly copiado = signal(false);

  // ── Verificación de correo (modal) ────────────────────────────────────
  protected readonly otpAbierto = signal(false);
  protected readonly otp = signal('');
  protected readonly otpEstado = signal<'idle' | EstadoAlerta>('idle');
  protected readonly otpIntento = signal(0);
  protected readonly otpReenvio = signal(0);
  private readonly otpInput = viewChild<ElementRef<HTMLInputElement>>('otpInput');

  // ── Contraseña ────────────────────────────────────────────────────────
  protected readonly pwAbierto = signal(false);
  protected readonly pwEnviando = signal(false);
  protected readonly pwEspera = signal(0);

  private timerOtp?: ReturnType<typeof setInterval>;
  private timerPw?: ReturnType<typeof setInterval>;
  private cargaIniciada = false;

  // ── Derivados de presentación ─────────────────────────────────────────
  protected readonly iniciales = computed(() => {
    const p = this.perfil();
    return p ? `${p.nombres.trim()[0] ?? ''}${p.apellidos.trim()[0] ?? ''}`.toUpperCase() || '?' : '…';
  });
  protected readonly rolTexto = computed(() => {
    const p = this.perfil();
    return p ? etiquetaRol(p.rol.nombre) : '';
  });
  protected readonly idCredencial = computed(() => String(this.perfil()?.id ?? 0).padStart(4, '0'));
  protected readonly miembroDesde = computed(() => {
    const p = this.perfil();
    return p ? new Date(p.creadoEn).toLocaleDateString('es', { month: 'short', year: 'numeric' }) : '';
  });
  protected readonly miembroDesdeCompleto = computed(() => {
    const p = this.perfil();
    return p ? fecha(p.creadoEn) : '';
  });
  protected readonly antiguedad = computed(() => {
    const p = this.perfil();
    if (!p) {
      return '';
    }
    const desde = new Date(p.creadoEn);
    const hoy = new Date();
    const meses = (hoy.getFullYear() - desde.getFullYear()) * 12 + hoy.getMonth() - desde.getMonth();
    if (meses < 1) {
      return 'Menos de un mes';
    }
    const a = Math.floor(meses / 12);
    const m = meses % 12;
    const txtA = a ? `${a} ${a === 1 ? 'año' : 'años'}` : '';
    const txtM = m ? `${m} ${m === 1 ? 'mes' : 'meses'}` : '';
    return [txtA, txtM].filter(Boolean).join(' y ');
  });
  protected readonly ultimoAccesoCorto = computed(() => {
    const iso = this.perfil()?.ultimoAcceso;
    if (!iso) {
      return 'Sin registro';
    }
    const d = new Date(iso);
    const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? `Hoy, ${hora}` : fecha(iso);
  });
  /** Cabecera compartida (LEEME.md §14) — reemplaza el `<h1>` + raya +
   *  subtítulo del inicio de la página. Sin backend nuevo: todo sale de
   *  `perfil()`. Sin acciones: guardar sigue siendo la barra de cambios
   *  sin guardar, no un botón acá. La LEEME original traía una cuarta
   *  métrica "Puntos" (`p.puntos`) — no existe ese campo en `MiPerfil`
   *  real, así que se cae (nota de la propia LEEME: "ajustá `p.puntos`…
   *  a los nombres reales de tu componente"). Sin `serie`: no hay
   *  historial de accesos ni de antigüedad día a día.
   *
   *  Migrada a v2 (badge) por LEEME.md §16, 2026-09-24 — el badge lo pone
   *  el HTML (`rolTexto() + ' · ID ' + idCredencial()`, mismo texto que ya
   *  traía el `[total]` de v1). §16 sugiere un `serieConteo` para "Último
   *  acceso" armado con `GET /auditoria?usuarioId=yo` — pero esta pantalla
   *  no carga auditoría propia (el comentario de arriba ya lo dice: "todo
   *  sale de `perfil()`"), y su propio texto lo deja condicionado a "si
   *  esa pantalla ya lo carga". Agregar ese fetch nuevo se sale de esta
   *  migración de cabeceras; además `valor` acá es un texto ("Hoy, 14:32"),
   *  no una cifra, así que una serie tampoco tendría con qué compararse.
   *  "Correo" y "Miembro desde" siguen sin serie por lo que ya decía §16:
   *  "solo la base punteada, como en el diseño". */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const p = this.perfil();
    if (!p) {
      return [];
    }
    return [
      {
        id: 'contacto',
        etiqueta: 'Correo',
        valor: p.correoVerificado ? 'Verificado' : 'Sin verificar',
        tono: p.correoVerificado ? 'exito' : 'aviso',
        delta: p.correoVerificado ? null : 'código de 6 dígitos',
        deltaTono: 'aviso',
      },
      { id: 'seguridad', etiqueta: 'Último acceso', valor: this.ultimoAccesoCorto(), titulo: this.ultimoAccesoLargo() },
      {
        id: 'cuenta',
        etiqueta: 'Miembro desde',
        valor: this.miembroDesde(),
        delta: this.antiguedad() || null,
        deltaTono: 'apagado',
      },
    ];
  });

  /** Clic en un tile de la cabecera abre la sección del menú lateral que
   *  describe. */
  protected irA(id: string): void {
    if (id === 'contacto' || id === 'seguridad' || id === 'cuenta') {
      this.seccion.set(id);
    }
  }

  protected readonly ultimoAccesoLargo = computed(() => {
    const iso = this.perfil()?.ultimoAcceso;
    return iso ? fechaHora(iso) : 'Todavía no hay un primer acceso registrado';
  });
  protected readonly origenTexto = computed(() => {
    const o = this.perfil()?.origenRegistro;
    return o ? etiquetaRol(o) : 'Sin dato';
  });

  /** Línea de tiempo de Cuenta: solo hitos con fecha real, del más reciente al más viejo. */
  protected readonly historial = computed(() => {
    const p = this.perfil();
    if (!p) {
      return [];
    }
    const hitos = [
      p.ultimoAcceso && { titulo: 'Último acceso', cuando: fechaHora(p.ultimoAcceso), icono: IconLogin2, iso: p.ultimoAcceso },
      { titulo: 'Perfil actualizado', cuando: fechaHora(p.actualizadoEn), icono: IconPencil, iso: p.actualizadoEn },
      p.terminosAceptadosEn && { titulo: 'Términos aceptados', cuando: fecha(p.terminosAceptadosEn), icono: IconFileCheck, iso: p.terminosAceptadosEn },
      {
        titulo: p.origenRegistro ? `Cuenta creada · ${etiquetaRol(p.origenRegistro).toLowerCase()}` : 'Cuenta creada',
        cuando: fecha(p.creadoEn),
        icono: IconUserPlus,
        iso: p.creadoEn,
      },
    ].filter(Boolean) as { titulo: string; cuando: string; icono: typeof IconUser; iso: string }[];
    return hitos.sort((a, b) => b.iso.localeCompare(a.iso));
  });

  protected readonly nav = computed(() => {
    const p = this.perfil();
    return [
      { id: 'perfil' as const, label: 'Perfil', icono: IconUser, punto: this.cambiosPerfil() ? 'cambios' : null },
      {
        id: 'contacto' as const,
        label: 'Correo y contacto',
        icono: IconAddressBook,
        punto: this.cambiosContacto() ? 'cambios' : p && !p.correoVerificado ? 'pendiente' : null,
      },
      { id: 'seguridad' as const, label: 'Seguridad', icono: IconLock, punto: null },
      { id: 'cuenta' as const, label: 'Cuenta', icono: IconIdBadge2, punto: null },
    ];
  });

  protected readonly otpDigitos = computed(() => {
    const v = this.otp();
    return this.cajas.map((n) => v[n] ?? '');
  });
  protected readonly otpActiva = computed(() => {
    const e = this.otpEstado();
    return e === 'idle' || e === 'error' ? Math.min(this.otp().length, LARGO_CODIGO - 1) : -1;
  });
  protected readonly otpCompleto = computed(() => this.otp().length === LARGO_CODIGO);
  /** Alterna entre dos keyframes idénticas para que el sacudón se repita en cada error. */
  protected readonly otpSacudon = computed(() =>
    this.otpEstado() === 'error' ? `${this.otpIntento() % 2 ? 'sacudir-a' : 'sacudir-b'} 380ms ease` : 'none',
  );

  constructor() {
    // `currentUser` puede llegar después que esta página tras un F5 — ver
    // el mismo comentario en la versión anterior.
    effect(() => {
      const id = this.auth.currentUser()?.id;
      if (id === undefined || this.cargaIniciada) {
        return;
      }
      this.cargaIniciada = true;
      this.cargar(id);
    });
    effect(() => {
      const s = this.seccionUrl()?.get('seccion');
      if (s === 'perfil' || s === 'contacto' || s === 'seguridad' || s === 'cuenta') {
        this.seccion.set(s);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timerOtp);
      clearInterval(this.timerPw);
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.usuarios.obtener<MiPerfil>(id).subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.datos.set(desdePerfil(p));
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set('No se pudo cargar tu perfil. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected reintentar(): void {
    const id = this.auth.currentUser()?.id;
    if (id !== undefined) {
      this.errorCarga.set(null);
      this.cargar(id);
    }
  }

  protected ir(s: Seccion): void {
    this.seccion.set(s);
  }

  // ── Datos ─────────────────────────────────────────────────────────────

  protected actualizar<K extends keyof DatosPerfil>(campo: K, valor: DatosPerfil[K]): void {
    this.datos.update((d) => ({ ...d, [campo]: valor }));
  }

  protected alternarGenero(g: string): void {
    this.actualizar('genero', this.datos().genero === g ? '' : g);
  }

  protected descartar(): void {
    this.datos.set({ ...this.base() });
  }

  protected guardar(): void {
    const p = this.perfil();
    if (!p || !this.puedeGuardar()) {
      return;
    }
    this.guardando.set(true);
    this.alertas
      .seguir(this.usuarios.actualizar<MiPerfil>(p.id, aPayload(this.datos())), {
        titulo: 'Guardando cambios',
        exito: { titulo: 'Datos guardados' },
        error: { titulo: 'No se pudieron guardar', texto: 'Tus cambios siguen acá. Intenta de nuevo.' },
      })
      .subscribe({
        next: (actualizado) => {
          this.perfil.set(actualizado);
          this.datos.set(desdePerfil(actualizado));
          this.guardando.set(false);
          // El topbar lee `AuthService.currentUser`, un snapshot aparte.
          this.auth.cargarPerfil().subscribe({ error: () => undefined });
        },
        error: () => this.guardando.set(false),
      });
  }

  /** Salir con cambios sin guardar pide confirmación del navegador. */
  @HostListener('window:beforeunload', ['$event'])
  protected antesDeSalir(e: BeforeUnloadEvent): void {
    if (this.nCambios() > 0) {
      e.preventDefault();
    }
  }

  // ── Foto ──────────────────────────────────────────────────────────────

  protected onFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    const p = this.perfil();
    if (!archivo || !p || this.subiendoFoto()) {
      return;
    }
    if (!MIME_PERMITIDOS.includes(archivo.type)) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Formato no admitido', texto: 'Usá JPG, PNG, WEBP o GIF.' });
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'La imagen pesa más de 5 MB', texto: 'Probá con una más liviana.' });
      return;
    }
    this.subiendoFoto.set(true);
    this.upload.subir(archivo).subscribe({
      next: ({ url }) =>
        this.usuarios.actualizar<MiPerfil>(p.id, { imagenPerfil: url }).subscribe({
          next: (actualizado) => {
            this.perfil.set(actualizado);
            this.subiendoFoto.set(false);
            this.alertas.mostrar({ estado: 'success', titulo: 'Foto actualizada' });
            this.auth.cargarPerfil().subscribe({ error: () => undefined });
          },
          error: () => {
            this.subiendoFoto.set(false);
            this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo asociar la foto', texto: 'La imagen se subió pero no quedó en tu perfil.' });
          },
        }),
      error: () => {
        this.subiendoFoto.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo subir la imagen' });
      },
    });
  }

  // ── Comunicaciones (se guarda al instante) ────────────────────────────

  protected alternarMarketing(): void {
    const p = this.perfil();
    if (!p || this.guardandoMarketing()) {
      return;
    }
    const valor = !p.aceptaMarketing;
    this.perfil.set({ ...p, aceptaMarketing: valor }); // optimista
    this.guardandoMarketing.set(true);
    this.usuarios.actualizar<MiPerfil>(p.id, { aceptaMarketing: valor }).subscribe({
      next: (actualizado) => {
        this.perfil.update((x) => (x ? { ...x, aceptaMarketing: actualizado.aceptaMarketing, actualizadoEn: actualizado.actualizadoEn } : x));
        this.guardandoMarketing.set(false);
        this.alertas.mostrar({ estado: 'success', titulo: valor ? 'Vas a recibir novedades' : 'Ya no vas a recibir novedades' });
      },
      error: () => {
        this.perfil.update((x) => (x ? { ...x, aceptaMarketing: !valor } : x));
        this.guardandoMarketing.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo guardar la preferencia' });
      },
    });
  }

  // ── Referido ──────────────────────────────────────────────────────────

  protected copiarReferido(): void {
    const codigo = this.perfil()?.codigoReferido;
    if (!codigo) {
      return;
    }
    navigator.clipboard?.writeText(codigo).catch(() => undefined);
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 1600);
  }

  // ── Verificación de correo ────────────────────────────────────────────

  protected abrirOtp(): void {
    const p = this.perfil();
    if (!p) {
      return;
    }
    this.otp.set('');
    this.otpEstado.set('idle');
    this.otpAbierto.set(true);
    this.enviarCodigo(p.correo);
  }

  protected reenviarCodigo(): void {
    const p = this.perfil();
    if (p && this.otpReenvio() === 0) {
      this.otp.set('');
      this.otpEstado.set('idle');
      this.enviarCodigo(p.correo, true);
    }
  }

  private enviarCodigo(correo: string, esReenvio = false): void {
    this.arrancarCuenta('otp', ESPERA_REENVIO_CODIGO);
    this.auth.reenviarVerificacionCorreo(correo).subscribe({
      next: () => {
        if (esReenvio) {
          this.alertas.mostrar({ estado: 'success', titulo: 'Código reenviado' });
        }
        setTimeout(() => this.otpInput()?.nativeElement.focus());
      },
      error: () => {
        this.otpReenvio.set(0);
        clearInterval(this.timerOtp);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo enviar el código', texto: 'Probá reenviarlo en unos segundos.' });
      },
    });
  }

  protected onOtp(valor: string): void {
    const limpio = valor.replace(/\D/g, '').slice(0, LARGO_CODIGO);
    this.otp.set(limpio);
    if (this.otpEstado() === 'error') {
      this.otpEstado.set('idle');
    }
    if (limpio.length === LARGO_CODIGO) {
      this.verificarCodigo();
    }
  }

  protected verificarCodigo(): void {
    const p = this.perfil();
    const codigo = this.otp();
    if (!p || codigo.length !== LARGO_CODIGO || this.otpEstado() === 'cargando' || this.otpEstado() === 'success') {
      return;
    }
    this.otpEstado.set('cargando');
    this.auth.verificarCorreoConCodigo(p.correo, codigo).subscribe({
      next: () => {
        this.otpEstado.set('success');
        // Deja ver el check antes de cerrar: el movimiento es el mensaje.
        setTimeout(() => {
          this.perfil.update((x) => (x ? { ...x, correoVerificado: true } : x));
          this.otpAbierto.set(false);
          clearInterval(this.timerOtp);
          this.alertas.mostrar({ estado: 'success', titulo: 'Correo verificado' });
        }, 1300);
      },
      error: (err: unknown) => {
        this.otpIntento.update((n) => n + 1);
        this.otpEstado.set('error');
        this.otp.set('');
        this.otpMensajeError.set(this.mensajeDeError(err, 'El código no es válido o venció. Probá de nuevo.'));
        setTimeout(() => this.otpInput()?.nativeElement.focus());
      },
    });
  }

  protected readonly otpMensajeError = signal('');

  protected cerrarOtp(): void {
    if (this.otpEstado() === 'cargando') {
      return; // la verificación ya salió: cerrar no la cancela
    }
    clearInterval(this.timerOtp);
    this.otpAbierto.set(false);
  }

  protected enfocarOtp(): void {
    this.otpInput()?.nativeElement.focus();
  }

  // ── Contraseña ────────────────────────────────────────────────────────

  protected abrirPassword(): void {
    if (this.pwEspera() === 0) {
      this.pwAbierto.set(true);
    }
  }

  protected cerrarPassword(): void {
    if (!this.pwEnviando()) {
      this.pwAbierto.set(false);
    }
  }

  protected enviarPassword(): void {
    const p = this.perfil();
    if (!p || this.pwEnviando()) {
      return;
    }
    this.pwEnviando.set(true);
    this.auth.solicitarRecuperacionPassword(p.correo).subscribe({
      next: () => {
        this.pwEnviando.set(false);
        this.pwAbierto.set(false);
        this.arrancarCuenta('pw', ESPERA_REENVIO_PASSWORD);
        this.alertas.mostrar({ estado: 'success', titulo: 'Enlace enviado', texto: p.correo });
      },
      error: () => {
        this.pwEnviando.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo enviar el correo', texto: 'Intenta de nuevo.' });
      },
    });
  }

  @HostListener('document:keydown.escape')
  protected alEscape(): void {
    if (this.otpAbierto()) {
      this.cerrarOtp();
    } else if (this.pwAbierto()) {
      this.cerrarPassword();
    }
  }

  // ── Interno ───────────────────────────────────────────────────────────

  protected cuenta(seg: number): string {
    return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  }

  private arrancarCuenta(cual: 'otp' | 'pw', segundos: number): void {
    const sig = cual === 'otp' ? this.otpReenvio : this.pwEspera;
    const prev = cual === 'otp' ? this.timerOtp : this.timerPw;
    clearInterval(prev);
    sig.set(segundos);
    const t = setInterval(() => {
      sig.update((n) => Math.max(0, n - 1));
      if (sig() === 0) {
        clearInterval(t);
      }
    }, 1000);
    if (cual === 'otp') {
      this.timerOtp = t;
    } else {
      this.timerPw = t;
    }
  }

  private mensajeDeError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const m = (err.error as { message?: string | string[] } | null)?.message;
      if (m) {
        return Array.isArray(m) ? m.join(' ') : m;
      }
    }
    return fallback;
  }
}
