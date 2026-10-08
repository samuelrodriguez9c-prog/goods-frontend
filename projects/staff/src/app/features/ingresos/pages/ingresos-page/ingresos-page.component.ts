import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IconArrowBackUp, IconArrowDown, IconArrowUp, IconReportMoney, TablerIconComponent } from '@tabler/icons-angular';
import { IngresosService, nombreMes } from '../../../../core/ingresos/ingresos.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { MesIngresos, MovimientoIngresos, ResumenIngresos, TipoMovimiento } from '../../../../core/ingresos/models/ingresos.model';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { MES_CORTO, MES_LARGO, corto, fmt, pct, pl, plata, signo } from '../../../../shared/ui/lista-hoja/formato';
import { ScrubValorDirective } from './scrub-valor.directive';

type Serie = 'mrr' | 'clientes' | 'cobrado';
type Cat = 'nuevo' | 'exp' | 'contr' | 'perd';
type Sim = { churn: number; nuevas: number; ticket: number; ajuste: number; exp: number };

const CAT: Record<TipoMovimiento, Cat | null> = {
  nueva: 'nuevo', reactivacion: 'nuevo', subida: 'exp', extra_alta: 'exp', bajada: 'contr', extra_baja: 'contr', baja: 'perd', vencida: 'perd', cambio: null,
};
const TIPO_TXT: Record<TipoMovimiento, string> = {
  nueva: 'Nueva', reactivacion: 'Reactivación', subida: 'Subió de plan', extra_alta: 'Extra', bajada: 'Bajó de plan', extra_baja: 'Quitó extra', baja: 'Baja', vencida: 'Vencida', cambio: 'Cambio de plan',
};
/** Etiqueta · color de barra · fondo chip · tinta chip. */
export const CATC: Record<Cat, [string, string, string, string]> = {
  nuevo: ['Nuevas', '#087b5d', '#d5f5e3', '#0c5132'],
  exp: ['Expansión', '#2be0d5', '#d9f7f5', '#00605b'],
  contr: ['Contracción', '#f0b429', '#fbe7c6', '#8a5300'],
  perd: ['Perdido', '#d82c0d', '#fde2dd', '#b42318'],
};
const COLOR_PLAN = ['#303030', '#2be0d5', '#bdbdbd', '#00a19a', '#8a8a8a'];
const CLAVE_META = 'staff.ingresos.meta';

