import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheckFilled,
  IconExclamationCircleFilled,
  IconInfoCircle,
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
 * Flujo en pasos (mismo patrón que `LoginComponent`: signal `paso` +
 * inputs nativos con signals a mano, sin Angular Forms):
 * 1. `plan` — trae el catálogo público (`GET /planes`, siempre solo
 *    `activo: true`) y el visitante elige uno.
 * 2. `formulario` — datos del negocio + datos de quien va a terminar
 *    logueándose como dueño (pueden ser la misma persona que
 *    `correoContacto` o no — ver el comentario en
 *    `RegistroPublicoEmpresaDto` del backend).
 * 3. `confirmacion` — el registro queda `pendiente` de revisión del
 *    staff (`POST /empresas/registro-publico`, ver `EmpresaService`
 *    .registrarPublico); NO crea sesión ni loguea a nadie — recién hay
 *    `Usuario` dueño cuando el staff activa la Empresa desde "Altas
 *    pendientes" (`PATCH /empresas/:id/activar`), así que esta pantalla
 *    no redirige a `/login`, se queda mostrando el estado.
 *
 * No lleva `authInterceptor` en juego (no hay token todavía) ni
 * `TenantContextInterceptor` del lado del backend (`Empresa`/`Plan` son
 * tablas "de arriba", ver `plan.entity.ts`) — ambos endpoints que usa
 * esta pantalla son explícitamente públicos.
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
  protected readonly iconCheck = IconCheck;
  protected readonly iconConfirmado = IconCircleCheckFilled;
  protected readonly iconError = IconExclamationCircleFilled;
  protected readonly iconInfo = IconInfoCircle;
  protected readonly formatCop = formatCop;

  protected readonly paso = signal<PasoRegistro>('plan');

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

  // Paso 2: formulario.
  protected readonly campos = signal<CamposFormulario>({ ...FORMULARIO_VACIO });
  protected readonly camposInvalidos = signal<Partial<Record<keyof CamposFormulario, boolean>>>(
    {},
  );
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal<string | null>(null);

  // Módulos extra (Fase 2 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md,
  // §11.6) — códigos que el visitante marcó como "extra", entre los que
  // el plan elegido NO trae de por sí (ver `modulosExtraDisponibles`).
  // Sugerencia, no confirmación: staff la corrobora en el asistente de
  // activación (§11.7) antes de que se vuelva un acceso real.
  protected readonly modulosExtraSeleccionados = signal<Set<string>>(new Set());

  /** Catálogo REAL de módulos activos (`GET /modulos/publico`, §11.6,
   * corrección 2026-09-26) — reemplaza el intento inicial de derivar este
   * universo como unión de `plan.modulos` de todos los planes activos:
   * ese enfoque fallaba apenas un módulo no estaba vinculado a NINGÚN
   * plan todavía (el caso real de `discounts`/`messages` recién
   * sembrados, encontrado probando el flujo de punta a punta), que es
   * justo el caso que el checkout necesita poder ofrecer como extra. */
  protected readonly catalogoModulos = signal<ModuloPublico[]>([]);

  /** Los módulos que el plan elegido NO trae — se ofrecen como "extra, a
   * confirmar con nuestro equipo" (checkboxes → `modulosSolicitados`). */
  protected readonly modulosExtraDisponibles = computed(() => {
    const plan = this.planSeleccionado();
    if (!plan) {
      return [];
    }
    const codigosDelPlan = new Set(plan.modulos.map((m) => m.codigo));
    return this.catalogoModulos().filter((m) => !codigosDelPlan.has(m.codigo));
  });

  // Paso 3: confirmación.
  protected readonly nombreEmpresaRegistrada = signal('');

  protected readonly formularioValido = computed(() => {
    const c = this.campos();
    return (
      c.nombre.trim().length > 0 &&
      EMAIL_RE.test(c.correoContacto.trim()) &&
      c.duenoNombres.trim().length > 0 &&
      c.duenoApellidos.trim().length > 0 &&
      EMAIL_RE.test(c.duenoCorreo.trim())
    );
  });

  ngOnInit(): void {
    this.cargarPlanes();
    this.cargarCatalogoModulos();
  }

  private cargarPlanes(): void {
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
   * "módulos extra" simplemente no aparece (`modulosExtraDisponibles`
   * queda vacía), en vez de tirar abajo toda la pantalla de planes. */
  private cargarCatalogoModulos(): void {
    this.registroPublicoService.listarCatalogoModulos().subscribe({
      next: (catalogo) => this.catalogoModulos.set(catalogo),
      // Silencioso: es una mejora opcional del checkout, no un dato
      // obligatorio para poder registrarse (ver el comentario de arriba).
      error: () => undefined,
    });
  }

  protected elegirPlan(plan: PlanPublico): void {
    this.planSeleccionado.set(plan);
    // Limpia la selección de módulos extra: lo que era "extra" para un
    // plan puede ya venir incluido en otro (ver `modulosExtraDisponibles`).
    this.modulosExtraSeleccionados.set(new Set());
    this.paso.set('formulario');
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
   * formulario — a diferencia de "Cambiar correo" en el login, acá no
   * tiene sentido limpiar nada: el visitante puede volver solo para
   * comparar planes. */
  protected volverAPlanes(): void {
    this.paso.set('plan');
  }

  protected actualizarCampo(campo: keyof CamposFormulario, valor: string): void {
    this.campos.update((actual) => ({ ...actual, [campo]: valor }));
    if (this.camposInvalidos()[campo]) {
      this.camposInvalidos.update((actual) => ({ ...actual, [campo]: false }));
    }
    this.errorEnvio.set(null);
  }

  protected enviar(): void {
    const plan = this.planSeleccionado();
    if (!plan || this.enviando()) {
      return;
    }

    const c = this.campos();
    const invalidos: Partial<Record<keyof CamposFormulario, boolean>> = {
      nombre: c.nombre.trim().length === 0,
      correoContacto: !EMAIL_RE.test(c.correoContacto.trim()),
      duenoNombres: c.duenoNombres.trim().length === 0,
      duenoApellidos: c.duenoApellidos.trim().length === 0,
      duenoCorreo: !EMAIL_RE.test(c.duenoCorreo.trim()),
    };
    this.camposInvalidos.set(invalidos);
    if (Object.values(invalidos).some(Boolean)) {
      return;
    }

    this.enviando.set(true);
    this.errorEnvio.set(null);

    const modulosSolicitados = [...this.modulosExtraSeleccionados()];

    this.registroPublicoService
      .registrar({
        nombre: c.nombre.trim(),
        rubro: c.rubro.trim() || undefined,
        correoContacto: c.correoContacto.trim(),
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
          this.paso.set('confirmacion');
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
