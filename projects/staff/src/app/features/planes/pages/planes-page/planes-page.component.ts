import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCheck,
  IconCircleOff,
  IconMinus,
  IconPlus,
  IconRotateClockwise,
  IconStack2,
  IconTrash,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { Observable, forkJoin } from 'rxjs';
import { GuardarPlanPayload, PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
  serieAcumulada,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { AvisoDatosNuevosComponent } from '../../../../shared/ui/aviso-datos-nuevos/aviso-datos-nuevos.component';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { Suscripcion } from '../../../../core/catalog/models/suscripcion.model';
import { filasCambiadas } from '../../../../shared/ui/filas-cambiadas';
import { traerTodo } from '../../../../shared/ui/lista-hoja/traer-todo';

/** Un plan en edición. `id` negativo = plan nuevo que todavía no existe en
 * el backend (se crea al publicar). */
type PlanBorrador = Plan;

interface CeldaMatriz {
  planId: number;
  planIndice: number;
  icono: typeof IconCheck;
  tamano: number;
  tinta: string;
  fondo: string;
  label: string;
}

interface FilaMatriz {
  indice: number;
  etiqueta: string;
  celdas: CeldaMatriz[];
}

/**
 * Catálogo de planes como matriz: un plan por columna y las características
 * como filas compartidas, porque un plan solo se entiende al lado de sus vecinos.
 *
 * @remarks
 * - Los huecos se detectan solos (`esHueco`): si un plan más caro no incluye
 *   algo que sí incluye uno más barato, la celda sale en ámbar y `lectura()` lo
 *   dice en palabras.
 * - Nada se guarda al tocar: los cambios viven en `borrador` y se publican
 *   juntos desde la barra de abajo, porque el cliente los ve en la página de precios.
 * - Desactivar/reactivar sí va al backend al instante (`DELETE /planes/:id` y
 *   `PATCH` con `activo: true`).
 * - `caracteristicas` es un `string[]` libre por plan: la matriz usa la unión de
 *   todas y al publicar reconstruye el array de cada plan. Renombrar una
 *   característica es un renombre por texto en todos los planes que la tienen.
 * - "Empresas por plan" cuenta solo suscripciones `activa`, para no contar
 *   clientes que ya se fueron.
 */
@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [FormsModule, InputTextModule, TablerIconComponent, PantallaEstadoComponent, CabeceraModuloComponent, AvisoDatosNuevosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planes-page.component.html',
})
export class PlanesPageComponent {
  private readonly planService = inject(PlanService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly cambiosEnVivoService = inject(CambiosEnVivoService);

  /** Mostrar cuántas Empresas hay en cada plan. Requiere
   * `SuscripcionService.listar()`: apágalo si el endpoint no está. */
  protected readonly mostrarSuscripciones = true;

  protected readonly skeletons = [0, 1, 2, 3];
  protected readonly iconModulo = IconStack2;
  protected readonly iconPlus = IconPlus;
  protected readonly iconTilde = IconCheck;
  protected readonly iconBorrar = IconTrash;
  protected readonly iconDesactivar = IconCircleOff;
  protected readonly iconReactivar = IconRotateClockwise;
  protected readonly iconEmpresas = IconBuildingStore;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Cambios en vivo (`CambiosEnVivoService`) acumulados desde la última carga;
   *  alimenta el aviso "Hay cambios nuevos". */
  protected readonly cambiosEnVivo = signal(0);
  /** Filas resaltadas 2 s después de tocar "Actualizar". */
  protected readonly resaltadas = signal<ReadonlySet<number>>(new Set());
  private compararAlCargar = false;
  protected readonly publicando = signal(false);
  protected readonly accionandoId = signal<number | null>(null);
  protected readonly nuevaCaracteristica = signal('');

  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  /** Lo que el staff está editando. */
  private readonly borrador = signal<PlanBorrador[]>([]);
  /** Copia serializada de lo último publicado, para diffear y descartar. */
  private readonly publicadoSnapshot = signal('[]');
  /** Union de características, en el orden en que se muestran las filas. */
  private readonly caracteristicas = signal<string[]>([]);
  protected readonly suscripcionesPorPlan = signal<Map<number, number>>(new Map());
  /** `creadoEn` de las suscripciones activas, solo para la línea de
   * "Empresas suscritas" de la cabecera. */
  private readonly suscripcionesActivasCreadas = signal<string[]>([]);

  private proximoIdTemporal = -1;

  protected readonly planes = computed(() => this.borrador());

  protected readonly gridCols = computed(
    () => `minmax(250px, 1fr) repeat(${this.planes().length}, minmax(210px, 1.1fr)) 96px`,
  );

  /** El wrapper scrolleable necesita un ancho mínimo real, si no las
   * columnas de plan se comen el espacio de las etiquetas y los nombres
   * largos se cortan. */
  protected readonly anchoMinimo = computed(() => {
    const n = this.planes().length;
    return `${250 + n * 220 + 96 + (n + 1) * 10}px`;
  });

  protected readonly resumen = computed(() => {
    const total = this.planes().length;
    const activos = this.planes().filter((p) => p.activo).length;
    return `${total} ${total === 1 ? 'plan' : 'planes'} · ${activos} a la venta`;
  });

  /** Métricas de la cabecera, sin período: es el catálogo tal como está ahora.
   *  "A la venta" e "Inactivos" no tienen historia, así que su serie es una
   *  línea constante con la cifra actual. "Empresas suscritas" sí acumula por
   *  `creadoEn`; "Más elegido" no lleva serie porque su valor es un nombre. */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const planes = this.planes();
    const nVenta = planes.filter((p) => p.activo).length;
    const nInactivos = planes.filter((p) => !p.activo).length;
    const metricas: MetricaCabecera[] = [
      { id: 'venta', etiqueta: 'A la venta', valor: nVenta, tono: 'exito', serie: Array(8).fill(nVenta) },
      { id: 'inactivos', etiqueta: 'Inactivos', valor: nInactivos, tono: 'apagado', serie: Array(8).fill(nInactivos) },
    ];
    if (this.mostrarSuscripciones) {
      const conteo = this.suscripcionesPorPlan();
      const total = [...conteo.values()].reduce((a, b) => a + b, 0);
      let masElegido: { plan: PlanBorrador; n: number } | null = null;
      for (const plan of planes) {
        const n = conteo.get(plan.id) ?? 0;
        if (n > 0 && (!masElegido || n > masElegido.n)) {
          masElegido = { plan, n };
        }
      }
      metricas.push({
        id: 'suscritas',
        etiqueta: 'Empresas suscritas',
        valor: total,
        tono: 'info',
        serie: serieAcumulada(this.suscripcionesActivasCreadas()),
      });
      metricas.push({
        id: 'elegido',
        etiqueta: 'Más elegido',
        valor: masElegido ? masElegido.plan.nombre : '—',
        titulo: masElegido ? `${masElegido.n} Empresa${masElegido.n === 1 ? '' : 's'} suscrita${masElegido.n === 1 ? '' : 's'}` : undefined,
      });
    }
    return metricas;
  });

  /** El plan más caro que no agrega nada sobre el anterior (o que
   * directamente pierde algo) es el síntoma que esta pantalla existe para
   * mostrar. */
  protected readonly lectura = computed(() => {
    const vendibles = this.planes()
      .filter((p) => p.activo && p.precioMensual !== null)
      .sort((a, b) => (a.precioMensual ?? 0) - (b.precioMensual ?? 0));

    for (let i = 1; i < vendibles.length; i++) {
      const caro = vendibles[i];
      const barato = vendibles[i - 1];
      const setCaro = new Set(caro.caracteristicas ?? []);
      const setBarato = new Set(barato.caracteristicas ?? []);
      const faltantes = [...setBarato].filter((c) => !setCaro.has(c));
      const extra = [...setCaro].filter((c) => !setBarato.has(c));

      if (faltantes.length) {
        const resto =
          faltantes.length > 1
            ? ` y ${faltantes.length - 1} cosa${faltantes.length > 2 ? 's' : ''} más`
            : '';
        return `${caro.nombre} cuesta más que ${barato.nombre} pero le falta ${faltantes[0].toLowerCase()}${resto}. Revisa qué incluye cada uno antes de seguir vendiéndolos.`;
      }
      if (!extra.length) {
        return `${caro.nombre} cuesta más que ${barato.nombre} y no agrega nada. Revisa qué incluye cada uno antes de seguir vendiéndolos.`;
      }
    }

    const total = [...this.suscripcionesPorPlan().values()].reduce((a, b) => a + b, 0);
    const cola = total
      ? ` ${total} ${total === 1 ? 'Empresa suscrita' : 'Empresas suscritas'} en total.`
      : '';
    return `El catálogo escala parejo: cada plan agrega algo sobre el anterior.${cola}`;
  });

  protected readonly filas = computed<FilaMatriz[]>(() =>
    this.caracteristicas().map((etiqueta, indice) => ({
      indice,
      etiqueta,
      celdas: this.planes().map((plan, planIndice) => {
        const tiene = (plan.caracteristicas ?? []).includes(etiqueta);
        const hueco = !tiene && this.esHueco(plan, etiqueta);
        return {
          planId: plan.id,
          planIndice,
          icono: tiene ? IconCheck : hueco ? IconAlertTriangle : IconMinus,
          tamano: tiene ? 16 : hueco ? 14 : 12,
          tinta: tiene
            ? plan.activo
              ? 'text-success-solid'
              : 'text-gray-400'
            : hueco
              ? 'text-amber-700'
              : 'text-gray-400',
          fondo: tiene
            ? plan.activo
              ? 'bg-card-bg'
              : 'bg-neutral-50'
            : hueco
              ? 'bg-[#fffdf2]'
              : 'bg-card-bg',
          label: `${tiene ? 'Quitar' : 'Agregar'} ${etiqueta} de ${plan.nombre}`,
        };
      }),
    })),
  );

  protected readonly hayCambios = computed(
    () => JSON.stringify(this.borrador()) !== this.publicadoSnapshot(),
  );

  protected readonly textoCambios = computed(() => {
    const anterior: PlanBorrador[] = JSON.parse(this.publicadoSnapshot());
    const n = this.borrador().filter((plan) => {
      const previo = anterior.find((p) => p.id === plan.id);
      return !previo || JSON.stringify(previo) !== JSON.stringify(plan);
    }).length;
    return n <= 1 ? 'Cambios sin publicar' : `${n} planes modificados`;
  });

  constructor() {
    this.cargar();
    this.cambiosEnVivoService
      .huboCambio(['plan', 'suscripcion'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
  }

  protected actualizarPorCambioEnVivo(): void {
    this.cambiosEnVivo.set(0);
    this.compararAlCargar = true;
    this.cargar();
  }

  /** Marca 2 s las filas nuevas o cambiadas al tocar "Actualizar". `clave` =
   *  id de la fila en pantalla, por si no coincide con el id del dato comparado. */
  private resaltarCambios<T>(
    antes: readonly T[],
    despues: readonly T[],
    id: (f: T) => number,
    clave: (f: T) => number = id,
  ): void {
    if (!this.compararAlCargar) return;
    this.compararAlCargar = false;
    const cambiados = filasCambiadas(antes, despues, id);
    this.resaltadas.set(new Set(despues.filter((f) => cambiados.has(id(f))).map(clave)));
    setTimeout(() => this.resaltadas.set(new Set()), 2000);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    // Solo 'activa': las canceladas o vencidas no cuentan como clientes del plan.
    const peticiones = this.mostrarSuscripciones
      ? forkJoin({ planes: this.planService.listarTodos(), suscripciones: traerTodo((page) => this.suscripcionService.listar('activa', undefined, page)) })
      : forkJoin({ planes: this.planService.listarTodos() });

    peticiones.subscribe({
      next: (respuesta: { planes: { data: Plan[] }; suscripciones?: { data: Suscripcion[] } }) => {
        const planes = respuesta.planes.data;
        this.resaltarCambios(this.borrador(), planes, (p) => p.id);
        this.borrador.set(planes.map((p) => ({ ...p, caracteristicas: [...(p.caracteristicas ?? [])] })));
        this.publicadoSnapshot.set(JSON.stringify(this.borrador()));
        this.caracteristicas.set(this.unionCaracteristicas(planes));

        if (respuesta.suscripciones) {
          const conteo = new Map<number, number>();
          for (const s of respuesta.suscripciones.data) {
            conteo.set(s.planId, (conteo.get(s.planId) ?? 0) + 1);
          }
          this.suscripcionesPorPlan.set(conteo);
          this.suscripcionesActivasCreadas.set(respuesta.suscripciones.data.map((s) => s.creadoEn));
        }
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de planes. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** Orden de las filas: el plan más completo manda, así la matriz se lee
   * como una escalera y no como el orden de inserción del backend. */
  private unionCaracteristicas(planes: Plan[]): string[] {
    const porCobertura = [...planes].sort(
      (a, b) => (b.caracteristicas?.length ?? 0) - (a.caracteristicas?.length ?? 0),
    );
    const union: string[] = [];
    for (const plan of porCobertura) {
      for (const c of plan.caracteristicas ?? []) {
        if (!union.includes(c)) {
          union.push(c);
        }
      }
    }
    return union;
  }

  /** Hueco: algún plan activo MÁS BARATO sí incluye esta característica. */
  private esHueco(plan: PlanBorrador, etiqueta: string): boolean {
    if (plan.precioMensual === null) {
      return false;
    }
    return this.planes().some(
      (otro) =>
        otro.activo &&
        otro.precioMensual !== null &&
        otro.precioMensual < plan.precioMensual! &&
        (otro.caracteristicas ?? []).includes(etiqueta),
    );
  }

  protected precioTexto(plan: PlanBorrador): string {
    return plan.precioMensual === null ? '' : plan.precioMensual.toLocaleString('es-CO');
  }

  protected textoSuscripciones(plan: PlanBorrador): string {
    const n = this.suscripcionesPorPlan().get(plan.id) ?? 0;
    return `${n} ${n === 1 ? 'Empresa' : 'Empresas'}`;
  }

  protected editarPlan(indice: number, cambios: Partial<PlanBorrador>): void {
    this.borrador.update((planes) => planes.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));
  }

  /** Días de prueba del plan: de 0 a 90. */
  protected editarDiasPrueba(indice: number, valor: string): void {
    const n = Number(String(valor).replace(/[^\d]/g, '') || 0);
    this.editarPlan(indice, { diasPrueba: Math.max(0, Math.min(90, n)) });
  }

  protected editarPrecio(indice: number, valor: string): void {
    const limpio = valor.replace(/[^\d]/g, '');
    this.editarPlan(indice, { precioMensual: limpio ? Number(limpio) : null });
  }

  protected alternarCaracteristica(planIndice: number, filaIndice: number): void {
    const etiqueta = this.caracteristicas()[filaIndice];
    this.borrador.update((planes) =>
      planes.map((plan, i) => {
        if (i !== planIndice) {
          return plan;
        }
        const actuales = plan.caracteristicas ?? [];
        return {
          ...plan,
          caracteristicas: actuales.includes(etiqueta)
            ? actuales.filter((c) => c !== etiqueta)
            : [...actuales, etiqueta],
        };
      }),
    );
  }

  // TODO(backend): si los renombres se vuelven comunes, pasar a una tabla `caracteristica` con relación N:M.
  /** Renombre por texto: toca todos los planes que tenían la etiqueta anterior. */
  protected renombrarCaracteristica(indice: number, nuevo: string): void {
    const anterior = this.caracteristicas()[indice];
    this.caracteristicas.update((cs) => cs.map((c, i) => (i === indice ? nuevo : c)));
    this.borrador.update((planes) =>
      planes.map((plan) => ({
        ...plan,
        caracteristicas: (plan.caracteristicas ?? []).map((c) => (c === anterior ? nuevo : c)),
      })),
    );
  }

  protected quitarCaracteristica(indice: number): void {
    const etiqueta = this.caracteristicas()[indice];
    this.caracteristicas.update((cs) => cs.filter((_, i) => i !== indice));
    this.borrador.update((planes) =>
      planes.map((plan) => ({
        ...plan,
        caracteristicas: (plan.caracteristicas ?? []).filter((c) => c !== etiqueta),
      })),
    );
  }

  protected agregarCaracteristica(): void {
    const limpio = this.nuevaCaracteristica().trim();
    if (!limpio || this.caracteristicas().includes(limpio)) {
      this.nuevaCaracteristica.set('');
      return;
    }
    this.caracteristicas.update((cs) => [...cs, limpio]);
    this.nuevaCaracteristica.set('');
  }

  protected agregarPlan(): void {
    this.borrador.update((planes) => [
      ...planes,
      {
        id: this.proximoIdTemporal--,
        nombre: 'Plan sin nombre',
        descripcion: null,
        precioMensual: null,
        caracteristicas: [],
        activo: false,
        diasPrueba: 7,
        // Un plan del borrador todavía no existe en el backend, así que no
        // tiene módulos: se asignan desde el catálogo, esta pantalla no los edita.
        modulos: [],
      } as PlanBorrador,
    ]);
  }

  /** Esto sí pega al backend al instante: desactivar un plan es una acción
   * del catálogo, no una edición de contenido. */
  protected alternarActivo(plan: PlanBorrador): void {
    if (this.accionandoId() !== null) {
      return;
    }
    // Un plan nuevo todavía no existe: solo se alterna en el borrador.
    if (plan.id < 0) {
      this.editarPlan(
        this.borrador().findIndex((p) => p.id === plan.id),
        { activo: !plan.activo },
      );
      return;
    }

    this.accionandoId.set(plan.id);
    // `Observable<unknown>` explícito: con la unión de `Observable<void>` y
    // `Observable<Plan>`, TS no resuelve la sobrecarga de `subscribe`.
    const request: Observable<unknown> = plan.activo
      ? this.planService.desactivar(plan.id)
      : this.planService.reactivar(plan.id);

    this.alertas
      .seguir(request, {
        titulo: plan.activo ? 'Sacando el plan del catálogo' : 'Volviendo a vender el plan',
        texto: plan.nombre,
        exito: { titulo: plan.activo ? 'Plan sacado del catálogo' : 'Plan vuelto a vender' },
        error: {
          titulo: plan.activo ? 'No se pudo desactivar el plan' : 'No se pudo reactivar el plan',
          texto: 'Intenta de nuevo.',
        },
      })
      .subscribe({
        next: () => {
          this.accionandoId.set(null);
          this.borrador.update((planes) =>
            planes.map((p) => (p.id === plan.id ? { ...p, activo: !plan.activo } : p)),
          );
          this.publicadoSnapshot.update((snap) => {
            const anterior: PlanBorrador[] = JSON.parse(snap);
            return JSON.stringify(
              anterior.map((p) => (p.id === plan.id ? { ...p, activo: !plan.activo } : p)),
            );
          });
        },
        error: () => {
          this.accionandoId.set(null);
        },
      });
  }

  protected descartar(): void {
    const anterior: PlanBorrador[] = JSON.parse(this.publicadoSnapshot());
    this.borrador.set(anterior);
    this.caracteristicas.set(this.unionCaracteristicas(anterior));
  }

  protected publicar(): void {
    if (this.publicando() || !this.hayCambios()) {
      return;
    }

    const anterior: PlanBorrador[] = JSON.parse(this.publicadoSnapshot());
    const modificados = this.borrador().filter((plan) => {
      const previo = anterior.find((p) => p.id === plan.id);
      return !previo || JSON.stringify(previo) !== JSON.stringify(plan);
    });

    if (!modificados.length) {
      return;
    }

    this.publicando.set(true);
    this.error.set(null);

    const payload = (plan: PlanBorrador): GuardarPlanPayload => ({
      nombre: plan.nombre.trim(),
      descripcion: plan.descripcion?.trim() || null,
      precioMensual: plan.precioMensual,
      caracteristicas: plan.caracteristicas ?? [],
      activo: plan.activo,
      diasPrueba: plan.diasPrueba ?? 7,
    });

    this.alertas
      .seguir(
        forkJoin(
          modificados.map((plan) =>
            plan.id < 0
              ? this.planService.crear(payload(plan))
              : this.planService.actualizar(plan.id, payload(plan)),
          ),
        ),
        {
          titulo: 'Publicando el catálogo',
          texto: modificados.length === 1 ? modificados[0].nombre : `${modificados.length} planes`,
          exito: { titulo: 'Catálogo publicado' },
          error: { titulo: 'No se pudo publicar el catálogo', texto: 'Revisa los planes e intenta de nuevo.' },
        },
      )
      .subscribe({
        next: (guardados) => {
          this.publicando.set(false);
          // Los planes nuevos vuelven con su id real: se reemplazan por
          // posición dentro de `modificados`, en el mismo orden.
          const porIdTemporal = new Map<number, Plan>();
          modificados.forEach((plan, i) => porIdTemporal.set(plan.id, guardados[i]));
          this.borrador.update((planes) => planes.map((p) => porIdTemporal.get(p.id) ?? p));
          this.publicadoSnapshot.set(JSON.stringify(this.borrador()));
        },
        error: () => {
          this.publicando.set(false);
        },
      });
  }

  /** `(reintentar)` de `app-pantalla-estado` en el error de carga. */
  protected reintentar(): void {
    this.cargar();
  }

  /** «Volver al inicio» de la pantalla de error: va a la portada de staff. */
  protected volver(): void {
    this.router.navigateByUrl('/');
  }
}
