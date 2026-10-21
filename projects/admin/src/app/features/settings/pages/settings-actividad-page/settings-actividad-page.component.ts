import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconBrandWhatsapp,
  IconBuildingStore,
  IconHistory,
  IconPackages,
  IconSettings,
  IconShoppingBag,
  IconTag,
  IconTruck,
  IconUser,
  IconUsers,
  TablerIconComponent,
  type TablerIcon,
} from '@tabler/icons-angular';
import { AreaActividad, ActividadEquipoService, ItemActividad, RespuestaActividad } from '../../../../core/actividad/actividad-equipo.service';

type Periodo = 'hoy' | '7d' | '30d' | '90d';

const AREAS: Record<AreaActividad, { t: string; ic: TablerIcon }> = {
  pedidos: { t: 'Pedidos', ic: IconShoppingBag },
  productos: { t: 'Productos', ic: IconTag },
  inventario: { t: 'Inventario', ic: IconPackages },
  compras: { t: 'Compras', ic: IconTruck },
  clientes: { t: 'Clientes', ic: IconUser },
  tienda: { t: 'Tienda', ic: IconBuildingStore },
  whatsapp: { t: 'WhatsApp', ic: IconBrandWhatsapp },
  equipo: { t: 'Equipo', ic: IconUsers },
  ajustes: { t: 'Ajustes', ic: IconSettings },
};
const TONOS: [string, string][] = [['#e0f7f5', '#00605b'], ['#fff1d6', '#8a5a00'], ['#eef2ff', '#3730a3'], ['#fce7f3', '#9d174d'], ['#e6f6ec', '#087b5d'], ['#f1f1f1', '#303030']];

/**
 * Settings → Actividad del equipo (Plan Plus): qué hizo cada persona de la
 * Empresa, en palabras y por día. Se filtra por período, persona y área;
 * cada acción con enlace abre lo que se tocó.
 *
 * @remarks
 * Sale de la auditoría del backend, así que solo aparece lo que se hizo
 * desde que existe la auditoría y lo que salió bien.
 */
@Component({
  selector: 'app-settings-actividad-page',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-actividad-page.component.html',
})
export class SettingsActividadPageComponent {
  private readonly api = inject(ActividadEquipoService);
  private readonly router = inject(Router);

  protected readonly i = { historial: IconHistory };
  protected readonly areas = AREAS;
  protected readonly periodos: { k: Periodo; t: string }[] = [
    { k: 'hoy', t: 'Hoy' }, { k: '7d', t: '7 días' }, { k: '30d', t: '30 días' }, { k: '90d', t: '90 días' },
  ];

  protected readonly periodo = signal<Periodo>('7d');
  protected readonly persona = signal<number | null>(null);
  protected readonly area = signal<AreaActividad | null>(null);

  protected readonly datos = signal<RespuestaActividad | null>(null);
  protected readonly items = signal<ItemActividad[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal('');

  protected readonly hayMas = computed(() => {
    const d = this.datos();
    return !!d && this.items().length < d.total;
  });
  /** Áreas con acciones en el período, de más a menos. */
  protected readonly areasConDatos = computed(() =>
    (Object.entries(this.datos()?.porArea ?? {}) as [AreaActividad, number][]).sort((a, b) => b[1] - a[1]),
  );
  protected readonly totalPeriodo = computed(() => this.datos()?.porPersona.reduce((n, p) => n + p.acciones, 0) ?? 0);
  /** Los items agrupados por día (hoy, ayer, «martes 14 de octubre»). */
  protected readonly dias = computed(() => {
    const grupos: { k: string; t: string; items: ItemActividad[] }[] = [];
    for (const it of this.items()) {
      const d = new Date(it.fecha);
      const k = d.toDateString();
      let g = grupos.at(-1);
      if (!g || g.k !== k) grupos.push((g = { k, t: nombreDia(d), items: [] }));
      g.items.push(it);
    }
    return grupos;
  });

  constructor() {
    effect(() => {
      const f = { p: this.periodo(), u: this.persona(), a: this.area() };
      untracked(() => this.cargar(f.p, f.u, f.a));
    });
  }

  private rango(p: Periodo): { desde: Date; hasta: Date } {
    const hasta = new Date();
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - { hoy: 0, '7d': 6, '30d': 29, '90d': 89 }[p]);
    return { desde, hasta };
  }

  private cargar(p: Periodo, usuarioId: number | null, area: AreaActividad | null, page = 1): void {
    if (page === 1) this.cargando.set(true);
    else this.cargandoMas.set(true);
    this.error.set('');
    this.api.listar({ ...this.rango(p), usuarioId, area, page }).subscribe({
      next: (r) => {
        this.datos.set(r);
        this.items.update((xs) => (page === 1 ? r.items : [...xs, ...r.items]));
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        this.cargandoMas.set(false);
        this.error.set(
          e instanceof HttpErrorResponse && e.status === 403
            ? 'Tu plan o tu rol no incluyen la actividad del equipo.'
            : 'No pudimos cargar la actividad. Revisa tu conexión e intenta de nuevo.',
        );
      },
    });
  }

  protected verMas(): void {
    const d = this.datos();
    if (d && !this.cargandoMas()) this.cargar(this.periodo(), this.persona(), this.area(), d.page + 1);
  }

  protected reintentar(): void {
    this.cargar(this.periodo(), this.persona(), this.area());
  }

  protected elegirPersona(id: number | null): void {
    this.persona.set(this.persona() === id ? null : id);
  }

  protected elegirArea(a: AreaActividad | null): void {
    this.area.set(this.area() === a ? null : a);
  }

  protected abrir(it: ItemActividad): void {
    if (it.enlace) void this.router.navigate([it.enlace.ruta], { queryParams: it.enlace.params ?? {} });
  }

  protected iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '·';
  }

  protected tono(id: number | undefined): [string, string] {
    return TONOS[(id ?? 0) % TONOS.length];
  }

  protected hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }
}

function nombreDia(d: Date): string {
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  const t = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
