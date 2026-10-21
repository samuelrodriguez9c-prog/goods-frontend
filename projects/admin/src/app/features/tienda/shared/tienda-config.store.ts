import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, catchError, Subscription, timer, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CategoriaService } from '../../../core/categoria/categoria.service';
import { InventarioService } from '../../../core/inventario/inventario.service';
import { ProductoCatalogo } from '../../../core/producto/models/producto.model';
import { ProductoService } from '../../../core/producto/producto.service';
import { mensajeDeError } from '../../../core/solicitudes/solicitudes.service';
import { CambiosTienda, MiTienda, TiendaService } from '../../../core/tienda/tienda.service';
import { AlertaService } from '../../../core/ui/alerta.service';
import { ProductoVista, SeccionTienda, TabVista } from '../components/tienda-vista-previa/tienda-vista-previa.component';
import {
  BORRADOR_VACIO, Borrador, CAMPOS, FilaProducto, INDICATIVO, NOMBRES, Pais, REDES, SH_ERR, SH_IN, SH_OK, SIN_CATEGORIA, SlugEstado,
  filaValida, filaVacia, igual, padreConScroll, redValida, usuarioDeRed,
} from './tienda-config.modelo';

type Exito = { titulo: string; texto?: string; accion?: { label: string; ejecutar: () => void } };

/**
 * Estado de la página «Tienda en línea», compartido por
 * sus tarjetas. Se provee en `TiendaPageComponent`: uno por visita.
 * `f` es el borrador que se edita; `guardado`, lo último que respondió el
 * servidor. Las diferencias son los «Cambios sin guardar» (alerta fija).
 */
