import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IconArrowsExchange,
  IconCalendarX,
  IconCircleMinus,
  IconCirclePlus,
  IconDownload,
  IconReportMoney,
  IconRotateClockwise,
  IconTrendingDown,
  IconTrendingUp,
  IconUserMinus,
  IconUserPlus,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { descargarRespuesta } from '../../../../core/http/descarga';
import { formatFecha, formatMonto } from '../../../../core/facturacion/facturacion.service';
import { IngresosService, montoCompacto, nombreMes } from '../../../../core/ingresos/ingresos.service';
import {
  MesIngresos,
  MovimientoIngresos,
  MovimientosDelMes,
  ResumenIngresos,
  TipoMovimiento,
} from '../../../../core/ingresos/models/ingresos.model';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { AvisoDatosNuevosComponent } from '../../../../shared/ui/aviso-datos-nuevos/aviso-datos-nuevos.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';

const RANGOS = [6, 12, 24] as const;
type Rango = (typeof RANGOS)[number];

const MOVIMIENTO: Record<TipoMovimiento, { texto: string; icono: typeof IconUserPlus; tono: string }> = {
  nueva: { texto: 'Alta', icono: IconUserPlus, tono: 'bg-[#e0f7f5] text-[#00605b]' },
  reactivacion: { texto: 'Reactivación', icono: IconRotateClockwise, tono: 'bg-[#e0f7f5] text-[#00605b]' },
  subida: { texto: 'Subió de plan', icono: IconTrendingUp, tono: 'bg-[#e0f2fe] text-[#075985]' },
  bajada: { texto: 'Bajó de plan', icono: IconTrendingDown, tono: 'bg-[#fef3c7] text-[#92400e]' },
  cambio: { texto: 'Cambió de plan', icono: IconArrowsExchange, tono: 'bg-canvas-bg text-gray-600' },
  extra_alta: { texto: 'Extra nuevo', icono: IconCirclePlus, tono: 'bg-[#e0f2fe] text-[#075985]' },
  extra_baja: { texto: 'Extra terminado', icono: IconCircleMinus, tono: 'bg-[#fef3c7] text-[#92400e]' },
  baja: { texto: 'Baja', icono: IconUserMinus, tono: 'bg-[#fee2e2] text-[#991b1b]' },
  vencida: { texto: 'Venció sin pagar', icono: IconCalendarX, tono: 'bg-[#fee2e2] text-[#991b1b]' },
};

// Gráfico: coordenadas del viewBox (el SVG escala al ancho de la tarjeta).
// Cerca del ancho real de la tarjeta en escritorio, para que el texto del
// eje quede a ~11px y no se agrande al escalar.
const ANCHO = 1120;
const ALTO = 240;
const MARGEN = { arriba: 14, abajo: 26, izq: 60, der: 8 };

/**
 * Ingresos — vista ejecutiva de §7.2 (PIVOTE_SAAS_MULTITENANT.md),
 * 2026-10-04. Contraparte de `IngresosModule` del backend: todo sale de
 * `GET /ingresos/resumen` en una sola llamada (más `/movimientos` al elegir
 * un mes que no es el actual).
 *
 * - **Cabecera**: MRR (con su línea), clientes activos, cobrado este mes,
 *   churn y MRR en riesgo (suscripciones en mora).
 * - **Evolución**: barras de MRR por mes + línea de lo cobrado. Tocar un
 *   mes lo elige para el resto de la pantalla.
 * - **Qué movió el MRR**: puente inicio → altas → subidas → bajadas →
 *   pérdidas → cierre del mes elegido, y cobrado vs. facturado.
 * - **Por plan**: empresas, en mora y participación en el MRR.
 * - **Movimientos** del mes y **Mes a mes** (tabla, exportable a CSV).
 */
