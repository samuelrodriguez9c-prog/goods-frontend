import { Injectable, computed, inject, signal } from '@angular/core';
import { IconCircleHalf2, IconEye, IconEyeOff, IconClockPause, IconFolder, IconPhoto, IconStack2 } from '@tabler/icons-angular';
import { ESTADOS_TIENDA, EstadoEnTienda, FOTOS, Foto, GRUPOS, Grupo, SecFiltro, alternar, normalizar } from './tienda-config.modelo';
import { TiendaConfigStore } from './tienda-config.store';

/**
 * Búsqueda, filtros y agrupación de la lista del catálogo (tarjeta Catálogo). Se
 * provee en `TiendaFichaCatalogoComponent`; lo comparten el popover de
 * filtros y la lista.
 */
@Injectable()
export class CatalogoFiltrosStore {
  private readonly s = inject(TiendaConfigStore);

  readonly q = signal('');
  readonly qFoco = signal(false);
  readonly fOpen = signal(false);
  readonly fSec = signal<SecFiltro>('estado');
  readonly fEst = signal<EstadoEnTienda[]>([]);
  readonly fCat = signal<string[]>([]);
  readonly fFoto = signal<Foto>('todas');
  readonly grupo = signal<Grupo>('estado');
  readonly plegados = signal<Record<string, boolean>>({});
  readonly filaHover = signal<number | null>(null);

  private readonly categoriasLista = computed(() => [...new Set(this.s.filas().map((r) => r.cat))]);
  readonly filtradas = computed(() => {
    const q = normalizar(this.q().trim()), est = this.fEst(), cat = this.fCat(), foto = this.fFoto();
    return this.s.filas().filter((r) =>
      (!q || normalizar(`${r.p.nombre} ${r.cat}`).includes(q)) && (!est.length || est.includes(r.estado)) &&
      (!cat.length || cat.includes(r.cat)) && (foto === 'todas' || (foto === 'con' ? !!r.foto : !r.foto)));
  });
  readonly grupos = computed(() => {
    const g = this.grupo();
    const claves: string[] = g === 'estado' ? Object.keys(ESTADOS_TIENDA) : g === 'categoria' ? this.categoriasLista() : ['todo'];
    return claves
      .map((k) => {
        const filas = this.filtradas().filter((r) => (g === 'estado' ? r.estado === k : g === 'categoria' ? r.cat === k : true));
        return {
          k, filas, abierto: !this.plegados()[k],
          titulo: g === 'estado' ? ESTADOS_TIENDA[k as EstadoEnTienda].t : k,
          sub: g === 'estado' ? ESTADOS_TIENDA[k as EstadoEnTienda].d : `${filas.filter((r) => r.estado !== 'oculto').length} se ven en la tienda`,
          icono: g === 'estado' ? ({ visible: IconEye, agotado: IconClockPause, oculto: IconEyeOff } as const)[k as EstadoEnTienda] : IconFolder,
        };
      })
      .filter((x) => x.filas.length);
  });
  readonly filtrosActivos = computed(() => this.fEst().length + this.fCat().length > 0 || this.fFoto() !== 'todas');
  readonly chips = computed(() => [
    ...this.fEst().map((e) => ({ label: ESTADOS_TIENDA[e].t, quitar: () => this.fEst.update((x) => x.filter((y) => y !== e)) })),
    ...this.fCat().map((c) => ({ label: c, quitar: () => this.fCat.update((x) => x.filter((y) => y !== c)) })),
    ...(this.fFoto() !== 'todas' ? [{ label: FOTOS[this.fFoto()][0], quitar: () => this.fFoto.set('todas') }] : []),
    ...(this.q().trim() ? [{ label: `“${this.q().trim()}”`, quitar: () => this.q.set('') }] : []),
  ]);
  readonly secciones = computed(() => [
    { k: 'estado' as const, t: 'Estado', icono: IconCircleHalf2, act: this.fEst().length > 0 },
    { k: 'categoria' as const, t: 'Categoría', icono: IconFolder, act: this.fCat().length > 0 },
    { k: 'foto' as const, t: 'Foto', icono: IconPhoto, act: this.fFoto() !== 'todas' },
    { k: 'agrupar' as const, t: 'Agrupar', icono: IconStack2, act: false },
  ]);
  readonly panel = computed(() => {
    const s = this.fSec(), filas = this.s.filas();
    if (s === 'estado') return { d: 'Marca uno o varios. Sin marcar, ves todos.', multi: true, rows: (Object.keys(ESTADOS_TIENDA) as EstadoEnTienda[]).map((e) => ({ t: ESTADOS_TIENDA[e].t, dot: ESTADOS_TIENDA[e].dot, n: filas.filter((r) => r.estado === e).length, on: this.fEst().includes(e), pick: () => this.fEst.update((x) => alternar(x, e)) })) };
    if (s === 'categoria') return { d: 'Las mismas que usas en Productos.', multi: true, rows: this.categoriasLista().map((c) => ({ t: c, dot: null, n: filas.filter((r) => r.cat === c).length, on: this.fCat().includes(c), pick: () => this.fCat.update((x) => alternar(x, c)) })) };
    if (s === 'foto') return { d: 'Los que no tienen foto se ven con su inicial.', multi: false, rows: (Object.keys(FOTOS) as Foto[]).map((k) => ({ t: FOTOS[k][0], dot: null, n: filas.filter((r) => k === 'todas' || (k === 'con' ? !!r.foto : !r.foto)).length, on: this.fFoto() === k, pick: () => this.fFoto.set(k) })) };
    return { d: 'Cómo se ordenan los productos en grupos plegables.', multi: false, rows: (Object.keys(GRUPOS) as Grupo[]).map((k) => ({ t: GRUPOS[k][0], dot: null, n: null, on: this.grupo() === k, pick: () => this.grupo.set(k) })) };
  });
  readonly conteoTxt = computed(() => {
    const total = this.s.filas().length, n = this.filtradas().length;
    return n === total ? `${total} productos · ${this.s.visibles().length} se ven en la tienda` : `${n} de ${total} productos`;
  });

  limpiarFiltros(): void { this.q.set(''); this.fEst.set([]); this.fCat.set([]); this.fFoto.set('todas'); }
  plegar(k: string): void { this.plegados.update((p) => ({ ...p, [k]: !p[k] })); }
}
