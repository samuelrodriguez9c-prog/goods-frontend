import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconExclamationCircleFilled,
  IconInfoCircle,
  IconLoader2,
  IconPlus,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { ModuloPublico, PlanPublico } from '../../models/plan-publico.model';
import { RegistroPublicoService } from '../../services/registro-publico.service';

// Ícono propio por plan, sobre el nombre en la tarjeta (pedido 2026-09-14,
// capturas "ChatGPT Image" de Samuel) — mapeado por nombre porque `Plan`
// no tiene un campo de ícono en el backend (agregar uno ahí sería más
// trabajo que necesario para dos archivos estáticos). Un plan nuevo que
// el staff cree sin entrada acá simplemente no muestra ícono (ver
// `iconoDelPlan`), no rompe nada.
const ICONOS_POR_PLAN: Record<string, string> = {
  Base: '/plan-icons/base.png',
  Plus: '/plan-icons/plus.png',
};

// Precios en pesos colombianos (COP) — mercado decidido en
// PIVOTE_SAAS_MULTITENANT.md §7.3. Sin decimales y con "." de miles
// (convención local: "$100.000"), a diferencia de `formatMoney` de
// `shared-ui` (USD, "$100.00") que usa el resto del admin — por eso no
// se reusa acá. El coerce string→number de lo que manda TypeORM para
// `precio_mensual` (`decimal`) ya lo hace `RegistroPublicoService` una
// sola vez al recibir la respuesta — acá ya llega un number de verdad.
function formatCop(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Atajos de un toque para el campo "Rubro" (rediseño 2026-09-26) — solo
 * rellenan el input, que sigue siendo texto libre: el backend no tiene un
 * catálogo de rubros, es un `string` opcional sin validación extra. */
const RUBROS_SUGERIDOS = ['Restaurante', 'Tienda de ropa', 'Minimarket', 'Cafetería', 'Belleza'];

type PasoRegistro = 'plan' | 'formulario' | 'confirmacion';

interface CamposFormulario {
  nombre: string;
  rubro: string;
  correoContacto: string;
  telefonoContacto: string;
  duenoNombres: string;
  duenoApellidos: string;
  duenoCorreo: string;
}

const FORMULARIO_VACIO: CamposFormulario = {
  nombre: '',
  rubro: '',
  correoContacto: '',
  telefonoContacto: '',
  duenoNombres: '',
  duenoApellidos: '',
  duenoCorreo: '',
};

/**
 * Página pública de registro/checkout (PIVOTE_SAAS_MULTITENANT.md §5,
 * paso 1 del flujo de alta asistida) — ruta pública dentro de `admin`
 * (`/registro`, ver `app.routes.ts`), fuera del `ShellComponent`/
 * `authGuard`, mismo criterio que `/login`: sin sidebar/topbar, ocupa
 * toda la pantalla.
 *
 * Flujo en pasos (signal `paso` + inputs nativos con signals a mano, sin
 * Angular Forms, mismo patrón que `LoginComponent`), rediseñado
 * 2026-09-26 para integrar los módulos extra (§11.6 de
 * PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md) en vez de sumarlos al final del
 * formulario:
 * 1. `plan` — tarjetas seleccionables (no navegan solas) con los módulos
 *    que trae cada plan; al elegir uno se despliega debajo la selección de
 *    módulos extra, y una barra fija resume la elección antes de seguir.
 * 2. `formulario` — datos del negocio y de la persona dueña, con un
 *    resumen lateral del plan + extras que se puede editar sin volver.
 *    Por defecto el correo de contacto del negocio ES el de la persona
 *    dueña (el caso común); se puede separar con un interruptor.
 * 3. `confirmacion` — el registro queda `solicitud_recibida`
 *    (`POST /empresas/registro-publico`); NO crea sesión ni loguea a
 *    nadie, así que la pantalla explica los próximos pasos reales del alta
 *    asistida en vez de redirigir a `/login`.
 *
 * Ambos endpoints de lectura y el de registro son públicos (sin token).
 */
@Component({
  selector: 'app-registro-publico-page',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registro-publico-page.component.html',
})
export class RegistroPublicoPageComponent implements OnInit {
  private readonly registroPublicoService = inject(RegistroPublicoService);
  private readonly router = inject(Router);

  protected readonly iconBack = IconArrowLeft;
  protected readonly iconNext = IconArrowRight;
  protected readonly iconCheck = IconCheck;
  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconInfo = IconInfoCircle;
  protected readonly iconLoader = IconLoader2;
  protected readonly iconPlus = IconPlus;
  protected readonly iconQuitar = IconX;
  protected readonly formatCop = formatCop;
  protected readonly rubrosSugeridos = RUBROS_SUGERIDOS;

  protected readonly paso = signal<PasoRegistro>('plan');

  /** Pasos del indicador de arriba — el índice del activo mueve la barra
   * de progreso (`progresoPasos`) con una transición de ancho. */
  protected readonly pasos: { id: PasoRegistro; etiqueta: string }[] = [
    { id: 'plan', etiqueta: 'Plan' },
    { id: 'formulario', etiqueta: 'Tu negocio' },
    { id: 'confirmacion', etiqueta: 'Listo' },
  ];
  protected readonly indicePaso = computed(() => this.pasos.findIndex((p) => p.id === this.paso()));
  protected readonly progresoPasos = computed(
    () => (this.indicePaso() / (this.pasos.length - 1)) * 100,
  );

  // Paso 1: catálogo de planes.
  protected readonly planes = signal<PlanPublico[]>([]);
  protected readonly cargandoPlanes = signal(true);
  protected readonly errorPlanes = signal<string | null>(null);
  protected readonly planSeleccionado = signal<PlanPublico | null>(null);

  // El plan más barato es el "de entrada" — el resto se describe como
  // "Todo lo de <ese>, más:" en vez de repetir sus características (ver
  // el mismo patrón en la página de precios de Claude: "Todo lo de Free
  // y:"). Con solo Base/Plus hoy, es simplemente Base — pero esto
  // funciona igual si mañana se suma un tercer plan intermedio.
  protected readonly planDeEntrada = computed<PlanPublico | null>(() => {
    const lista = this.planes();
    if (lista.length === 0) {
      return null;
    }
    return lista.reduce((masBarato, plan) =>
      (plan.precioMensual ?? Infinity) < (masBarato.precioMensual ?? Infinity) ? plan : masBarato,
    );
  });

  // Módulos extra (Fase 2 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md,
  // §11.6) — códigos que el visitante marcó como "extra", entre los que
  // el plan elegido NO trae de por sí (ver `modulosExtraDisponibles`).
  // Sugerencia, no confirmación: staff la corrobora en el asistente de
  // activación (§11.7) antes de que se vuelva un acceso real.
  protected readonly modulosExtraSeleccionados = signal<Set<string>>(new Set());

  /** Catálogo REAL de módulos activos (`GET /modulos/publico`, §11.6) —
   * no la unión de `plan.modulos` de todos los planes: ese enfoque no
   * puede ofrecer un módulo que no esté en ningún plan todavía (el caso
   * real de `discounts`/`messages`), que es justo lo que hace falta acá. */
  protected readonly catalogoModulos = signal<ModuloPublico[]>([]);

  /** Los módulos que el plan elegido NO trae — se ofrecen como "extra, a
   * confirmar con nuestro equipo" (→ `modulosSolicitados`). */
  protected readonly modulosExtraDisponibles = computed(() => {
    const plan = this.planSeleccionado();
    if (!plan) {
      return [];
    }
    const codigosDelPlan = new Set(plan.modulos.map((m) => m.codigo));
    return this.catalogoModulos().filter((m) => !codigosDelPlan.has(m.codigo));
  });

  /** Los extras marcados, en el orden del catálogo (el `Set` guarda el
   * orden de clic) — para los chips del resumen lateral y la confirmación. */
  protected readonly modulosExtraElegidos = computed(() => {
    const seleccion = this.modulosExtraSeleccionados();
    return this.modulosExtraDisponibles().filter((m) => seleccion.has(m.codigo));
  });

  // Paso 2: formulario.
  protected readonly campos = signal<CamposFormulario>({ ...FORMULARIO_VACIO });
  protected readonly camposInvalidos = signal<Partial<Record<keyof CamposFormulario, boolean>>>({});
  /** `false` (por defecto) = el correo de contacto del negocio es el mismo
   * de la persona dueña, y el campo aparte ni se muestra. El DTO del
   * backend sigue recibiendo los dos correos igual (`correoContacto` y
   * `duenoCorreo`), ver `correoContactoEfectivo`. */
  protected readonly usarOtroCorreoContacto = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);
  /** Alterna entre `anim-sacudir-a`/`-b` en cada envío inválido — mismo
   * truco que `otpSacudon` de Settings en `staff`: reasignar la misma
   * animación no la vuelve a disparar. `null` = sin sacudida. */
  protected readonly sacudida = signal<'a' | 'b' | null>(null);

  private readonly correoContactoEfectivo = computed(() => {
    const c = this.campos();
    return (this.usarOtroCorreoContacto() ? c.correoContacto : c.duenoCorreo).trim();
  });

  /** Obligatorios completos, para el contador sobre el botón de envío —
   * da una señal de avance sin tener que validar campo por campo en vivo. */
  protected readonly obligatorios = computed(() => {
    const c = this.campos();
    const checks = [
      c.nombre.trim().length > 0,
      c.duenoNombres.trim().length > 0,
      c.duenoApellidos.trim().length > 0,
      EMAIL_RE.test(c.duenoCorreo.trim()),
    ];
    if (this.usarOtroCorreoContacto()) {
      checks.push(EMAIL_RE.test(c.correoContacto.trim()));
    }
    return { completos: checks.filter(Boolean).length, total: checks.length };
  });

  // Paso 3: confirmación.
  protected readonly nombreEmpresaRegistrada = signal('');
  protected readonly correoConfirmacion = signal('');

  ngOnInit(): void {
    this.cargarPlanes();
    this.cargarCatalogoModulos();
  }

  protected cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.errorPlanes.set(null);
    this.registroPublicoService.listarPlanes().subscribe({
      next: (respuesta) => {
        this.planes.set(respuesta.data);
        this.cargandoPlanes.set(false);
      },
      error: (err: unknown) => {
        this.cargandoPlanes.set(false);
        this.errorPlanes.set(this.mensajeDeError(err, 'No se pudo cargar el catálogo de planes.'));
      },
    });
  }

  /** Independiente de `cargarPlanes()` a propósito: si `GET
   * /modulos/publico` fallara, la selección de plan (lo único
   * obligatorio del paso 1) sigue funcionando igual — la sección de
   * "módulos extra" simplemente no aparece. */
  private cargarCatalogoModulos(): void {
    this.registroPublicoService.listarCatalogoModulos().subscribe({
      next: (catalogo) => this.catalogoModulos.set(catalogo),
      error: () => undefined,
    });
  }

  /** Solo selecciona — ya no navega al formulario (antes el botón de cada
   * tarjeta saltaba directo): así el visitante ve los extras de ESE plan
   * antes de seguir, y puede comparar sin ir y volver. */
  protected elegirPlan(plan: PlanPublico): void {
    if (this.planSeleccionado()?.id === plan.id) {
      return;
    }
    this.planSeleccionado.set(plan);
    // Conserva solo los extras que siguen siendo "extra" en el plan nuevo
    // — lo que ya viene incluido en este plan deja de tener sentido pedirlo.
    const codigosDelPlan = new Set(plan.modulos.map((m) => m.codigo));
    this.modulosExtraSeleccionados.update(
      (actual) => new Set([...actual].filter((c) => !codigosDelPlan.has(c))),
    );
  }

  protected continuarAFormulario(): void {
    if (!this.planSeleccionado()) {
      return;
    }
    this.irAPaso('formulario');
  }

  protected alternarModuloExtra(codigo: string): void {
    this.modulosExtraSeleccionados.update((actual) => {
      const copia = new Set(actual);
      copia.has(codigo) ? copia.delete(codigo) : copia.add(codigo);
      return copia;
    });
  }

  protected iconoDelPlan(plan: PlanPublico): string | null {
    return ICONOS_POR_PLAN[plan.nombre] ?? null;
  }

  /** "Incluye:" para el plan de entrada, "Todo lo de <entrada>, más:"
   * para el resto — ver el comentario en `planDeEntrada`. */
  protected encabezadoCaracteristicas(plan: PlanPublico): string {
    const entrada = this.planDeEntrada();
    if (!entrada || plan.id === entrada.id) {
      return 'Incluye:';
    }
    return `Todo lo de ${entrada.nombre}, más:`;
  }

  /** Vuelve a la selección de plan sin perder lo ya tipeado en el
   * formulario ni el plan/extras elegidos — solo para comparar. */
  protected volverAPlanes(): void {
    this.irAPaso('plan');
  }

  protected actualizarCampo(campo: keyof CamposFormulario, valor: string): void {
    this.campos.update((actual) => ({ ...actual, [campo]: valor }));
    if (this.camposInvalidos()[campo]) {
      this.camposInvalidos.update((actual) => ({ ...actual, [campo]: false }));
    }
    this.errorEnvio.set(null);
  }

  /** Chip de rubro: un segundo toque sobre el mismo lo limpia. */
  protected elegirRubro(rubro: string): void {
    this.actualizarCampo('rubro', this.campos().rubro === rubro ? '' : rubro);
  }

  protected alternarOtroCorreoContacto(): void {
    this.usarOtroCorreoContacto.update((v) => !v);
    this.camposInvalidos.update((actual) => ({ ...actual, correoContacto: false }));
  }

  protected enviar(): void {
    const plan = this.planSeleccionado();
    if (!plan || this.enviando()) {
      return;
    }

    const c = this.campos();
    const invalidos: Partial<Record<keyof CamposFormulario, boolean>> = {
      nombre: c.nombre.trim().length === 0,
      duenoNombres: c.duenoNombres.trim().length === 0,
      duenoApellidos: c.duenoApellidos.trim().length === 0,
      duenoCorreo: !EMAIL_RE.test(c.duenoCorreo.trim()),
      correoContacto: this.usarOtroCorreoContacto() && !EMAIL_RE.test(c.correoContacto.trim()),
    };
    this.camposInvalidos.set(invalidos);
    if (Object.values(invalidos).some(Boolean)) {
      this.sacudida.update((s) => (s === 'a' ? 'b' : 'a'));
      return;
    }

    this.enviando.set(true);
    this.errorEnvio.set(null);

    const modulosSolicitados = this.modulosExtraElegidos().map((m) => m.codigo);
    const correoContacto = this.correoContactoEfectivo();

    this.registroPublicoService
      .registrar({
        nombre: c.nombre.trim(),
        rubro: c.rubro.trim() || undefined,
        correoContacto,
        telefonoContacto: c.telefonoContacto.trim() || undefined,
        duenoNombres: c.duenoNombres.trim(),
        duenoApellidos: c.duenoApellidos.trim(),
        duenoCorreo: c.duenoCorreo.trim(),
        planId: plan.id,
        modulosSolicitados: modulosSolicitados.length ? modulosSolicitados : undefined,
      })
      .subscribe({
        next: (empresa) => {
          this.enviando.set(false);
          this.nombreEmpresaRegistrada.set(empresa.nombre);
          this.correoConfirmacion.set(correoContacto);
          this.irAPaso('confirmacion');
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.errorEnvio.set(
            this.mensajeDeError(err, 'No se pudo enviar el registro. Intenta de nuevo.'),
          );
        },
      });
  }

  protected irALogin(): void {
    this.router.navigateByUrl('/login');
  }

  /** Cambia de paso y sube al inicio — cada paso entra con su propia
   * animación (`anim-paso-in` en el template) al insertarse en el DOM. */
  private irAPaso(paso: PasoRegistro): void {
    this.paso.set(paso);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Mismo criterio que LoginComponent.mensajeDeError: el backend devuelve
  // mensajes en español ya listos para mostrar (ej. ConflictException de
  // EmpresaService.registrarPublico cuando el correo del dueño ya tiene
  // cuenta o ya hay un registro pendiente con ese correo).
  private mensajeDeError(err: unknown, mensajePorDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'No se pudo conectar con el servidor. Revisa tu conexión.';
      }
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return mensajePorDefecto;
  }
}
