import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconAddressBook,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconBuildingStore,
  IconCashRegister,
  IconChartBar,
  IconCheck,
  IconCircleCheckFilled,
  IconDiscount,
  IconDots,
  IconExclamationCircleFilled,
  IconFileInvoice,
  IconHammer,
  IconInfoCircle,
  IconLock,
  IconMail,
  IconMessageCircle,
  IconMinus,
  IconPackages,
  IconPhone,
  IconPlugConnected,
  IconPuzzle,
  IconShirt,
  IconToolsKitchen2,
  IconUser,
  IconUsers,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { ModuloPublico, PlanPublico } from '../../models/plan-publico.model';
import { RegistroPublicoService } from '../../services/registro-publico.service';

/** COP sin decimales y con "." de miles — ver el comentario original. */
function formatCop(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 1 plan · 2 negocio · 3 persona dueña · 4 módulos · 5 enviado. */
type Paso = 1 | 2 | 3 | 4 | 5;

interface CamposFormulario {
  nombre: string;
  rubro: string;
  correoContacto: string;
  telefonoContacto: string;
  duenoNombres: string;
  duenoApellidos: string;
  duenoCorreo: string;
}

type Campo = keyof CamposFormulario;

/** Forma de cada entrada de `camposPaso()` — anotada explícita a
 * propósito: sin esto, TS infiere el tipo de retorno del `computed` como
 * una unión de las formas exactas de cada array literal (paso 2 vs paso
 * 3), y el template type-checking rechaza leer `c.opcional`/`c.bloqueado`
 * porque no están en TODAS las variantes de esa unión (no se compiló al
 * traer el handoff, corregido acá). */
interface CampoDeFormulario {
  campo: Campo;
  label: string;
  icono: typeof IconUser;
  tipo: string;
  ancho?: boolean;
  ph: string;
  auto: string;
  error?: string;
  opcional?: boolean;
  hint?: string;
  bloqueado?: boolean;
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

const PASOS = ['Plan', 'Tu negocio', 'Persona dueña', 'Módulos'] as const;

const RUBROS = [
  { texto: 'Tienda', icono: IconBuildingStore },
  { texto: 'Restaurante', icono: IconToolsKitchen2 },
  { texto: 'Ropa', icono: IconShirt },
  { texto: 'Ferretería', icono: IconHammer },
  { texto: 'Servicios', icono: IconBriefcase },
  { texto: 'Otro', icono: IconDots },
];

/** `GET /modulos/publico` solo trae `codigo`/`nombre` — el ícono y la
 * bajada viven acá, por código. Un módulo nuevo sin entrada cae en el
 * genérico (`IconPuzzle`, sin descripción) y no rompe nada. */
const UI_MODULO: Record<string, { icono: typeof IconPuzzle; desc: string }> = {
  inventory: { icono: IconPackages, desc: 'Stock, bodegas y movimientos' },
  pos: { icono: IconCashRegister, desc: 'Caja, tickets y cierres' },
  invoices: { icono: IconFileInvoice, desc: 'Emisión ante la DIAN' },
  reports: { icono: IconChartBar, desc: 'Tableros y exportaciones' },
  discounts: { icono: IconDiscount, desc: 'Promos y listas de precios' },
  messages: { icono: IconMessageCircle, desc: 'Avisos a tus clientes' },
  customers: { icono: IconAddressBook, desc: 'Clientes y cartera' },
  users: { icono: IconUsers, desc: 'Equipo y permisos' },
  integrations: { icono: IconPlugConnected, desc: 'Tokens y webhooks' },
};
const uiModulo = (codigo: string) => UI_MODULO[codigo] ?? { icono: IconPuzzle, desc: '' };

/**
 * Página pública de registro/checkout (`/registro`, fuera del shell).
 *
 * Rediseño 2026-09-27 (`Registro - Rediseño.dc.html`):
 * - Topbar de ancho completo: logo a la izquierda, stepper al centro,
 *   "Iniciar sesión" a la derecha con hover animado.
 * - Sin tarjeta blanca: los pasos van directo sobre `bg-login-bg`, con
 *   título en dos tonos + "burbuja" de diálogo que usa lo ya tipeado.
 * - A la derecha, un ticket en vivo que se llena mientras el visitante
 *   escribe; al enviar, se estampa "RECIBIDA" en diagonal.
 * - Pasos: 1 plan (tarjetas + comparativa de módulos), 2 negocio (rubro
 *   con chips), 3 persona dueña ("Voy a operar la cuenta yo" reutiliza el
 *   correo de contacto), 4 módulos extra (opcional), 5 enviado.
 * - Enter avanza, Esc vuelve.
 *
 * Mismo contrato con el backend que antes: `listarPlanes()`,
 * `listarCatalogoModulos()` y `registrar()` sin cambios.
 */
@Component({
  selector: 'app-registro-publico-page',
  standalone: true,
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registro-publico-page.component.html',
})
export class RegistroPublicoPageComponent implements OnInit {
  private readonly registroPublicoService = inject(RegistroPublicoService);
  private readonly router = inject(Router);

  protected readonly iconAtras = IconArrowLeft;
  protected readonly iconFlecha = IconArrowRight;
  protected readonly iconCheck = IconCheck;
  protected readonly iconOk = IconCircleCheckFilled;
  protected readonly iconNo = IconMinus;
  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconInfo = IconInfoCircle;
  protected readonly formatCop = formatCop;
  protected readonly pasosNombres = PASOS;
  protected readonly rubros = RUBROS;
  protected readonly uiModulo = uiModulo;
  protected readonly fechaHoy = new Date().toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  protected readonly paso = signal<Paso>(1);
  /** Paso más alto alcanzado — hasta ahí se puede volver desde el stepper. */
  protected readonly pasoMax = signal<Paso>(1);
  /** Pasos donde ya se intentó avanzar — recién ahí se pintan los errores. */
  private readonly intentados = signal<Set<number>>(new Set());

  // ── Datos ───────────────────────────────────────────────────────────
  protected readonly planes = signal<PlanPublico[]>([]);
  protected readonly cargandoPlanes = signal(true);
  protected readonly errorPlanes = signal<string | null>(null);
  protected readonly planId = signal<number | null>(null);
  protected readonly catalogoModulos = signal<ModuloPublico[]>([]);

  protected readonly campos = signal<CamposFormulario>({ ...FORMULARIO_VACIO });
  protected readonly soyYo = signal(false);
  protected readonly modulosExtraSeleccionados = signal<Set<string>>(new Set());
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);

  // ── Derivados ───────────────────────────────────────────────────────
  /** Ordenados por precio: el primero es el "de entrada". */
  protected readonly planesOrdenados = computed(() =>
    [...this.planes()].sort((a, b) => (a.precioMensual ?? Infinity) - (b.precioMensual ?? Infinity)),
  );
  /** Anotado explícito (`PlanPublico | null`) a propósito: sin esto, TS
   * infiere el tipo de `planesOrdenados()[0]` como `PlanPublico` (no
   * `| undefined`, porque el proyecto no tiene `noUncheckedIndexedAccess`)
   * y termina creyendo que `plan()` nunca puede ser `null` — Angular
   * entonces marca como redundante (`NG8107`) cada `plan()?.` del
   * template. Esa "certeza" es falsa en tiempo de ejecución: mientras
   * `cargandoPlanes()` sigue en `true` (o si `GET /planes` devuelve una
   * lista vacía), `planesOrdenados()` está vacío y `[0]` es
   * `undefined` de verdad — el "ticket en vivo" (aside, sin guardas de
   * carga) lee `plan()` en ese momento. La anotación deja el tipo
   * correcto y quita los warnings sin sacar ningún `?.` real. */
  protected readonly plan = computed<PlanPublico | null>(
    () => this.planes().find((p) => p.id === this.planId()) ?? this.planesOrdenados()[0] ?? null,
  );
  private readonly codigosPlan = computed(() => new Set(this.plan()?.modulos.map((m) => m.codigo) ?? []));

  /** Filas de la comparativa: todo el catálogo × todos los planes. */
  protected readonly comparativa = computed(() => {
    const planes = this.planesOrdenados();
    const entrada = planes[0];
    return this.catalogoModulos().map((m) => {
      const tiene = planes.map((p) => p.modulos.some((x) => x.codigo === m.codigo));
      const primero = planes.find((_, i) => tiene[i]);
      return {
        ...m,
        icono: uiModulo(m.codigo).icono,
        enPlan: this.codigosPlan().has(m.codigo),
        tiene,
        /** "Desde Plus": no está en el plan de entrada pero sí en uno mayor. */
        desde: entrada && !tiene[0] && primero ? primero.nombre : null,
      };
    });
  });

  protected readonly modulosExtraDisponibles = computed(() =>
    this.catalogoModulos().filter((m) => !this.codigosPlan().has(m.codigo)),
  );
  protected readonly modulosExtraElegidos = computed(() =>
    this.modulosExtraDisponibles().filter((m) => this.modulosExtraSeleccionados().has(m.codigo)),
  );

  protected readonly correoDueno = computed(() =>
    this.soyYo() ? this.campos().correoContacto : this.campos().duenoCorreo,
  );

  protected readonly errores = computed<Partial<Record<Campo, boolean>>>(() => {
    const c = this.campos();
    const p = this.paso();
    if (p === 2) {
      return { nombre: !c.nombre.trim(), correoContacto: !EMAIL_RE.test(c.correoContacto.trim()) };
    }
    if (p === 3) {
      return {
        duenoNombres: !c.duenoNombres.trim(),
        duenoApellidos: !c.duenoApellidos.trim(),
        duenoCorreo: !EMAIL_RE.test(this.correoDueno().trim()),
      };
    }
    return {};
  });
  protected readonly mostrarErrores = computed(() => this.intentados().has(this.paso()));
  protected readonly hayErrores = computed(() => Object.values(this.errores()).some(Boolean));

  /** Título en dos tonos + diálogo, por paso — usa lo ya tipeado. */
  protected readonly encabezado = computed(() => {
    const c = this.campos();
    const plan = this.plan()?.nombre ?? 'Tu plan';
    const negocio = c.nombre.trim();
    const dueno = c.duenoNombres.trim();
    switch (this.paso()) {
      case 1:
        return {
          a: 'Empecemos por lo importante.',
          b: '¿Con qué plan arrancas?',
          dialogo:
            'Hola, soy el equipo de Goods. Elige el plan que mejor te quede hoy — si tu negocio crece, lo cambiamos después sin perder nada.',
        };
      case 2:
        return {
          a: `${plan}, buena elección.`,
          b: 'Ahora cuéntanos de tu negocio.',
          dialogo:
            'Con esto te identificamos y sabemos a dónde escribirte. El teléfono nos ayuda a coordinar la llamada de activación.',
        };
      case 3:
        return {
          a: negocio ? `Perfecto, ${negocio}.` : 'Perfecto.',
          b: '¿Quién va a llevar la cuenta?',
          dialogo:
            'Esta persona entra como dueña cuando activemos la cuenta. Puede ser quien llenó esto o alguien más del equipo.',
        };
      case 4:
        return {
          a: dueno ? `Casi listo, ${dueno}.` : 'Casi listo.',
          b: '¿Quieres sumar algo más?',
          dialogo: `Tu plan ${plan} no trae estos módulos. Marca los que te interesen y los hablamos en la llamada — es opcional, puedes seguir sin elegir ninguno.`,
        };
      default: {
        const n = this.modulosExtraElegidos().length;
        return {
          a: `Listo${dueno ? ', ' + dueno : ''}.`,
          b: `${negocio || 'Tu negocio'} ya está en la fila.`,
          dialogo: `Anotamos todo con el plan ${plan}${n ? ` y ${n} extra${n === 1 ? '' : 's'} para conversar` : ''}. No tienes que hacer nada más por ahora — te escribimos a ${c.correoContacto.trim() || 'tu correo'} apenas lo revisemos.`,
        };
      }
    }
  });

  /** Campos del paso 2/3 — se pintan con un solo `@for`. */
  protected readonly camposPaso = computed<CampoDeFormulario[]>(() => {
    const p = this.paso();
    if (p === 2) {
      return [
        { campo: 'nombre' as Campo, label: 'Nombre del negocio', icono: IconBuildingStore, tipo: 'text', ancho: true, ph: 'Ferretería El Tornillo', auto: 'organization', error: 'Ingresa el nombre de tu negocio' },
        { campo: 'correoContacto' as Campo, label: 'Correo de contacto', icono: IconMail, tipo: 'email', ph: 'hola@negocio.co', auto: 'email', error: 'Ingresa un correo válido' },
        { campo: 'telefonoContacto' as Campo, label: 'Teléfono', icono: IconPhone, tipo: 'tel', ph: '300 123 4567', auto: 'tel', opcional: true, hint: 'Para coordinar la llamada' },
      ];
    }
    if (p === 3) {
      return [
        { campo: 'duenoNombres' as Campo, label: 'Nombres', icono: IconUser, tipo: 'text', ph: '', auto: 'given-name', error: 'Ingresa los nombres' },
        { campo: 'duenoApellidos' as Campo, label: 'Apellidos', icono: IconUser, tipo: 'text', ph: '', auto: 'family-name', error: 'Ingresa los apellidos' },
        {
          campo: 'duenoCorreo' as Campo, label: 'Correo para iniciar sesión', icono: IconLock, tipo: 'email', ancho: true,
          ph: 'dueno@negocio.co', auto: 'email', error: 'Ingresa un correo válido', bloqueado: this.soyYo(),
          hint: this.soyYo() ? 'Es el mismo correo de contacto.' : 'Con este correo va a iniciar sesión.',
        },
      ];
    }
    return [];
  });

  /** Líneas del ticket en vivo. */
  protected readonly lineasTicket = computed(() => {
    const c = this.campos();
    const v = (s: string) => s.trim() || null;
    const dueno = [v(c.duenoNombres), v(c.duenoApellidos)].filter(Boolean).join(' ') || null;
    return [
      { k: 'Negocio', v: v(c.nombre) },
      { k: 'Rubro', v: v(c.rubro) },
      { k: 'Contacto', v: v(c.correoContacto) },
      { k: 'Dueño/a', v: dueno },
      { k: 'Inicia sesión con', v: v(this.correoDueno()) },
    ];
  });
  protected readonly obligatoriosCompletos = computed(() => {
    const c = this.campos();
    return [c.nombre, c.correoContacto, c.duenoNombres, c.duenoApellidos, this.correoDueno()].filter((x) => x.trim())
      .length;
  });

  protected readonly textoBoton = computed(() => {
    if (this.paso() === 5) return 'Ir a iniciar sesión';
    if (this.paso() < 4) return 'Continuar';
    if (this.enviando()) return 'Enviando…';
    const n = this.modulosExtraElegidos().length;
    return n ? `Enviar con ${n} extra${n === 1 ? '' : 's'}` : 'Enviar solicitud';
  });

  protected readonly siguientes = computed(() => {
    const c = this.campos();
    const extras = this.modulosExtraElegidos().length > 0;
    return [
      { n: '01', estado: 'En curso', titulo: 'Revisamos tu registro', texto: 'Suele tomar menos de un día hábil.', activo: true },
      { n: '02', estado: 'Siguiente', titulo: 'Te llamamos', texto: `Confirmamos los datos${extras ? ' y los extras' : ''} con ${c.duenoNombres.trim() || 'la persona dueña'}.`, activo: false },
      { n: '03', estado: 'Después', titulo: 'Defines tu contraseña', texto: `Te llega un enlace a ${this.correoDueno().trim() || 'tu correo'} y la cuenta queda activa.`, activo: false },
    ];
  });

  // ── Ciclo de vida ──────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargarPlanes();
    this.registroPublicoService.listarCatalogoModulos().subscribe({
      next: (catalogo) => this.catalogoModulos.set(catalogo),
      error: () => undefined,
    });
  }

  private cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.errorPlanes.set(null);
    this.registroPublicoService.listarPlanes().subscribe({
      next: (respuesta) => {
        this.planes.set(respuesta.data);
        this.planId.set(this.planesOrdenados()[0]?.id ?? null);
        this.cargandoPlanes.set(false);
      },
      error: (err: unknown) => {
        this.cargandoPlanes.set(false);
        this.errorPlanes.set(this.mensajeDeError(err, 'No se pudo cargar el catálogo de planes.'));
      },
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.avanzar();
    } else if (e.key === 'Escape' && this.paso() > 1 && this.paso() < 5) {
      this.irA((this.paso() - 1) as Paso);
    }
  }

  // ── Acciones ───────────────────────────────────────────────────────
  protected irA(n: Paso): void {
    if (n <= this.pasoMax() && this.paso() < 5) {
      this.paso.set(n);
    }
  }

  protected elegirPlan(plan: PlanPublico): void {
    this.planId.set(plan.id);
    // Lo que era "extra" para un plan puede venir incluido en otro.
    this.modulosExtraSeleccionados.set(new Set());
  }

  /** "Incluye:" para el plan de entrada (el más barato), "Todo lo de
   * <entrada>, más:" para el resto — mismo criterio que la versión
   * anterior de esta página (`planDeEntrada`/`encabezadoCaracteristicas`,
   * ver el handoff `handoff-registro`). El rediseño 2026-09-27 dejó de
   * pintar `plan.caracteristicas` por completo (regresión no señalada en
   * su LEEME — el bullet de marketing de Plus, ej. "Tienda pública
   * propia"/"Asistente de IA", desapareció de la tarjeta); se reincorpora
   * acá con el mismo encabezado condicional, adaptado al estilo oscuro
   * nuevo. */
  protected encabezadoCaracteristicas(plan: PlanPublico): string {
    const entrada = this.planesOrdenados()[0];
    if (!entrada || plan.id === entrada.id) {
      return 'Incluye:';
    }
    return `Todo lo de ${entrada.nombre}, más:`;
  }

  protected actualizarCampo(campo: Campo, valor: string): void {
    this.campos.update((actual) => ({ ...actual, [campo]: valor }));
    this.errorEnvio.set(null);
  }

  protected elegirRubro(rubro: string): void {
    this.actualizarCampo('rubro', this.campos().rubro === rubro ? '' : rubro);
  }

  protected alternarModuloExtra(codigo: string): void {
    this.modulosExtraSeleccionados.update((actual) => {
      const copia = new Set(actual);
      copia.has(codigo) ? copia.delete(codigo) : copia.add(codigo);
      return copia;
    });
  }

  protected avanzar(): void {
    const p = this.paso();
    if (p === 5) {
      this.router.navigateByUrl('/login');
      return;
    }
    if (p === 1 && !this.plan()) {
      return;
    }
    if (this.hayErrores()) {
      this.intentados.update((s) => new Set(s).add(p));
      return;
    }
    if (p === 4) {
      this.enviar();
      return;
    }
    const siguiente = (p + 1) as Paso;
    this.paso.set(siguiente);
    this.pasoMax.update((m) => (siguiente > m ? siguiente : m));
  }

  private enviar(): void {
    const plan = this.plan();
    if (!plan || this.enviando()) {
      return;
    }
    const c = this.campos();
    const modulosSolicitados = this.modulosExtraElegidos().map((m) => m.codigo);
    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.registroPublicoService
      .registrar({
        nombre: c.nombre.trim(),
        rubro: c.rubro.trim() || undefined,
        correoContacto: c.correoContacto.trim(),
        telefonoContacto: c.telefonoContacto.trim() || undefined,
        duenoNombres: c.duenoNombres.trim(),
        duenoApellidos: c.duenoApellidos.trim(),
        duenoCorreo: this.correoDueno().trim(),
        planId: plan.id,
        modulosSolicitados: modulosSolicitados.length ? modulosSolicitados : undefined,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.paso.set(5);
          this.pasoMax.set(5);
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.errorEnvio.set(this.mensajeDeError(err, 'No se pudo enviar el registro. Intenta de nuevo.'));
        },
      });
  }

  private mensajeDeError(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'No se pudo conectar con el servidor. Revisa tu conexión.';
      }
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return porDefecto;
  }
}