@Component({
  selector: 'app-ingresos-page',
  standalone: true,
  imports: [TablerIconComponent, CabeceraModuloComponent, PantallaEstadoComponent, AvisoDatosNuevosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ingresos-page.component.html',
})
export class IngresosPageComponent {
  private readonly ingresos = inject(IngresosService);
  private readonly router = inject(Router);
  private readonly cambiosEnVivoService = inject(CambiosEnVivoService);

  protected readonly i = { modulo: IconReportMoney, descargar: IconDownload };
  protected readonly rangos = RANGOS;
  protected readonly formatMonto = formatMonto;
  protected readonly formatFecha = formatFecha;
  protected readonly montoCompacto = montoCompacto;
  protected readonly nombreMes = nombreMes;
  protected readonly grafico = { ancho: ANCHO, alto: ALTO, margen: MARGEN };

  // ── Estado ─────────────────────────────────────────────────────────────
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );
  protected readonly resumen = signal<ResumenIngresos | null>(null);
  protected readonly rango = signal<Rango>(12);
  /** Mes elegido (`YYYY-MM`); `null` = el actual. */
  protected readonly mesElegido = signal<string | null>(null);
  private readonly movimientosOtroMes = signal<MovimientosDelMes | null>(null);
  protected readonly cargandoMovimientos = signal(false);
  protected readonly exportando = signal(false);
  protected readonly cambiosEnVivo = signal(0);

  // ── Derivados ──────────────────────────────────────────────────────────
  protected readonly serie = computed(() => this.resumen()?.serie ?? []);
  protected readonly mes = computed(() => this.mesElegido() ?? this.resumen()?.actual.mes ?? '');
  protected readonly esMesActual = computed(() => this.mes() === this.resumen()?.actual.mes);

  protected readonly datosMes = computed<MesIngresos | null>(() => this.serie().find((m) => m.mes === this.mes()) ?? null);

  /** Puente del MRR del mes elegido: de dónde arrancó y qué lo movió. */
  protected readonly puente = computed(() => {
    const m = this.datosMes();
    if (!m) return null;
    const idx = this.serie().indexOf(m);
    const inicio = idx > 0 ? this.serie()[idx - 1].mrr : m.mrr - (m.mrrNuevo + m.mrrExpansion + m.mrrContraccion + m.mrrPerdido);
    const max = Math.max(inicio, m.mrr, 1);
    const paso = (texto: string, valor: number, detalle: string, color: string) => ({
      texto, valor, detalle, color, ancho: Math.min(100, (Math.abs(valor) / max) * 100),
    });
    return {
      inicio,
      cierre: m.mrr,
      neto: m.mrr - inicio,
      pasos: [
        paso('Altas y reactivaciones', m.mrrNuevo, this.cuenta(m.nuevas + m.reactivaciones, 'empresa', 'empresas'), '#087b5d'),
        paso('Subidas y extras', m.mrrExpansion, this.cuenta(m.subidas + m.extrasAltas, 'movimiento', 'movimientos'), '#075985'),
        paso('Bajadas y extras que terminan', m.mrrContraccion, this.cuenta(m.bajadas + m.extrasBajas, 'movimiento', 'movimientos'), '#b45309'),
        paso('Bajas y vencidas', m.mrrPerdido, this.cuenta(m.bajas + m.vencidas, 'empresa', 'empresas'), '#d82c0d'),
      ],
    };
  });

  /** Cobrado del mes contra lo que se le facturó (cobros generados). */
  protected readonly cobranza = computed(() => {
    const m = this.datosMes();
    if (!m) return null;
    const pct = m.facturado ? Math.min(100, Math.round((m.cobrado.COP / m.facturado) * 100)) : null;
    return { ...m, pct };
  });

  protected readonly movimientos = computed<MovimientoIngresos[]>(() => {
    if (this.esMesActual()) return this.resumen()?.movimientos.items ?? [];
    const otro = this.movimientosOtroMes();
    return otro?.mes === this.mes() ? otro.items : [];
  });

  protected readonly filasMovimientos = computed(() =>
    this.movimientos().map((mv) => ({
      ...mv,
      estilo: MOVIMIENTO[mv.tipo],
      planTexto: mv.planAnterior ? `${mv.planAnterior} → ${mv.plan}` : mv.plan,
    })),
  );

  protected readonly porPlan = computed(() => this.resumen()?.porPlan ?? []);

  protected readonly tabla = computed(() => [...this.serie()].reverse());

  /** Barras + línea del gráfico, ya en coordenadas del viewBox. */
  protected readonly barras = computed(() => {
    const s = this.serie();
    if (!s.length) return null;
    const maximo = Math.max(...s.map((m) => Math.max(m.mrr, m.cobrado.COP)), 1);
    const tope = escalaRedonda(maximo);
    const util = { ancho: ANCHO - MARGEN.izq - MARGEN.der, alto: ALTO - MARGEN.arriba - MARGEN.abajo };
    const slot = util.ancho / s.length;
    const y = (v: number) => MARGEN.arriba + util.alto - (v / tope) * util.alto;
    const items = s.map((m, idx) => {
      const x = MARGEN.izq + idx * slot;
      return {
        mes: m.mes,
        x: x + slot * 0.18,
        ancho: slot * 0.64,
        y: y(m.mrr),
        alto: Math.max(0, MARGEN.arriba + util.alto - y(m.mrr)),
        cx: x + slot / 2,
        cy: y(m.cobrado.COP),
        etiqueta: nombreMes(m.mes, true),
        titulo: `${nombreMes(m.mes)} · MRR ${formatMonto(m.mrr)} · cobrado ${formatMonto(m.cobrado.COP)}${m.cobrado.USD ? ` + ${formatMonto(m.cobrado.USD, 'USD')}` : ''} · ${m.clientes} clientes`,
        // Con 24 meses no entran todas las etiquetas: una sí, una no.
        mostrarEtiqueta: s.length <= 12 || idx % 2 === (s.length - 1) % 2,
      };
    });
    // El mes en curso todavía se está cobrando: su tramo va punteado para
    // que la caída no se lea como una baja real.
    const cerrados = items.slice(0, -1);
    const ultimo = items[items.length - 1];
    const penultimo = cerrados[cerrados.length - 1];
    return {
      items,
      linea: cerrados.map((b) => `${b.cx},${b.cy}`).join(' '),
      tramoEnCurso: penultimo ? `${penultimo.cx},${penultimo.cy} ${ultimo.cx},${ultimo.cy}` : '',
      guias: [0, 0.5, 1].map((f) => ({ y: y(tope * f), texto: montoCompacto(tope * f) })),
      base: MARGEN.arriba + util.alto,
    };
  });

  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const r = this.resumen();
    if (!r) return [];
    const a = r.actual;
    const s = r.serie;
    const mesAnterior = s.length > 1 ? nombreMes(s[s.length - 2].mes, true).split(' ')[0] : 'mes anterior';
    const variacion = a.mrrMesAnterior ? Math.round(((a.mrr - a.mrrMesAnterior) / a.mrrMesAnterior) * 1000) / 10 : null;
    const difClientes = a.clientes - a.clientesMesAnterior;
    const mesActual = s[s.length - 1];
    // El mes en curso se compara contra lo que se le facturó (no contra el
    // mes anterior completo, que siempre lo haría ver como una caída).
    const pctCobrado = mesActual?.facturado ? Math.round((a.cobrado.COP / mesActual.facturado) * 100) : null;
    const perdidos = mesActual ? mesActual.bajas + mesActual.vencidas : 0;
    return [
      {
        id: 'mrr',
        etiqueta: 'MRR',
        valor: formatMonto(a.mrr),
        tono: 'neutro',
        delta: variacion === null ? 'primer mes con ingresos' : `${variacion >= 0 ? '+' : ''}${variacion.toLocaleString('es-CO')}% vs. ${mesAnterior}`,
        deltaTono: variacion !== null && variacion < 0 ? 'peligro' : undefined,
        serie: s.map((m) => m.mrr),
        trazo: '#303030',
        titulo: 'Ingreso mensual recurrente: la suma del precio del plan de cada suscripción activa (incluye las que están en mora)',
      },
      {
        id: 'clientes',
        etiqueta: 'Clientes activos',
        valor: a.clientes,
        tono: 'neutro',
        delta: difClientes ? `${difClientes > 0 ? '+' : ''}${difClientes} vs. ${mesAnterior}` : `igual que ${mesAnterior}`,
        deltaTono: difClientes < 0 ? 'peligro' : difClientes > 0 ? 'exito' : 'apagado',
        serie: s.map((m) => m.clientes),
        titulo: 'Empresas con una suscripción activa',
      },
      {
        id: 'cobrado',
        etiqueta: 'Cobrado este mes',
        valor: formatMonto(a.cobrado.COP),
        tono: 'exito',
        delta:
          pctCobrado === null
            ? a.cobrado.USD ? `+ ${formatMonto(a.cobrado.USD, 'USD')}` : 'nada facturado aún'
            : `${pctCobrado}% de ${montoCompacto(mesActual.facturado)} facturado`,
        deltaTono: 'apagado',
        serie: s.map((m) => m.cobrado.COP),
        titulo: 'Pagos válidos en COP con fecha de pago en este mes (el detalle está en Facturación)',
      },
      {
        id: 'churn',
        etiqueta: 'Churn del mes',
        valor: `${a.churn.toLocaleString('es-CO')}%`,
        tono: a.churn ? 'peligro' : 'apagado',
        delta: perdidos ? `${perdidos} ${perdidos === 1 ? 'cliente perdido' : 'clientes perdidos'}` : 'ninguna baja',
        deltaTono: perdidos ? 'peligro' : 'apagado',
        titulo: 'Clientes perdidos este mes (bajas + vencidas sin pagar) sobre los activos al cierre del mes anterior',
      },
      {
        id: 'riesgo',
        etiqueta: 'MRR en riesgo',
        valor: formatMonto(a.enRiesgo.mrr),
        tono: a.enRiesgo.mrr ? 'aviso' : 'apagado',
        delta: a.enRiesgo.empresas
          ? `${a.enRiesgo.empresas} ${a.enRiesgo.empresas === 1 ? 'Empresa en mora' : 'Empresas en mora'}`
          : 'nadie en mora',
        deltaTono: a.enRiesgo.empresas ? 'aviso' : 'apagado',
        titulo: 'Suscripciones activas con el vencimiento pasado: si no pagan dentro de la gracia, se vencen',
      },
    ];
  });

  protected readonly badge = computed(() => {
    const a = this.resumen()?.actual;
    return a ? `ARR ${montoCompacto(a.arr)}` : '';
  });

  protected readonly lectura = computed(() => {
    const r = this.resumen();
    if (!r) return '';
    const a = r.actual;
    if (!a.clientes) return 'Todavía no hay suscripciones activas: el MRR arranca con la primera Empresa dada de alta.';
    const m = r.serie[r.serie.length - 1];
    const partes = [
      `${a.clientes} ${a.clientes === 1 ? 'cliente paga' : 'clientes pagan'} ${formatMonto(a.mrr)} al mes, ${formatMonto(a.arpa)} en promedio` +
        (a.extras.mrr ? ` (${montoCompacto(a.extras.mrr)} son extras de ${a.extras.empresas} ${a.extras.empresas === 1 ? 'Empresa' : 'Empresas'}).` : '.'),
    ];
    const altas = m.nuevas + m.reactivaciones;
    const perdidos = m.bajas + m.vencidas;
    const extras = m.extrasAltas + m.extrasBajas;
    if (altas || perdidos || m.subidas || m.bajadas || extras) {
      const neto = a.netoMrr;
      partes.push(
        `Este mes el MRR ${neto > 0 ? 'creció' : neto < 0 ? 'bajó' : 'se mantuvo'}${neto ? ` ${montoCompacto(Math.abs(neto))}` : ''}: ${this.cuenta(altas, 'alta', 'altas')}, ${this.cuenta(perdidos, 'baja', 'bajas')}${m.subidas || m.bajadas ? `, ${this.cuenta(m.subidas + m.bajadas, 'cambio de plan', 'cambios de plan')}` : ''}${extras ? `, ${this.cuenta(m.extrasAltas, 'extra nuevo', 'extras nuevos')}${m.extrasBajas ? ` y ${this.cuenta(m.extrasBajas, 'terminado', 'terminados')}` : ''}` : ''}.`,
      );
    } else {
      partes.push('Sin altas, bajas ni cambios de plan este mes.');
    }
    if (a.enRiesgo.empresas) partes.push(`${montoCompacto(a.enRiesgo.mrr)} dependen de ${this.cuenta(a.enRiesgo.empresas, 'Empresa en mora', 'Empresas en mora')}.`);
    return partes.join(' ');
  });

  constructor() {
    this.cargar();
    this.cambiosEnVivoService
      .huboCambio(['facturacion', 'suscripcion', 'empresa', 'plan'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));
  }

  // ── Carga ──────────────────────────────────────────────────────────────
  protected cargar(): void {
    this.cargando.set(!this.resumen());
    this.error.set(null);
    this.ingresos.resumen(this.rango()).subscribe({
      next: (r) => {
        this.resumen.set(r);
        // Si el mes elegido quedó fuera del rango nuevo, vuelve al actual.
        if (this.mesElegido() && !r.serie.some((m) => m.mes === this.mesElegido())) this.mesElegido.set(null);
        if (!this.esMesActual()) this.cargarMovimientos(this.mes());
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los ingresos. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  private cargarMovimientos(mes: string): void {
    this.cargandoMovimientos.set(true);
    this.ingresos.movimientos(mes).subscribe({
      next: (m) => {
        this.movimientosOtroMes.set(m);
        this.cargandoMovimientos.set(false);
      },
      error: () => this.cargandoMovimientos.set(false),
    });
  }

  // ── Acciones ───────────────────────────────────────────────────────────
  protected elegirRango(r: Rango): void {
    if (r === this.rango()) return;
    this.rango.set(r);
    this.cargar();
  }

  protected elegirMes(mes: string): void {
    const actual = this.resumen()?.actual.mes;
    this.mesElegido.set(mes === actual ? null : mes);
    if (mes !== actual) this.cargarMovimientos(mes);
  }

  protected exportar(): void {
    this.exportando.set(true);
    this.ingresos.exportar(this.rango()).subscribe({
      next: (res) => {
        descargarRespuesta(res, 'goods-ingresos.csv');
        this.exportando.set(false);
      },
      error: () => this.exportando.set(false),
    });
  }

  protected metricaClick(id: string): void {
    if (id === 'cobrado') this.router.navigateByUrl('/facturacion');
    else if (id === 'riesgo') this.router.navigateByUrl('/suscripciones');
    else this.mesElegido.set(null);
  }

  protected actualizarPorCambioEnVivo(): void {
    this.cambiosEnVivo.set(0);
    this.cargar();
  }

  protected volver(): void {
    this.router.navigateByUrl('/');
  }

  protected signo(valor: number): string {
    return valor > 0 ? `+${montoCompacto(valor)}` : valor < 0 ? montoCompacto(valor) : '$0';
  }

  private cuenta(n: number, uno: string, varios: string): string {
    return `${n} ${n === 1 ? uno : varios}`;
  }
}

/** Tope del eje: el máximo redondeado hacia arriba a 1, 2 o 5 × 10^n. */
function escalaRedonda(maximo: number): number {
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const f of [1, 2, 5, 10]) if (maximo <= f * potencia) return f * potencia;
  return 10 * potencia;
}