const catDe = (m: MovimientoIngresos): Cat => CAT[m.tipo] ?? (m.deltaMrr >= 0 ? 'exp' : 'contr');
const masMes = (m: string, k: number) => { const d = new Date(+m.slice(0, 4), +m.slice(5) - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const nomMes = (m: string) => `${MES_LARGO[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

/** Promedio de los últimos 6 meses cerrados. */
function ritmo(serie: MesIngresos[]): Sim {
  const u = serie.slice(-7, -1);
  if (!u.length) return { churn: 0, nuevas: 0, ticket: 89000, ajuste: 0, exp: 0 };
  const prev = (m: MesIngresos) => serie[serie.indexOf(m) - 1]?.mrr ?? m.mrr;
  const churn = u.reduce((t, m) => t + (prev(m) ? -m.mrrPerdido / prev(m) : 0), 0) / u.length;
  const altas = u.reduce((t, m) => t + m.nuevas + m.reactivaciones, 0);
  const ticket = Math.round(u.reduce((t, m) => t + m.mrrNuevo, 0) / Math.max(1, altas) / 1000) * 1000;
  const exp = Math.round(u.reduce((t, m) => t + m.mrrExpansion + m.mrrContraccion, 0) / u.length / 1000) * 1000;
  return { churn: Math.round(churn * 1000) / 10, nuevas: Math.round(altas / u.length), ticket: ticket || 89000, ajuste: 0, exp };
}

/**
 * Ingresos v2 — lienzo + escenario (diseño `Ingresos v2 - Lienzo y escenario`).
 *
 * Una sola superficie: KPIs del mes elegido → gráfico combinado (MRR arriba,
 * entra/sale abajo, escenario a 6 meses) → frase del escenario con números
 * arrastrables → el mes (puente, planes, cobrado) + movimientos.
 *
 * Datos: `resumen(12)` (serie, porPlan, movimientos del mes en curso) y
 * `movimientos(mes)` al elegir otro mes. Todo lo demás es `computed`.
 */
@Component({
  selector: 'app-ingresos-page',
  standalone: true,
  imports: [TablerIconComponent, PantallaEstadoComponent, ScrubValorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ingresos-page.component.html',
  host: { class: 'block p-6' },
})
export class IngresosPageComponent {
  private readonly ingresos = inject(IngresosService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);

  protected readonly i = { modulo: IconReportMoney, deshacer: IconArrowBackUp, sube: IconArrowUp, baja: IconArrowDown };
  protected readonly CATC = CATC;
  protected readonly plata = plata;
  protected readonly cats: Cat[] = ['nuevo', 'exp', 'contr', 'perd'];

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed(() => (this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo'));

  protected readonly datos = signal<ResumenIngresos | null>(null);
  protected readonly movsMes = signal<Record<string, MovimientoIngresos[]>>({});
  protected readonly rango = signal<6 | 12>(12);
  protected readonly serie = signal<Serie>('mrr');
  protected readonly selI = signal<number | null>(null);
  protected readonly hov = signal<number | null>(null);
  protected readonly cat = signal<Cat | null>(null);
  protected readonly plan = signal<string | null>(null);
  protected readonly proy = signal(true);
  protected readonly sim = signal<Sim>({ churn: 0, nuevas: 0, ticket: 89000, ajuste: 0, exp: 0 });
  protected readonly meta = signal<number>(Number(localStorage.getItem(CLAVE_META)) || 0);
  protected readonly arrastrando = signal<string | null>(null);
  protected readonly nuevos = signal<ReadonlySet<string>>(new Set());

  private readonly ms = computed(() => this.datos()?.serie ?? []);
  private readonly n = computed(() => this.ms().length);
  private readonly ult = computed(() => this.ms()[this.n() - 1]);
  private readonly off = computed(() => Math.max(0, this.n() - this.rango()));
  private readonly vis = computed(() => this.ms().slice(this.off()));
  protected readonly idx = computed(() => Math.max(this.off(), this.selI() ?? this.n() - 1));
  protected readonly M = computed(() => this.ms()[this.idx()]);
  private readonly Mp = computed(() => this.ms()[this.idx() - 1] ?? null);
  private readonly real = computed(() => ritmo(this.ms()));

  constructor() {
    this.cargar();
    effect(() => localStorage.setItem(CLAVE_META, String(this.meta())));
    // En vivo: un movimiento nuevo recarga el resumen en silencio y resalta su fila.
    inject(CambiosEnVivoService)
      .huboCambio(['facturacion', 'suscripcion', 'empresa', 'plan'])
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cargar(true));
  }

  protected cargar(silencioso = false): void {
    if (!silencioso) this.cargando.set(!this.datos());
    this.error.set(null);
    const antes = new Set((this.datos()?.movimientos.items ?? []).map(this.claveMov));
    this.ingresos.resumen(12).subscribe({
      next: (r) => {
        const primera = !this.datos();
        this.datos.set(r);
        this.movsMes.update((x) => ({ ...x, [r.movimientos.mes]: r.movimientos.items }));
        if (primera) {
          this.sim.set(ritmo(r.serie));
          if (!this.meta()) this.meta.set(Math.round((r.actual.mrr * 1.4) / 100_000) * 100_000);
        }
        if (silencioso) {
          const nuevos = r.movimientos.items.filter((m) => !antes.has(this.claveMov(m)));
          if (nuevos.length) {
            this.nuevos.set(new Set(nuevos.map(this.claveMov)));
            setTimeout(() => this.nuevos.set(new Set()), 2400);
            const m = nuevos[0];
            this.alertas.mostrar({ estado: 'success', titulo: TIPO_TXT[m.tipo], texto: `${m.empresaNombre} · ${signo(m.deltaMrr)} de MRR` });
          }
        }
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los ingresos.');
        this.cargando.set(false);
      },
    });
  }
  private claveMov = (m: MovimientoIngresos) => `${m.fecha}|${m.empresaId}|${m.tipo}|${m.deltaMrr}`;

  protected elegirMes(i: number): void {
    const g = this.off() + i;
    if (g >= this.n()) return;
    this.selI.set(g);
    this.cat.set(null);
    this.plan.set(null);
    const mes = this.ms()[g].mes;
    if (!this.movsMes()[mes]) this.ingresos.movimientos(mes).subscribe((r) => this.movsMes.update((x) => ({ ...x, [mes]: r.items })));
  }

  // ── Cabecera ──────────────────────────────────────────────────────────

  protected readonly badge = computed(() => `ARR ${corto(this.datos()?.actual.arr ?? 0)}`);
  protected readonly lectura = computed(() => {
    const ms = this.ms();
    if (ms.length < 3) return '';
    const sep = ms[ms.length - 2], ago = ms[ms.length - 3], u = this.ult();
    const r = this.real();
    return `El MRR cerró ${MES_LARGO[+sep.mes.slice(5) - 1]} en ${plata(sep.mrr)} (${sep.mrr >= ago.mrr ? '+' : ''}${pct((sep.mrr - ago.mrr) / (ago.mrr || 1))} vs. ${MES_LARGO[+ago.mes.slice(5) - 1]}). ` +
      `En ${MES_LARGO[+u.mes.slice(5) - 1]} van ${pl(this.datos()?.movimientos.items.length ?? 0, 'movimiento', 'movimientos')} y ${pct(u.cobrado.COP / (u.facturado || u.mrr || 1), 0)} cobrado. ` +
      `Al ritmo de los últimos 6 meses, en ${MES_LARGO[+masMes(u.mes, 6).slice(5) - 1]} llegarías a ${plata(this.proyectar(r.churn, r.nuevas, r.ticket, 0, r.exp)[5])}.`;
  });

  // ── KPIs ──────────────────────────────────────────────────────────────

  protected readonly kpis = computed(() => {
    const M = this.M(), P = this.Mp();
    if (!M) return [];
    const arpa = M.clientes ? Math.round(M.mrr / M.clientes) : 0;
    const arpaP = P?.clientes ? Math.round(P.mrr / P.clientes) : arpa;
    const churn = P?.mrr ? -M.mrrPerdido / P.mrr : 0;
    const t = (d: number) => (d > 0 ? '#087b5d' : d < 0 ? '#b42318' : '#6b7280');
    return [
      { k: 'mrr' as Serie | null, etiqueta: 'MRR', valor: plata(M.mrr), delta: P ? `${signo(M.mrr - P.mrr)} vs. ${MES_CORTO[+P.mes.slice(5) - 1]}` : '', tinta: t(M.mrr - (P?.mrr ?? M.mrr)), ayuda: 'Suma del plan y los extras de cada suscripción activa' },
      { k: null, etiqueta: 'ARR', valor: corto(M.mrr * 12), delta: 'MRR × 12', tinta: '#6b7280', ayuda: 'Ingreso anual recurrente' },
      { k: 'clientes' as Serie, etiqueta: 'Clientes', valor: String(M.clientes), delta: P ? `${M.clientes - P.clientes >= 0 ? '+' : '−'}${Math.abs(M.clientes - P.clientes)} en el mes` : '', tinta: t(M.clientes - (P?.clientes ?? M.clientes)), ayuda: 'Empresas con suscripción activa' },
      { k: null, etiqueta: 'ARPA', valor: plata(arpa), delta: `${signo(arpa - arpaP)} por cliente`, tinta: t(arpa - arpaP), ayuda: 'MRR promedio por cliente' },
      { k: 'cobrado' as Serie, etiqueta: 'Cobrado', valor: corto(M.cobrado.COP), delta: `${pct(M.cobrado.COP / (M.facturado || M.mrr || 1), 0)} de lo facturado`, tinta: '#6b7280', ayuda: 'Pagos conciliados en el mes' },
      { k: null, etiqueta: 'Churn', valor: pct(churn), delta: `${plata(-M.mrrPerdido)} perdidos`, tinta: churn > 0.03 ? '#b42318' : '#6b7280', ayuda: 'MRR perdido sobre el MRR del mes anterior' },
    ];
  });

  // ── Escenario ─────────────────────────────────────────────────────────

  private proyectar(churn: number, nuevas: number, ticket: number, ajuste: number, exp: number): number[] {
    let m = (this.ult()?.mrr ?? 0) * (1 + ajuste / 100);
    return Array.from({ length: 6 }, () => (m = Math.max(0, Math.round(m * (1 - churn / 100) + nuevas * ticket + exp))));
  }
  protected readonly pr = computed(() => { const s = this.sim(); return this.proyectar(s.churn, s.nuevas, s.ticket, s.ajuste, s.exp); });
  private readonly prA = computed(() => { const s = this.sim(); return this.proyectar(s.churn * 0.6, s.nuevas + 1, s.ticket, s.ajuste, s.exp); });
  private readonly prB = computed(() => { const s = this.sim(); return this.proyectar(s.churn * 1.4, Math.max(0, s.nuevas - 1), s.ticket, s.ajuste, s.exp); });
  private readonly alcanza = computed(() => this.pr().findIndex((v) => v >= this.meta()));

  protected setSim(k: keyof Sim, v: number): void {
    this.sim.update((s) => ({ ...s, [k]: v }));
    this.serie.set('mrr');
    this.proy.set(true);
  }
  protected setMeta(v: number): void {
    this.meta.set(v);
    this.serie.set('mrr');
  }
  protected reset(): void {
    this.sim.set(this.real());
  }

  protected readonly esc = computed(() => {
    const s = this.sim(), r = this.real(), u = this.ult(), pr = this.pr();
    if (!u) return null;
    const fin = masMes(u.mes, 6);
    const ok = this.meta() <= u.mrr || this.alcanza() >= 0;
    return {
      churnTxt: String(s.churn).replace('.', ',') + '%', nuevasTxt: String(s.nuevas), ticketTxt: plata(s.ticket), ajusteTxt: (s.ajuste > 0 ? '+' : '') + s.ajuste + '%', metaTxt: plata(this.meta()),
      mesFin: `${MES_LARGO[+fin.slice(5) - 1]} ${fin.slice(0, 4)}`, final: corto(pr[5]),
      delta: `${pr[5] >= u.mrr ? '+' : ''}${pct((pr[5] - u.mrr) / (u.mrr || 1))} sobre hoy`, deltaTinta: pr[5] >= u.mrr ? '#087b5d' : '#b42318',
      rango: `Rango ${corto(this.prB()[5])} – ${corto(this.prA()[5])}`,
      metaNota: this.meta() <= u.mrr ? '· ya superada' : this.alcanza() >= 0 ? `· se alcanza en ${MES_LARGO[+masMes(u.mes, this.alcanza() + 1).slice(5) - 1]}` : '· no llega en 6 meses',
      metaTinta: ok ? '#087b5d' : '#b45309',
      cambiado: s.churn !== r.churn || s.nuevas !== r.nuevas || s.ticket !== r.ticket || s.ajuste !== 0,
    };
  });

  // ── Gráfico ───────────────────────────────────────────────────────────

  protected readonly graf = computed(() => {
    const vis = this.vis(), rango = vis.length;
    if (!rango) return null;
    const s = this.serie(), sim = this.sim();
    const VAL: Record<Serie, (m: MesIngresos) => number> = { mrr: (m) => m.mrr, clientes: (m) => m.clientes, cobrado: (m) => m.cobrado.COP };
    const conProy = s === 'mrr' && this.proy();
    const slots = rango + (conProy ? 6 : 0);
    const vals = vis.map(VAL[s]);
    const pr = this.pr(), prA = this.prA(), prB = this.prB();
    const mx = Math.max(...vals, ...(conProy ? prA : []), s === 'mrr' ? this.meta() : 0) * 1.12 || 1;
    const X = (i: number) => 18 + (i * 964) / Math.max(1, slots - 1);
    const Y = (v: number) => 180 - (v / mx) * 165;
    const lin = (a: [number, number][]) => a.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const pts = vals.map((v, i) => [X(i), Y(v)] as [number, number]);
    const last = pts[pts.length - 1];
    const pP = [last, ...pr.map((v, k) => [X(rango + k), Y(v)] as [number, number])];
    const bA = [last, ...prA.map((v, k) => [X(rango + k), Y(v)] as [number, number])];
    const bB = [last, ...prB.map((v, k) => [X(rango + k), Y(v)] as [number, number])];
    const paso = (() => { const r = mx / 4; const p10 = Math.pow(10, Math.floor(Math.log10(r))); return Math.ceil(r / p10) * p10; })();
    const ticks: number[] = [];
    for (let v = paso; v < mx; v += paso) ticks.push(v);

    // Entra / sale
    let prev = (this.ult()?.mrr ?? 0) * (1 + sim.ajuste / 100);
    const fr = vis.map((m) => ({ n: m.mrrNuevo, e: Math.max(0, m.mrrExpansion), c: Math.min(0, m.mrrContraccion), p: m.mrrPerdido }));
    const fp = conProy ? pr.map((v) => { const r = { n: sim.nuevas * sim.ticket, e: Math.max(0, sim.exp), c: Math.min(0, sim.exp), p: (-prev * sim.churn) / 100 }; prev = v; return r; }) : [];
    const fl = [...fr, ...fp];
    const fmax = Math.max(1, ...fl.map((f) => Math.max(f.n + f.e, -(f.c + f.p))));
    const FS = 36 / fmax, BW = Math.min(26, (964 / Math.max(1, slots - 1)) * 0.42);
    const flujos: { x: number; y: number; w: number; h: number; fill: string; stroke: string; op: number }[] = [];
    fl.forEach((f, i) => {
      const x = X(i) - BW / 2, fut = i >= rango;
      const add = (y: number, h: number, c: Cat) => flujos.push({ x, y, w: BW, h: Math.max(0, h), fill: fut ? 'transparent' : CATC[c][1], stroke: fut ? CATC[c][1] : 'none', op: fut ? 0.9 : !this.cat() || this.cat() === c ? 1 : 0.22 });
      add(285 - f.n * FS, f.n * FS, 'nuevo');
      add(285 - (f.n + f.e) * FS, f.e * FS, 'exp');
      add(285, -f.c * FS, 'contr');
      add(285 - f.c * FS, -f.p * FS, 'perd');
    });

    const hv = this.hov();
    const foco = hv ?? this.idx() - this.off();
    const enProy = foco >= rango;
    const vF = enProy ? pr[foco - rango] : vals[foco];
    const vA = enProy ? (foco === rango ? vals[rango - 1] : pr[foco - rango - 1]) : foco > 0 ? vals[foco - 1] : VAL[s](this.ms()[this.off() - 1] ?? vis[0]);
    const dl = vF - vA;
    const fmtS = s === 'clientes' ? (v: number) => `${Math.round(v)} clientes` : plata;
    const dlTxt = s === 'clientes' ? `${dl >= 0 ? '+' : '−'}${Math.abs(dl)}` : `${signo(dl)}${vA ? ` · ${dl >= 0 ? '+' : ''}${pct(dl / vA)}` : ''}`;
    const mesF = masMes(vis[0].mes, foco);
    const fh = hv !== null ? fl[hv] : null;
    const colW = 964 / Math.max(1, slots - 1);
    const futX = X(rango - 0.5);

    return {
      titulo: { mrr: 'MRR', clientes: 'Clientes activos', cobrado: 'Cobrado' }[s] + (enProy ? ' proyectado' : ''),
      valor: fmtS(vF), delta: dlTxt, deltaTinta: dl > 0 ? '#087b5d' : dl < 0 ? '#b42318' : '#6b7280',
      mes: (enProy ? 'Escenario · ' : '') + nomMes(mesF) + (mesF === this.ult().mes && !enProy ? ` · al ${fmt(new Date().toISOString())}` : ''),
      conProy, conMeta: s === 'mrr',
      ejeY: ticks.map((v) => ({ top: (Y(v) / 340) * 100, texto: s === 'clientes' ? String(v) : corto(v) })),
      selX: X(this.idx() - this.off()) - colW / 2, colW,
      area: `M${pts[0][0]} 180 ${lin(pts).replace('M', 'L')} L${last[0]} 180 Z`, linea: lin(pts),
      proy: conProy ? lin(pP) : '', banda: conProy ? `${lin(bA)} ${lin([...bB].reverse()).replace('M', 'L')} Z` : '',
      metaY: Y(this.meta()),
      flujos, futX: conProy ? futX : 1000, futW: conProy ? 1000 - futX : 0, futLabel: futX / 10 + 1,
      hx: hv !== null ? X(hv) : null,
      cols: Array.from({ length: slots }, (_, i) => ({ i, x: X(i) - colW / 2 })),
      puntos: [...pts, ...(conProy ? pP.slice(1) : [])].map((p, i) => ({ left: p[0] / 10, top: (p[1] / 340) * 100, fondo: i >= rango ? '#00a19a' : '#303030', op: i === foco ? 1 : i === this.idx() - this.off() ? 0.5 : 0 })),
      tip: hv === null ? null : {
        left: X(hv) / 10, tx: X(hv) < 160 ? 'translateX(8px)' : X(hv) > 840 ? 'translateX(calc(-100% - 8px))' : 'translateX(-50%)',
        mes: (enProy ? 'Escenario · ' : '') + nomMes(mesF), valor: fmtS(vF),
        filas: fh ? ([['Nuevas', 'nuevo', fh.n], ['Expansión', 'exp', fh.e], ['Contracción', 'contr', fh.c], ['Perdido', 'perd', fh.p]] as [string, Cat, number][])
          .filter((r) => Math.round(r[2])).map(([k, c, v]) => ({ k, color: CATC[c][1], v: `${v >= 0 ? '+' : '−'}${corto(Math.abs(v))}`, tinta: v >= 0 ? '#5fe39b' : '#ff8f7a' })) : [],
      },
      ejeX: Array.from({ length: slots }, (_, i) => { const m = masMes(vis[0].mes, i); return { left: X(i) / 10, texto: MES_CORTO[+m.slice(5) - 1] + (m.endsWith('-01') ? ' ' + m.slice(2, 4) : ''), fut: i >= rango, sel: i === this.idx() - this.off() }; }),
    };
  });

  // ── El mes ────────────────────────────────────────────────────────────

  protected readonly puente = computed(() => {
    const M = this.M();
    if (!M) return null;
    const ini = this.Mp()?.mrr ?? M.mrr - M.mrrNuevo - M.mrrExpansion - M.mrrContraccion - M.mrrPerdido;
    const raw: [string, string, number][] = [['ini', 'Inicio', ini], ['nuevo', 'Nuevas', M.mrrNuevo], ['exp', 'Expansión', M.mrrExpansion], ['contr', 'Contracción', M.mrrContraccion], ['perd', 'Perdido', M.mrrPerdido], ['fin', 'Cierre', M.mrr]];
    let run = ini;
    const segs = raw.map(([k, et, v]) => { if (k === 'ini' || k === 'fin') return { k, et, v, a: 0, b: v }; const a = run; run += v; return { k, et, v, a: Math.min(a, run), b: Math.max(a, run) }; });
    const lo = Math.min(...segs.filter((x) => x.k !== 'ini' && x.k !== 'fin').map((x) => x.a), ini, M.mrr) * 0.82;
    const hi = Math.max(...segs.map((x) => x.b)) * 1.06;
    const rg = Math.max(1, hi - lo);
    const cuenta = (c: Cat) => (this.movsMes()[M.mes] ?? []).filter((x) => catDe(x) === c).length;
    return {
      mes: nomMes(M.mes) + (this.idx() === this.n() - 1 ? ' · en curso' : ''),
      filas: segs.map((x) => {
        const fijo = x.k === 'ini' || x.k === 'fin';
        const c = x.k as Cat;
        return {
          k: x.k, fijo, etiqueta: x.et, valor: fijo ? plata(x.v) : signo(x.v),
          left: fijo ? 0 : ((x.a - lo) / rg) * 100, ancho: fijo ? ((x.v - lo) / rg) * 100 : Math.max(1, ((x.b - x.a) / rg) * 100),
          color: fijo ? (x.k === 'fin' ? '#303030' : '#d4d4d4') : CATC[c][1], op: fijo || !this.cat() || this.cat() === c ? 1 : 0.3,
          tinta: fijo ? '#111827' : x.v ? CATC[c][3] : '#9ca3af', activa: this.cat() === x.k,
          cuenta: fijo ? (x.k === 'ini' ? `cierre de ${MES_CORTO[+(this.Mp()?.mes ?? M.mes).slice(5) - 1]}` : pl(M.clientes, 'cliente', 'clientes')) : cuenta(c) ? pl(cuenta(c), 'movimiento', 'movimientos') : 'sin movimientos',
        };
      }),
    };
  });

  protected alternarCat(k: string): void {
    if (k === 'ini' || k === 'fin') return;
    this.cat.update((c) => (c === k ? null : (k as Cat)));
  }

  /**
   * Planes del mes elegido (2026-10-07: cada mes de la serie trae su
   * `porPlan`). El mes en curso usa el `porPlan` del resumen, que además
   * sabe cuántas están en mora hoy.
   */
  protected readonly planes = computed(() => {
    const M = this.M();
    const actual = this.datos()?.porPlan ?? [];
    const esActual = !M || M.mes === this.ms()[this.ms().length - 1]?.mes;
    const pp: { plan: string; empresas: number; mrr: number; enMora?: number }[] = esActual ? actual : (M.porPlan ?? []);
    const tot = pp.reduce((t, p) => t + p.mrr, 0) || 1;
    return pp.map((p, k) => ({ plan: p.plan, grow: Math.max(1, p.mrr), color: COLOR_PLAN[k % COLOR_PLAN.length], op: !this.plan() || this.plan() === p.plan ? 1 : 0.3, pct: pct(p.mrr / tot, 0), sub: `${p.empresas} empresas · ${plata(p.mrr)}${p.enMora ? ` · ${p.enMora} en mora` : ''}`, activo: this.plan() === p.plan }));
  });

  protected readonly cobro = computed(() => {
    const M = this.M();
    if (!M) return null;
    const base = M.facturado || M.mrr || 1;
    return { pct: pct(M.cobrado.COP / base, 0), ancho: Math.min(100, (M.cobrado.COP / base) * 100), nota: `${corto(M.cobrado.COP)} de ${corto(base)}` };
  });

  protected readonly movs = computed(() => {
    const M = this.M();
    if (!M) return null;
    const items = (this.movsMes()[M.mes] ?? [])
      .filter((x) => (!this.cat() || catDe(x) === this.cat()) && (!this.plan() || x.plan === this.plan() || x.planAnterior === this.plan()))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return {
      resumen: `${pl(items.length, 'movimiento', 'movimientos')} · neto ${signo(items.reduce((t, x) => t + x.deltaMrr, 0))}`,
      filtros: [this.cat() && { texto: CATC[this.cat()!][0], quitar: () => this.cat.set(null) }, this.plan() && { texto: `Plan ${this.plan()}`, quitar: () => this.plan.set(null) }].filter(Boolean) as { texto: string; quitar: () => void }[],
      filas: items.map((x) => ({
        clave: this.claveMov(x), fecha: fmt(x.fecha), empresa: x.empresaNombre, barra: CATC[catDe(x)][1],
        detalle: `${TIPO_TXT[x.tipo]} · ${x.planAnterior ? `${x.planAnterior} → ${x.plan}` : x.plan}`,
        delta: signo(x.deltaMrr), tinta: x.deltaMrr >= 0 ? '#087b5d' : '#b42318', nuevo: this.nuevos().has(this.claveMov(x)),
      })),
    };
  });

  protected exportar(): void {
    const id = this.alertas.mostrar({ titulo: 'Preparando exportación', texto: 'goods-ingresos.csv' });
    this.ingresos.exportar(this.rango()).subscribe({
      next: (r) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(r.body!);
        a.download = 'goods-ingresos.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        this.alertas.resolver(id, { estado: 'success', titulo: 'Exportación lista', texto: `goods-ingresos.csv · ${this.rango()} meses` });
      },
      error: () => this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo exportar' }),
    });
  }

  protected readonly nombreMes = nombreMes;
  protected volver(): void {
    this.router.navigateByUrl('/ingresos');
  }
}
