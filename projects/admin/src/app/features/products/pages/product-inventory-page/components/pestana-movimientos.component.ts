import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AlertaService } from '../../../../../core/ui/alerta.service';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { codigoCompra, dias, fecha, hace, num, pl } from '../../../shared/formato';
import { Movimiento, Stock, TipoMovimiento } from '../../../shared/modelos';
import { icono } from '../../../shared/ui/iconos';
import { FiltroMovimientos, RangoMovimientos, TIPOS_MOVIMIENTO, tipoDe } from '../inventario.modelo';

const FILTROS: { k: FiltroMovimientos; titulo: string }[] = [
  { k: 'todos', titulo: 'Todos' },
  { k: 'entrada', titulo: 'Entradas' },
  { k: 'salida', titulo: 'Salidas' },
  { k: 'ajuste', titulo: 'Ajustes' },
];
const RANGOS: { k: RangoMovimientos; titulo: string }[] = [
  { k: '7', titulo: '7 días' },
  { k: '30', titulo: '30 días' },
  { k: '90', titulo: '90 días' },
  { k: 'todo', titulo: 'Todo' },
];
/** Ícono y cantidad del movimiento. */
const TONO_TIPO: Record<TipoMovimiento, string> = {
  entrada: 'bg-[#e6f6ec] text-[#087b5d]',
  salida: 'bg-[#ffe6e5] text-[#b42318]',
  ajuste: 'bg-[#e0f2fe] text-[#0369a1]',
};
const TINTA_TIPO: Record<TipoMovimiento, string> = { entrada: 'text-[#087b5d]', salida: 'text-[#b42318]', ajuste: 'text-[#0369a1]' };
/** Barra "después" y punto del gráfico. */
const BARRA_TIPO: Record<TipoMovimiento, string> = { entrada: 'bg-[#29845a]', salida: 'bg-[#d82c0d]', ajuste: 'bg-[#0284c7]' };

// Gráfico de saldo: viewBox 300 × 74.
const ANCHO = 300;
const ALTO = 74;

const ymd = (d: string | Date) => {
  const x = typeof d === 'string' && d.length === 10 ? new Date(d + 'T09:00:00') : new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};
const conSigno = (n: number, texto = String(Math.abs(n))) => (n > 0 ? '+' : n < 0 ? '−' : '') + texto;
const signo = (n: number): 'sube' | 'baja' | 'igual' => (n > 0 ? 'sube' : n < 0 ? 'baja' : 'igual');

/**
 * Pestaña Movimientos de la hoja: filtros por tipo y período, cambio neto con
 * el gráfico de saldo, y el historial agrupado por día (cada movimiento se
 * despliega con el antes/después y sus acciones).
 */
@Component({
  selector: 'app-pestana-movimientos',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3.5',
    '(mouseleave)': 'encima.set(null)',
  },
  templateUrl: './pestana-movimientos.component.html',
})
export class PestanaMovimientosComponent {
  private readonly catalogo = inject(CatalogoStore);
  private readonly alertas = inject(AlertaService);

  readonly stock = input.required<Stock>();
  /** Movimientos del producto, del más nuevo al más viejo. */
  readonly movimientos = input.required<Movimiento[]>();
  readonly filtro = model<FiltroMovimientos>('todos');
  readonly rango = model<RangoMovimientos>('30');
  /** Movimiento desplegado. */
  readonly abierto = model<number | null>(null);
  readonly irReferencia = output<Movimiento>();
  readonly revertir = output<Movimiento>();

  protected readonly icono = icono;
  protected readonly filtros = FILTROS;
  protected readonly rangos = RANGOS;
  protected readonly tonoTipo = TONO_TIPO;
  protected readonly tintaTipo = TINTA_TIPO;
  protected readonly barraTipo = BARRA_TIPO;
  protected readonly encima = signal<number | null>(null);
  /** Cambia con cada filtro para que el historial vuelva a entrar animado. */
  private readonly vuelta = signal(0);