@Injectable()
export class TiendaConfigStore {
  private readonly tiendaService = inject(TiendaService);
  private readonly productoService = inject(ProductoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly inventarioService = inject(InventarioService);
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Carga
  readonly cargando = signal(true);
  readonly errorCarga = signal<string | null>(null);
  readonly tienda = signal<MiTienda | null>(null);
  private readonly guardado = signal<Borrador | null>(null);
  readonly f = signal<Borrador>({ ...BORRADOR_VACIO });
  private readonly productos = signal<ProductoCatalogo[]>([]);
  private readonly nombresCat = signal<Map<number, string>>(new Map());
  private readonly stock = signal<Map<number, number> | null>(null);

  // UI compartida
  readonly slugEstado = signal<SlugEstado>('actual');
  readonly hov = signal<SeccionTienda | null>(null);
  readonly foco = signal<SeccionTienda | null>(null);
  readonly marcado = computed(() => this.foco() ?? this.hov());
  readonly tab = signal<TabVista>('tienda');
  readonly tecleando = signal(false);
  readonly guardando = signal(false);
  /** Cada tarjeta se registra para que `irA` la encuentre. */
  private readonly tarjetas = new Map<SeccionTienda, HTMLElement>();
  private tSlug?: Subscription;
  private tFoco?: ReturnType<typeof setTimeout>;
  private tTec?: ReturnType<typeof setTimeout>;

  // Derivados
  readonly nombreNegocio = computed(() => this.auth.currentUser()?.empresa?.nombre ?? 'Tu negocio');
  readonly prefijo = computed(() => {
    const t = this.tienda();
    return t ? t.url.slice(0, t.url.length - t.slug.length).replace(/^https?:\/\//, '') : 'tienda.goods.co/';
  });
  readonly whatsapp = computed(() => {
    const { numero, pais } = this.f();
    const d = numero.replace(/\D/g, '');
    if (!d) return null;
    return pais === 'otro' ? d : INDICATIVO[pais] + d;
  });
  readonly waOk = computed(() => {
    const w = this.whatsapp(), p = this.f().pais;
    if (w === null) return true;
    if (p === 'CO') return /^573\d{9}$/.test(w);
    if (p === 'US') return /^1\d{10}$/.test(w);
    return /^\d{8,15}$/.test(w);
  });
  readonly waLleno = computed(() => this.whatsapp() !== null && this.waOk());
  private readonly slugValido = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(this.f().slug) && this.f().slug.length <= 60);
  private readonly slugTomado = computed(() => ['ocupado', 'reservado', 'invalido'].includes(this.slugEstado()));
  readonly dirOk = computed(() => this.slugValido() && !this.slugTomado());
  readonly redesOk = computed(() => REDES.every((r) => redValida(r.k, this.f()[r.k])));
  readonly horarioOk = computed(() => this.f().horario.every(filaValida));
  readonly formOk = computed(() => this.slugValido() && this.waOk() && !this.slugTomado() && this.slugEstado() !== 'comprobando' && this.redesOk() && this.horarioOk());
  readonly publicable = computed(() => this.dirOk() && this.waLleno() && this.formOk());
  readonly activa = computed(() => this.tienda()?.activa ?? false);
  readonly teniaNumero = computed(() => !!this.tienda()?.whatsapp);

  readonly cambios = computed(() => {
    const g = this.guardado(), f = this.f();
    if (!g) return [];
    if (!this.tienda()?.guardada) return CAMPOS;
    return CAMPOS.filter((k) => !igual(f[k], g[k]));
  });
  private readonly payload = computed<CambiosTienda>(() => {
    const f = this.f();
    return {
      slug: f.slug, whatsapp: this.whatsapp(), descripcion: f.frase.trim() || null,
      logoUrl: f.logoUrl, moneda: f.moneda, mostrarAgotados: f.agotados,
      ciudad: f.ciudad.trim() || null, direccionTienda: f.direccionTienda.trim() || null,
      redes: {
        instagram: usuarioDeRed('instagram', f.instagram) || null,
        facebook: usuarioDeRed('facebook', f.facebook) || null,
        tiktok: usuarioDeRed('tiktok', f.tiktok) || null,
      },
      horario: f.horario.filter((h) => !filaVacia(h)).map((h) => ({ dias: h.dias.trim(), horas: h.cerrado ? null : h.horas.trim() })),
    };
  });

  readonly filas = computed<FilaProducto[]>(() => {
    const cats = this.nombresCat(), stock = this.stock(), ag = this.f().agotados;
    return this.productos()
      .filter((p) => p.estado !== 'descontinuado')
      .map((p) => {
        const agotado = p.estado === 'agotado';
        return { p, cat: cats.get(p.categoriaId ?? -1) ?? SIN_CATEGORIA, stock: stock?.get(p.id) ?? null, foto: p.imagenes[0]?.url ?? null,
          estado: agotado ? (ag ? 'agotado' : 'oculto') : 'visible' } as FilaProducto;
      });
  });
  readonly visibles = computed(() => this.filas().filter((r) => r.estado !== 'oculto'));

  /** Chips de la vista previa: las categorías de lo que se ve, como en la tienda pública. */
  readonly vistaCategorias = computed(() => {
    const nombres = [...new Set(this.visibles().map((r) => r.cat))];
    const con = nombres.filter((c) => c !== SIN_CATEGORIA).sort((a, b) => a.localeCompare(b, 'es'));
    if (nombres.includes(SIN_CATEGORIA)) con.push(con.length ? 'Otros' : 'Productos');
    return con;
  });
  readonly vistaProductos = computed<ProductoVista[]>(() =>
    this.visibles().map((r) => ({ id: r.p.id, nombre: r.p.nombre, precio: this.monto(r.p.precio), agotado: r.estado === 'agotado', imagen: r.foto })),
  );

  constructor() {
    forkJoin({
      tienda: this.tiendaService.mia(),
      productos: this.productoService.catalogo(),
      categorias: this.categoriaService.listar().pipe(catchError(() => of([]))),
      inventario: this.inventarioService.todo().pipe(catchError(() => of(null))), // sin permiso inventario.ver: sin barra de stock
    }).subscribe({
      next: ({ tienda, productos, categorias, inventario }) => {
        this.cargarFormulario(tienda);
        this.productos.set(productos);
        this.nombresCat.set(new Map(categorias.map((c) => [c.id, c.nombre])));
        this.stock.set(inventario ? new Map(inventario.map((x) => [x.productoId, x.cantidadDisponible])) : null);
        this.cargando.set(false);
      },
      error: (e) => { this.errorCarga.set(mensajeDeError(e, 'No pudimos cargar tu tienda.')); this.cargando.set(false); },
    });

    // Alerta fija «Cambios sin guardar» (AlertaService.fijarCambios ya usa untracked).
    effect(() => {
      const c = this.cambios();
      if (!c.length || this.cargando()) return this.alertas.fijarCambios(null);
      const n = [...new Set(c.map((k) => NOMBRES[k]))];
      const lista = n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} y ${n.at(-1)}`;
      this.alertas.fijarCambios({
        titulo: 'Cambios sin guardar',
        texto: `Cambiaste ${lista}. Guarda para que se vea en tu tienda o descarta para volver a como estaba. Atajo: Ctrl + S.`,
        estado: this.formOk() ? 'warning' : 'error',
        guardar: () => this.guardar(),
        descartar: () => this.descartar(),
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.alertas.soltarCambios();
      this.tSlug?.unsubscribe();
      clearTimeout(this.tFoco); clearTimeout(this.tTec);
    });
  }

  // Formulario
  set<K extends keyof Borrador>(k: K, v: Borrador[K], extra?: Partial<Borrador>): void {
    this.f.update((f) => ({ ...f, [k]: v, ...extra }));
    if (k === 'numero' || k === 'pais' || k === 'moneda') {
      clearTimeout(this.tTec); this.tecleando.set(true);
      this.tTec = setTimeout(() => this.tecleando.set(false), 750);
    }
  }

  alCambiarSlug(valor: string): void {
    const slug = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').slice(0, 60);
    this.f.update((f) => ({ ...f, slug }));
    this.tSlug?.unsubscribe();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return this.slugEstado.set('invalido');
    if (slug === this.guardado()?.slug) return this.slugEstado.set('actual');
    this.slugEstado.set('comprobando');
    this.tSlug = timer(500).pipe(switchMap(() => this.tiendaService.slugDisponible(slug))).subscribe({
      next: (r) => this.slugEstado.set(r.motivo === 'propia' ? 'actual' : r.disponible ? 'libre' : r.motivo === 'reservada' ? 'reservado' : r.motivo === 'invalida' ? 'invalido' : 'ocupado'),
      error: () => this.slugEstado.set('sin-verificar'),
    });
  }

  agregarSugerencia(t: string): void {
    const actual = this.f().frase.trim();
    this.set('frase', `${actual ? actual.replace(/\.?$/, '. ') : ''}${t}.`);
  }

  guardar(): void {
    if (!this.cambios().length || this.guardando()) return;
    if (!this.formOk()) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Revisa antes de guardar', texto: 'Hay un campo con error. Corrígelo y vuelve a intentarlo.' });
      if (!this.redesOk()) this.irA('redes');
      else if (!this.horarioOk()) this.irA('local');
      return;
    }
    this.enviar(this.payload(), { titulo: 'Cambios guardados', texto: this.activa() ? 'Ya se ven en tu tienda' : 'Se verán cuando la publiques' });
  }

  descartar(): void {
    const g = this.guardado();
    if (!g) return;
    this.f.set({ ...g });
    this.slugEstado.set('actual');
    this.alertas.mostrar({ estado: 'info', titulo: 'Cambios descartados' });
  }

  publicar(): void {
    if (this.activa()) return;
    if (!this.publicable()) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Revisa antes de publicar', texto: !this.dirOk() ? 'La dirección tiene un problema.' : 'Falta el WhatsApp donde te llegan los pedidos.' });
      this.irA(!this.dirOk() ? 'direccion' : 'whatsapp');
      return;
    }
    this.enviar({ ...this.payload(), activa: true }, { titulo: 'Tienda publicada', texto: 'Comparte el enlace con tus clientes', accion: { label: 'Copiar enlace', ejecutar: () => this.copiar() } });
  }

  /** Pausar (y su «Deshacer») solo cambia `activa`: lo que estaba sin guardar en el formulario se conserva. */
  pausar(): void {
    if (!this.activa()) return;
    this.tab.set('tienda');
    this.enviar({ activa: false }, { titulo: 'Tienda pausada', texto: 'Nadie la ve hasta que la publiques', accion: { label: 'Deshacer', ejecutar: () => this.enviar({ activa: true }, { titulo: 'Tienda publicada' }, 'success', true) } }, 'warning', true);
  }

  private enviar(cambios: CambiosTienda, exito: Exito, estadoExito: 'success' | 'warning' = 'success', conservarBorrador = false): void {
    this.guardando.set(true);
    const id = this.alertas.mostrar({ titulo: 'Guardando cambios', texto: 'Tienda en línea' });
    this.tiendaService.guardar(cambios).subscribe({
      next: (t) => {
        this.cargarFormulario(t, conservarBorrador);
        this.guardando.set(false);
        this.alertas.resolver(id, { estado: estadoExito, ...exito });
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        if (e.status === 409) this.slugEstado.set('ocupado');
        this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo guardar', texto: mensajeDeError(e) });
      },
    });
  }

  /** `conservarBorrador`: actualiza lo guardado sin pisar lo que el dueño está editando. */
  private cargarFormulario(t: MiTienda, conservarBorrador = false): void {
    this.tienda.set(t);
    const w = t.whatsapp ?? '';
    let pais: Pais = 'CO', numero = '';
    if (w.startsWith('57') && w.length === 12) { pais = 'CO'; numero = w.slice(2); }
    else if (w.startsWith('1') && w.length === 11) { pais = 'US'; numero = w.slice(1); }
    else if (w) { pais = 'otro'; numero = w; }
    const anterior = this.f();
    const b: Borrador = {
      slug: t.slug, pais, numero, frase: t.descripcion ?? '', logoUrl: t.logoUrl,
      logoNombre: t.logoUrl === anterior.logoUrl ? anterior.logoNombre : t.logoUrl ? (t.logoUrl.split('/').pop() ?? 'logo') : '',
      moneda: t.moneda, agotados: t.mostrarAgotados,
      ciudad: t.ciudad ?? '', direccionTienda: t.direccionTienda ?? '',
      instagram: t.redes?.instagram ?? '', facebook: t.redes?.facebook ?? '', tiktok: t.redes?.tiktok ?? '',
      horario: (t.horario ?? []).map((h) => ({ dias: h.dias, horas: h.horas ?? '', cerrado: h.horas === null })),
    };
    this.guardado.set(b);
    if (conservarBorrador) return;
    this.f.set({ ...b });
    this.slugEstado.set('actual');
  }

  // Acciones
  async copiar(): Promise<void> {
    const url = this.tienda()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.alertas.mostrar({ estado: 'success', titulo: 'Enlace copiado', texto: url.replace(/^https?:\/\//, '') });
    } catch {
      this.alertas.mostrar({ estado: 'info', titulo: 'Copia este enlace', texto: url });
    }
  }
  probarChat(): void { window.open(`https://wa.me/${this.whatsapp()}`, '_blank'); }
  irProductos(id?: number): void { this.router.navigate(['/products'], id ? { queryParams: { producto: id } } : {}); }

  registrarTarjeta(sec: SeccionTienda, el: HTMLElement): void { this.tarjetas.set(sec, el); }

  /** Lleva a la tarjeta, enfoca su primer campo y la marca 1,5 s (borde #303030). */
  irA(sec: SeccionTienda): void {
    const el = this.tarjetas.get(sec), box = el ? padreConScroll(el) : null;
    if (el && box) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16, behavior: 'smooth' });
    const campo = el?.querySelector<HTMLElement>('input:not([type=file]),textarea');
    if (campo) setTimeout(() => campo.focus({ preventScroll: true }), 400);
    clearTimeout(this.tFoco);
    this.foco.set(sec); this.tab.set('tienda');
    this.tFoco = setTimeout(() => this.foco.set(null), 1500);
  }

  // Presentación
  monto(n: number): string {
    return this.f().moneda === 'USD'
      ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${Math.round(n).toLocaleString('es-CO')}`;
  }
  /** Borde y sombra de cada tarjeta: foco (clic en la vista previa) > hover > reposo. */
  borde(k: SeccionTienda): string { return this.foco() === k ? '#303030' : this.hov() === k ? '#d4d4d4' : '#ebebeb'; }
  sombra(k: SeccionTienda): string {
    return this.foco() === k ? '0 0 0 1px #303030,0 0 0 4px rgba(48,48,48,.08),0 12px 28px -22px rgba(0,0,0,.28)' : '0 1px 2px rgba(0,0,0,.03),0 12px 28px -22px rgba(0,0,0,.28)';
  }
  sombraSlug(): string {
    const s = this.slugEstado();
    return s === 'ocupado' || s === 'reservado' || s === 'invalido' ? SH_ERR : s === 'libre' ? SH_OK : SH_IN;
  }
  sombraNumero(): string { return this.waOk() ? SH_IN : SH_ERR; }
}
