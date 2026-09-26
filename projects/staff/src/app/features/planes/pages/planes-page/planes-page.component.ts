import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { Plan } from '../../../../core/catalog/models/plan.model';
import { Suscripcion } from '../../../../core/catalog/models/suscripcion.model';

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
 * Catálogo de planes — rediseño del 2026-09-18 ("catálogo comparado"),
 * integrado 2026-09-21 (LEEME.md §6, siguiente componente del mismo
 * handoff tras `altas-pendientes-page`/`activar-empresa-wizard`).
 *
 * Deja de ser una tabla de cinco columnas con un modal de edición y pasa a
 * ser una matriz: **un plan por columna, las características como filas
 * compartidas**. La tesis es que un plan no significa nada solo — solo se
 * entiende al lado del que está abajo y el que está arriba, así que la
 * pantalla tiene la forma de la decisión que el staff está tomando.
 *
 * Lo que eso cambia respecto de la versión anterior:
 *
 * 1. **Se fue el modal.** `ModalComponent`, `FormularioPlan` y el textarea
 *    de "una característica por línea" ya no existen: era el punto más
 *    frágil (se editaba a ciegas, sin ver cómo quedaba el plan al lado de
 *    sus vecinos). Ahora se edita en la celda. `ModalComponent` sigue
 *    intacto, en uso en otras pantallas.
 * 2. **Se fue la columna "N ítems"**, que escondía justo lo que diferencia
 *    un plan de otro.
 * 3. **Los huecos se detectan solos** (`esHueco`): si un plan más caro NO
 *    incluye algo que sí incluye uno más barato, la celda sale en ámbar con
 *    un triángulo, y el párrafo de arriba lo dice en palabras
 *    (`lectura()`). Ese chequeo es imposible de hacer a ojo en una tabla.
 * 4. **Nada se guarda al tocar**: los cambios viven en `borrador` y se
 *    publican juntos desde la barra de abajo, porque esto lo ve el cliente
 *    en la página de precios — no es un ajuste interno.
 * 5. **Desactivar/reactivar es una acción directa** en la columna (sí pega
 *    contra el backend al instante, `DELETE /planes/:id` y `PATCH` con
 *    `activo: true`), no un badge distinto en una celda.
 *
 * SUPOSICIÓN A VALIDAR (del propio handoff): el modelo `Plan` guarda
 * `caracteristicas` como `string[]` libre por plan. La matriz necesita el
 * *union* de todas las características del catálogo (`caracteristicas`),
 * y al publicar reconstruye el array de cada plan a partir de las celdas
 * marcadas. Eso funciona con el backend actual sin cambios, pero renombrar
 * una característica es un renombre por texto en todos los planes que la
 * tienen. Si esto se usa mucho, conviene una tabla `caracteristica` real
 * con relación N:M — ver la nota de `renombrarCaracteristica`.
 *
 * Un ajuste propio sobre el handoff: `mostrarSuscripciones` pedía
 * `SuscripcionService.listar()` SIN filtro de estado, así que el conteo
 * "Empresas por plan" incluía suscripciones canceladas/vencidas — contaba
 * clientes que ya se fueron. Se agregó el filtro `'activa'`, el mismo que
 * ya usa `EmpresasPageComponent` (`listar('activa')`) para lo mismo.
 */
@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [FormsModule, InputTextModule, TablerIconComponent, PantallaEstadoComponent, CabeceraModuloComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planes-page.component.html',
})
export class PlanesPageComponent {
  private readonly planService = inject(PlanService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);

  /** Mostrar cuántas Empresas hay en cada plan. Requiere
   * `SuscripcionService.listar()` — apagalo si el endpoint no está. */
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
  /** `creadoEn` de las suscripciones activas — solo para la línea de
   * "Empresas suscritas" de la cabecera (LEEME.md §16); el conteo por
   * plan de arriba no necesita la fecha. */
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

  /** Cabecera compartida (LEEME.md §14, migrada a v2 —badge + líneas—
   *  por LEEME.md §16, 2026-09-24). Sin período: no hay una noción de
   *  "hoy" acá, es el catálogo tal como está ahora. "Empresas suscritas"
   *  y "Más elegido" solo aparecen si `mostrarSuscripciones` está
   *  prendido (mismo criterio que el resto de la pantalla).
   *
   *  Series (tabla del §16): "A la venta"/"Inactivos" son un conteo del
   *  catálogo tal como está ahora, no una serie temporal real — se les
   *  pasa una línea CONSTANTE con la cifra actual (`Array(8).fill(n)`,
   *  tal como pide la tabla), no una acumulada. "Empresas suscritas" sí
   *  tiene fecha real (`creadoEn` de cada Suscripción activa) y usa
   *  `serieAcumulada`. "Más elegido" no lleva serie: su valor es el
   *  nombre de un plan, no un número. */
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
        return `${caro.nombre} cuesta más que ${barato.nombre} pero le falta ${faltantes[0].toLowerCase()}${resto}. Revisá qué incluye cada uno antes de seguir vendiéndolos.`;
      }
      if (!extra.length) {
        return `${caro.nombre} cuesta más que ${barato.nombre} y no agrega nada. Revisá qué incluye cada uno antes de seguir vendiéndolos.`;
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
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    // Ajuste propio: 'activa' — ver la nota en el docstring de la clase.
    const peticiones = this.mostrarSuscripciones
      ? forkJoin({ planes: this.planService.listarTodos(), suscripciones: this.suscripcionService.listar('activa') })
      : forkJoin({ planes: this.planService.listarTodos() });

    peticiones.subscribe({
      next: (respuesta: { planes: { data: Plan[] }; suscripciones?: { data: Suscripcion[] } }) => {
        const planes = respuesta.planes.data;
        this.borrador.set(planes.map((p) => ({ ...p, caracteristicas: [...(p.caracteristicas ?? [])] })));
        this.publicadoSnapshot.set(JSON.stringify(this.borrador()));
        this.caracteristicas.set(this.unionCaracteristicas(planes));

        if (respuesta.suscripciones) {
          const conteo = new Map<number, number>();
          for (const s of respuesta.suscripciones.data) {
            conteo.set(s.planId, (conteo.get(s.planId) ?? 0) + 1);
          }
          this.suscripcionesPorPlan.set(conteo);
          // Solo para la línea de "Empresas suscritas" (LEEME.md §16) —
          // el conteo por plan de arriba no necesita la fecha.
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

  /** Renombre por texto: toca todos los planes que tenían la etiqueta
   * anterior. Ver la SUPOSICIÓN A VALIDAR en el comentario de la clase. */
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
        // Un plan recién creado en el borrador todavía no existe en el
        // backend, así que no tiene módulos asignados — se cargan después
        // desde el catálogo, esta pantalla no los edita (§11.6).
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
    // Tipado explícito a `Observable<unknown>`: `desactivar` devuelve
    // `Observable<void>` y `reactivar` `Observable<Plan>` — sin esto, el
    // union de los dos tipos de Observable hace que TS no pueda resolver
    // qué sobrecarga de `subscribe` aplica (el `next` de acá no usa el
    // valor emitido de todos modos, así que el tipo real no importa).
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
          error: { titulo: 'No se pudo publicar el catálogo', texto: 'Revisá los planes e intenta de nuevo.' },
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

  /** `(volver)` de `app-pantalla-estado` — mismo criterio que
   * `EmpresasPageComponent.volver()`: recarga la propia pantalla. */
  protected volver(): void {
    this.router.navigateByUrl('/planes');
  }
}