  /** Saldo disponible justo después de cada movimiento (se reconstruye hacia atrás). */
  private readonly saldoTras = computed(() => {
    const tras = new Map<number, number>();
    let saldo = this.stock().disponible;
    for (const m of this.movimientos()) {
      tras.set(m.id, saldo);
      saldo -= m.cantidad;
    }
    return tras;
  });
  private readonly enRango = computed(() => {
    const r = this.rango(), hoy = this.catalogo.hoy();
    return this.movimientos().filter((m) => r === 'todo' || dias(m.creadoEn, hoy) < +r);
  });
  private readonly lista = computed(() => {
    const f = this.filtro();
    return this.enRango().filter((m) => f === 'todos' || m.tipo === f);
  });

  protected readonly indiceFiltro = computed(() => Math.max(0, FILTROS.findIndex((f) => f.k === this.filtro())));
  protected readonly indiceRango = computed(() => Math.max(0, RANGOS.findIndex((r) => r.k === this.rango())));
  protected readonly cuentas = computed(() => {
    const m = this.enRango();
    const de = (t: TipoMovimiento) => m.filter((x) => x.tipo === t).length;
    return { todos: m.length, entrada: de('entrada'), salida: de('salida'), ajuste: de('ajuste') } satisfies Record<FiltroMovimientos, number>;
  });

  /** Entradas, salidas y cambio neto del período. */
  protected readonly flujo = computed(() => {
    const m = this.enRango();
    const entra = m.filter((x) => x.cantidad > 0).reduce((a, x) => a + x.cantidad, 0);
    const sale = m.filter((x) => x.cantidad < 0).reduce((a, x) => a - x.cantidad, 0);
    const total = Math.max(1, entra + sale), neto = entra - sale;
    return {
      entra: '+' + num(entra),
      sale: '−' + num(sale),
      anchoEntra: (entra / total) * 100,
      anchoSale: (sale / total) * 100,
      neto: conSigno(neto, num(Math.abs(neto))),
      tendencia: signo(neto),
      nota: neto > 0 ? 'Creció en el período' : neto < 0 ? 'Bajó en el período' : 'Sin cambio neto',
    };
  });

  /** Gráfico escalonado del saldo en el período (cronológico). */
  protected readonly grafico = computed(() => {
    const tras = this.saldoTras(), minimo = this.stock().minimo;
    const cronologico = this.enRango().slice().reverse();
    const inicio = cronologico.length ? tras.get(cronologico[0].id)! - cronologico[0].cantidad : this.stock().disponible;
    const saldos = [inicio, ...cronologico.map((m) => tras.get(m.id)!)];
    const tope = Math.max(1, minimo * 1.4, ...saldos), n = saldos.length;
    const x = (k: number) => (n <= 1 ? ANCHO : (k / (n - 1)) * ANCHO);
    const y = (v: number) => ALTO - 4 - (Math.max(0, v) / tope) * (ALTO - 12);
    let linea = 'M0,' + y(saldos[0]).toFixed(1);
    for (let k = 1; k < n; k++) linea += ' H' + x(k).toFixed(1) + ' V' + y(saldos[k]).toFixed(1);
    if (n === 1) linea += ' H' + ANCHO;
    return {
      cronologico, saldos, x, y, linea,
      area: linea + ' V' + ALTO + ' H0 Z',
      minimo: minimo > 0 && minimo <= tope ? (y(minimo) / ALTO) * 100 : null,
      desde: cronologico.length ? this.etiquetaDia(ymd(cronologico[0].creadoEn)) : '',
    };
  });
  /** Punto del gráfico del movimiento bajo el cursor. */
  protected readonly punto = computed(() => {
    const g = this.grafico(), id = this.encima();
    const k = id == null ? -1 : g.cronologico.findIndex((m) => m.id === id);
    if (k < 0) return null;
    const saldo = g.saldos[k + 1];
    return { izquierda: (g.x(k + 1) / ANCHO) * 100, arriba: (g.y(saldo) / ALTO) * 100, tipo: tipoDe(g.cronologico[k].tipo), texto: num(saldo) + ' u' };
  });

  /** Historial agrupado por día. */
  protected readonly dias = computed(() => {
    const tras = this.saldoTras(), minimo = this.stock().minimo, hoy = this.catalogo.hoy(), vuelta = this.vuelta();
    const grupos: { dia: string; movimientos: Movimiento[] }[] = [];
    for (const m of this.lista()) {
      const dia = ymd(m.creadoEn), ultimo = grupos[grupos.length - 1];
      if (ultimo?.dia === dia) ultimo.movimientos.push(m);
      else grupos.push({ dia, movimientos: [m] });
    }
    let orden = 0;
    return grupos.map(({ dia, movimientos }) => {
      const neto = movimientos.reduce((a, m) => a + m.cantidad, 0);
      return {
        clave: dia + '-' + vuelta,
        titulo: this.etiquetaDia(dia),
        detalle: dias(dia, hoy) > 1 ? hace(dia, hoy) : fecha(dia),
        neto: conSigno(neto),
        tendencia: signo(neto),
        filas: movimientos.map((m) => {
          const despues = tras.get(m.id)!, antes = despues - m.cantidad, escala = Math.max(1, despues, antes, minimo);
          const compra = m.referenciaTipo === 'compra';
          return {
            m,
            tipo: tipoDe(m.tipo),
            cantidad: (m.cantidad > 0 ? '+' : '−') + Math.abs(m.cantidad),
            referencia: m.referenciaTipo ? (compra ? 'Compra ' + codigoCompra(m.referenciaId ?? 0) : 'Pedido #' + m.referenciaId) : null,
            iconoReferencia: compra ? 'truck' : 'receipt',
            antes: num(antes),
            despues: num(despues),
            anchoAntes: (Math.max(0, antes) / escala) * 100,
            anchoDespues: (Math.max(0, despues) / escala) * 100,
            posicionMinimo: (minimo / escala) * 100,
            alerta: despues < minimo ? (despues <= 0 ? 'Quedó sin stock' : 'Quedó bajo el mínimo') : null,
            cuando: fecha(m.creadoEn) + ' · ' + hace(m.creadoEn, hoy),
            retraso: Math.min(orden++, 12) * 35,
          };
        }),
      };
    });
  });

  protected readonly cuenta = computed(() => pl(this.lista().length, 'movimiento', 'movimientos'));
  protected readonly textoVacio = computed(() =>
    this.movimientos().length
      ? this.enRango().length
        ? 'No hay movimientos de este tipo en el período.'
        : 'Sin movimientos en este período.'
      : 'Todavía no hay movimientos para este producto.',
  );

  protected readonly titulo = (t: TipoMovimiento) => TIPOS_MOVIMIENTO[t].titulo;
  protected readonly iconoTipo = (t: TipoMovimiento) => icono(TIPOS_MOVIMIENTO[t].icono);

  protected elegirFiltro(k: FiltroMovimientos): void {
    if (this.filtro() !== k) {
      this.filtro.set(k);
      this.reiniciar();
    }
  }
  protected elegirRango(k: RangoMovimientos): void {
    if (this.rango() !== k) {
      this.rango.set(k);
      this.reiniciar();
    }
  }
  protected verTodo(): void {
    this.filtro.set('todos');
    this.rango.set('todo');
    this.reiniciar();
  }
  protected alternar(id: number): void {
    this.abierto.update((a) => (a === id ? null : id));
  }
  protected copiar(ev: Event, m: Movimiento): void {
    ev.stopPropagation();
    const texto = `${this.titulo(tipoDe(m.tipo))} ${m.cantidad > 0 ? '+' : '−'}${Math.abs(m.cantidad)} · ${m.motivo || ''} · ${fecha(m.creadoEn)}`;
    try {
      void navigator.clipboard?.writeText(texto);
    } catch {
      /* sin portapapeles */
    }
    this.alertas.mostrar({ estado: 'info', titulo: 'Copiado al portapapeles' });
  }
  protected referencia(ev: Event, m: Movimiento): void {
    ev.stopPropagation();
    this.irReferencia.emit(m);
  }
  protected reversion(ev: Event, m: Movimiento): void {
    ev.stopPropagation();
    this.revertir.emit(m);
  }

  private reiniciar(): void {
    this.vuelta.update((v) => v + 1);
    this.abierto.set(null);
  }
  private etiquetaDia(dia: string): string {
    const d = dias(dia, this.catalogo.hoy());
    return d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : fecha(dia);
  }
}
