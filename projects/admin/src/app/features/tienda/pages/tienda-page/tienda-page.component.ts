import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import {
  IconAdjustmentsHorizontal, IconAlertCircle, IconBrandWhatsapp, IconBuildingStore, IconChevronDown, IconCircleCheck,
  IconCircleCheckFilled, IconCircleDashed, IconCircleHalf2, IconCircleXFilled, IconCloudUpload, IconCopy, IconExternalLink,
  IconEye, IconEyeOff, IconFolder, IconIdBadge2, IconLayoutGrid, IconLink, IconListCheck, IconPackage, IconPencil, IconPhoto,
  IconPhotoOff, IconPlayerPause, IconPlus, IconReplace, IconRocket, IconSearch, IconSend, IconStack2, IconTrash, IconUpload,
  IconWorld, IconX, IconCheck, IconClockPause, TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin, of, catchError, Subscription, timer, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CategoriaService } from '../../../../core/categoria/categoria.service';
import { InventarioService } from '../../../../core/inventario/inventario.service';
import { ProductoCatalogo } from '../../../../core/producto/models/producto.model';
import { ProductoService } from '../../../../core/producto/producto.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { CambiosTienda, MiTienda, MonedaTienda, TiendaService } from '../../../../core/tienda/tienda.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { ProductoVista, SeccionTienda, TabVista, TiendaVistaPreviaComponent } from '../../components/tienda-vista-previa/tienda-vista-previa.component';

type Pais = 'CO' | 'US' | 'otro';
type SlugEstado = 'actual' | 'comprobando' | 'libre' | 'ocupado' | 'invalido';
type EstadoEnTienda = 'visible' | 'agotado' | 'oculto';
type SecFiltro = 'estado' | 'categoria' | 'foto' | 'agrupar';
type Foto = 'todas' | 'con' | 'sin';
type Grupo = 'estado' | 'categoria' | 'ninguno';

interface Borrador {
  slug: string; pais: Pais; numero: string; frase: string;
  logoUrl: string | null; logoNombre: string; moneda: MonedaTienda; agotados: boolean;
}
interface FilaProducto { p: ProductoCatalogo; estado: EstadoEnTienda; cat: string; stock: number | null; foto: string | null }

const INDICATIVO: Record<Exclude<Pais, 'otro'>, string> = { CO: '57', US: '1' };
const NOMBRES: Record<keyof Borrador, string> = { slug: 'la dirección', pais: 'el país', numero: 'el WhatsApp', frase: 'la frase', logoUrl: 'el logo', logoNombre: 'el logo', moneda: 'la moneda', agotados: 'los agotados' };
const CAMPOS: (keyof Borrador)[] = ['slug', 'pais', 'numero', 'frase', 'logoUrl', 'moneda', 'agotados'];
export const ESTADOS_TIENDA: Record<EstadoEnTienda, { t: string; d: string; dot: string }> = {
  visible: { t: 'Visible', d: 'Se ve y se puede pedir', dot: '#2fa65a' },
  agotado: { t: 'Agotado', d: 'Se ve con la etiqueta, no se puede pedir', dot: '#ffb904' },
  oculto: { t: 'Oculto', d: 'Agotado y escondido de la tienda', dot: '#a3a3a3' },
};
const FOTOS: Record<Foto, [string, string]> = { todas: ['Todas', 'Con y sin foto'], con: ['Con foto', 'Se ven con su imagen'], sin: ['Sin foto', 'Se ven con la inicial'] };
const GRUPOS: Record<Grupo, [string, string]> = { estado: ['Estado en la tienda', 'Visibles, agotados y ocultos'], categoria: ['Categoría', 'Las de Productos'], ninguno: ['Sin agrupar', 'Una sola lista'] };
const SUGERENCIAS_FRASE = ['Entregas el mismo día', 'Pagos por Nequi', 'Lunes a sábado'];
const MAX_LOGO = 4e6;

/**
 * Tienda en línea v6 (handoff-tienda-en-linea · referencia «Configuración v6»).
 * Columna izquierda: Dirección · WhatsApp (con chat de ejemplo) · Presentación · Catálogo.
 * Columna derecha (sticky): estado Publicada/Pausada + requisitos + compartir, y la
 * vista previa del celular con la tienda v2 (pestañas Tienda / Chat / Estado).
 * Pasar el mouse por una tarjeta la marca en la vista previa; clic en la vista previa lleva a editarla.
 */
@Component({
  selector: 'app-tienda-page',
  imports: [FormsModule, NgTemplateOutlet, TablerIconComponent, TiendaVistaPreviaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
  host: { '(document:keydown)': 'atajo($event)', '(document:click)': 'fOpen.set(false)' },
})
export class TiendaPageComponent {
  private readonly tiendaService = inject(TiendaService);
  private readonly productoService = inject(ProductoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly inventarioService = inject(InventarioService);
  private readonly uploadService = inject(UploadService);
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly i = {
    tienda: IconBuildingStore, wa: IconBrandWhatsapp, copiar: IconCopy, abrir: IconExternalLink, link: IconLink, check: IconCheck,
    checkCirc: IconCircleCheck, checkLleno: IconCircleCheckFilled, xLleno: IconCircleXFilled, alerta: IconAlertCircle, enviar: IconSend,
    badge: IconIdBadge2, subir: IconCloudUpload, upload: IconUpload, reemplazar: IconReplace, quitar: IconTrash, plus: IconPlus,
    grid: IconLayoutGrid, paquete: IconPackage, buscar: IconSearch, cerrar: IconX, filtros: IconAdjustmentsHorizontal, chevron: IconChevronDown,
    lapiz: IconPencil, sinFoto: IconPhotoOff, foto: IconPhoto, carpeta: IconFolder, mitad: IconCircleHalf2, pila: IconStack2,
    ojo: IconEye, ojoNo: IconEyeOff, pausa: IconClockPause, mundo: IconWorld, pausar: IconPlayerPause, cohete: IconRocket, lista: IconListCheck,
    estado: IconCircleDashed,
  };
  protected readonly ESTADOS = ESTADOS_TIENDA;

  // ── Carga ─────────────────────────────────────────────────────────────
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly tienda = signal<MiTienda | null>(null);
  private readonly guardado = signal<Borrador | null>(null);
  protected readonly f = signal<Borrador>({ slug: '', pais: 'CO', numero: '', frase: '', logoUrl: null, logoNombre: '', moneda: 'COP', agotados: true });
  private readonly productos = signal<ProductoCatalogo[]>([]);
  private readonly nombresCat = signal<Map<number, string>>(new Map());
  private readonly stock = signal<Map<number, number> | null>(null);

  // ── UI ────────────────────────────────────────────────────────────────
  protected readonly slugEstado = signal<SlugEstado>('actual');
  protected readonly hov = signal<SeccionTienda | null>(null);
  protected readonly foco = signal<SeccionTienda | null>(null);
  protected readonly marcado = computed(() => this.foco() ?? this.hov());
  protected readonly tab = signal<TabVista>('tienda');
  protected readonly tecleando = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly guardando = signal(false);

  // ── Lista del catálogo ────────────────────────────────────────────────
  protected readonly q = signal('');
  protected readonly qFoco = signal(false);
  protected readonly fOpen = signal(false);
  protected readonly fSec = signal<SecFiltro>('estado');
  protected readonly fEst = signal<EstadoEnTienda[]>([]);
  protected readonly fCat = signal<string[]>([]);
  protected readonly fFoto = signal<Foto>('todas');
  protected readonly grupo = signal<Grupo>('estado');
  protected readonly plegados = signal<Record<string, boolean>>({});
  protected readonly filaHover = signal<number | null>(null);

  private readonly secDireccion = viewChild<ElementRef<HTMLElement>>('secDireccion');
  private readonly secWhatsapp = viewChild<ElementRef<HTMLElement>>('secWhatsapp');
  private readonly secMarca = viewChild<ElementRef<HTMLElement>>('secMarca');
  private readonly secCatalogo = viewChild<ElementRef<HTMLElement>>('secCatalogo');
  private seccionEl(k: SeccionTienda): HTMLElement | undefined {
    return { direccion: this.secDireccion, whatsapp: this.secWhatsapp, marca: this.secMarca, catalogo: this.secCatalogo }[k]()?.nativeElement;
  }
  private tSlug?: Subscription;
  private tFoco?: ReturnType<typeof setTimeout>;
  private tTec?: ReturnType<typeof setTimeout>;

  // ── Derivados ─────────────────────────────────────────────────────────
  protected readonly nombreNegocio = computed(() => this.auth.currentUser()?.empresa?.nombre ?? 'Tu negocio');
  protected readonly prefijo = computed(() => {
    const t = this.tienda();
    return t ? t.url.slice(0, t.url.length - t.slug.length).replace(/^https?:\/\//, '') : 'tienda.goods.co/';
  });
  protected readonly whatsapp = computed(() => {
    const { numero, pais } = this.f();
    const d = numero.replace(/\D/g, '');
    if (!d) return null;
    return pais === 'otro' ? d : INDICATIVO[pais] + d;
  });
  protected readonly waOk = computed(() => {
    const w = this.whatsapp(), p = this.f().pais;
    if (w === null) return true;
    if (p === 'CO') return /^573\d{9}$/.test(w);
    if (p === 'US') return /^1\d{10}$/.test(w);
    return /^\d{8,15}$/.test(w);
  });
  protected readonly waLleno = computed(() => this.whatsapp() !== null && this.waOk());
  protected readonly numeroFormateado = computed(() => {
    const { pais, numero } = this.f();
    const d = numero.replace(/\D/g, '');
    return pais === 'otro' ? `+${d}` : `+${INDICATIVO[pais]} ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`.trim();
  });
  protected readonly numeroError = computed(() => {
    if (this.waOk()) return 'Sin número no se puede publicar la tienda.';
    const p = this.f().pais;
    return p === 'CO' ? 'Un celular de Colombia tiene 10 dígitos y empieza por 3.' : p === 'US' ? 'Un número de EE. UU. tiene 10 dígitos.' : 'Escribe el indicativo y el número, entre 8 y 15 dígitos.';
  });
  private readonly slugValido = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(this.f().slug) && this.f().slug.length <= 60);
  protected readonly dirOk = computed(() => this.slugValido() && this.slugEstado() !== 'ocupado' && this.slugEstado() !== 'invalido');
  protected readonly formOk = computed(() => this.slugValido() && this.waOk() && this.slugEstado() !== 'ocupado' && this.slugEstado() !== 'comprobando');
  protected readonly publicable = computed(() => this.dirOk() && this.waLleno() && this.formOk());
  protected readonly activa = computed(() => this.tienda()?.activa ?? false);
  protected readonly teniaNumero = computed(() => !!this.tienda()?.whatsapp);

  protected readonly cambios = computed(() => {
    const g = this.guardado(), f = this.f();
    if (!g) return [];
    if (!this.tienda()?.guardada) return CAMPOS;
    return CAMPOS.filter((k) => f[k] !== g[k]);
  });
  private readonly payload = computed<CambiosTienda>(() => ({
    slug: this.f().slug, whatsapp: this.whatsapp(), descripcion: this.f().frase.trim() || null,
    logoUrl: this.f().logoUrl, moneda: this.f().moneda, mostrarAgotados: this.f().agotados,
  }));

  protected readonly filas = computed<FilaProducto[]>(() => {
    const cats = this.nombresCat(), stock = this.stock(), ag = this.f().agotados;
    return this.productos()
      .filter((p) => p.estado !== 'descontinuado')
      .map((p) => {
        const agotado = p.estado === 'agotado';
        return { p, cat: cats.get(p.categoriaId ?? -1) ?? 'Sin categoría', stock: stock?.get(p.id) ?? null, foto: p.imagenes[0]?.url ?? null,
          estado: agotado ? (ag ? 'agotado' : 'oculto') : 'visible' } as FilaProducto;
      });
  });
  protected readonly visibles = computed(() => this.filas().filter((r) => r.estado !== 'oculto'));
  protected readonly categoriasLista = computed(() => [...new Set(this.filas().map((r) => r.cat))]);
  protected readonly filtradas = computed(() => {
    const q = normalizar(this.q().trim()), est = this.fEst(), cat = this.fCat(), foto = this.fFoto();
    return this.filas().filter((r) =>
      (!q || normalizar(`${r.p.nombre} ${r.cat}`).includes(q)) && (!est.length || est.includes(r.estado)) &&
      (!cat.length || cat.includes(r.cat)) && (foto === 'todas' || (foto === 'con' ? !!r.foto : !r.foto)));
  });
  protected readonly grupos = computed(() => {
    const g = this.grupo();
    const claves: string[] = g === 'estado' ? Object.keys(ESTADOS_TIENDA) : g === 'categoria' ? this.categoriasLista() : ['todo'];
    return claves
      .map((k) => {
        const filas = this.filtradas().filter((r) => (g === 'estado' ? r.estado === k : g === 'categoria' ? r.cat === k : true));
        return {
          k, filas, abierto: !this.plegados()[k],
          titulo: g === 'estado' ? ESTADOS_TIENDA[k as EstadoEnTienda].t : k,
          sub: g === 'estado' ? ESTADOS_TIENDA[k as EstadoEnTienda].d : `${filas.filter((r) => r.estado !== 'oculto').length} se ven en la tienda`,
          icono: g === 'estado' ? ({ visible: this.i.ojo, agotado: this.i.pausa, oculto: this.i.ojoNo } as const)[k as EstadoEnTienda] : this.i.carpeta,
        };
      })
      .filter((x) => x.filas.length);
  });
  protected readonly filtrosActivos = computed(() => this.fEst().length + this.fCat().length > 0 || this.fFoto() !== 'todas');
  protected readonly chips = computed(() => [
    ...this.fEst().map((e) => ({ label: ESTADOS_TIENDA[e].t, quitar: () => this.fEst.update((x) => x.filter((y) => y !== e)) })),
    ...this.fCat().map((c) => ({ label: c, quitar: () => this.fCat.update((x) => x.filter((y) => y !== c)) })),
    ...(this.fFoto() !== 'todas' ? [{ label: FOTOS[this.fFoto()][0], quitar: () => this.fFoto.set('todas') }] : []),
    ...(this.q().trim() ? [{ label: `“${this.q().trim()}”`, quitar: () => this.q.set('') }] : []),
  ]);
  protected readonly secciones = computed(() => [
    { k: 'estado' as const, t: 'Estado', icono: this.i.mitad, act: this.fEst().length > 0 },
    { k: 'categoria' as const, t: 'Categoría', icono: this.i.carpeta, act: this.fCat().length > 0 },
    { k: 'foto' as const, t: 'Foto', icono: this.i.foto, act: this.fFoto() !== 'todas' },
    { k: 'agrupar' as const, t: 'Agrupar', icono: this.i.pila, act: false },
  ]);
  protected readonly panel = computed(() => {
    const s = this.fSec(), filas = this.filas();
    if (s === 'estado') return { d: 'Marca uno o varios. Sin marcar, ves todos.', multi: true, rows: (Object.keys(ESTADOS_TIENDA) as EstadoEnTienda[]).map((e) => ({ t: ESTADOS_TIENDA[e].t, dot: ESTADOS_TIENDA[e].dot, n: filas.filter((r) => r.estado === e).length, on: this.fEst().includes(e), pick: () => this.fEst.update((x) => alternar(x, e)) })) };
    if (s === 'categoria') return { d: 'Las mismas que usas en Productos.', multi: true, rows: this.categoriasLista().map((c) => ({ t: c, dot: null, n: filas.filter((r) => r.cat === c).length, on: this.fCat().includes(c), pick: () => this.fCat.update((x) => alternar(x, c)) })) };
    if (s === 'foto') return { d: 'Los que no tienen foto se ven con su inicial.', multi: false, rows: (Object.keys(FOTOS) as Foto[]).map((k) => ({ t: FOTOS[k][0], dot: null, n: filas.filter((r) => k === 'todas' || (k === 'con' ? !!r.foto : !r.foto)).length, on: this.fFoto() === k, pick: () => this.fFoto.set(k) })) };
    return { d: 'Cómo se ordenan los productos en grupos plegables.', multi: false, rows: (Object.keys(GRUPOS) as Grupo[]).map((k) => ({ t: GRUPOS[k][0], dot: null, n: null, on: this.grupo() === k, pick: () => this.grupo.set(k) })) };
  });
  protected readonly conteoTxt = computed(() => {
    const total = this.filas().length, n = this.filtradas().length;
    return n === total ? `${total} productos · ${this.visibles().length} se ven en la tienda` : `${n} de ${total} productos`;
  });

  protected readonly hero = computed(() => {
    if (this.activa()) return { titulo: 'Abierta al público', texto: `Cualquiera con el enlace ve ${this.visibles().length} productos y te puede pedir.`, bg: '#eafbef', fg: '#0c7a43', icono: this.i.mundo };
    if (this.publicable()) return { titulo: this.teniaNumero() ? 'Tienda pausada' : 'Lista para publicar', texto: 'Nadie la ve por ahora. Publícala cuando quieras.', bg: '#f1f1f1', fg: '#6b7280', icono: this.teniaNumero() ? this.i.pausar : this.i.cohete };
    return { titulo: 'Falta poco', texto: 'Completa lo pendiente para publicarla.', bg: '#fff4d6', fg: '#8a6100', icono: this.i.lista };
  });
  protected readonly requisitos = computed(() => [
    { label: 'Dirección disponible', ok: this.dirOk(), sec: 'direccion' as const, nota: this.dirOk() ? '' : 'Revisar' },
    { label: 'WhatsApp para pedidos', ok: this.waLleno(), sec: 'whatsapp' as const, nota: this.waLleno() ? '' : 'Falta' },
    { label: 'Productos activos', ok: this.visibles().length > 0, sec: 'catalogo' as const, nota: `${this.visibles().length} visibles` },
  ]);
  protected readonly sugerencias = computed(() => SUGERENCIAS_FRASE.filter((t) => !this.f().frase.includes(t)));

  protected readonly pedidoEjemplo = computed(() => {
    const ej = this.visibles().filter((r) => r.estado === 'visible').slice(0, 2);
    const lineas = ej.map((r, k) => ({ n: k + 1, nombre: r.p.nombre, sub: r.p.precio * (k + 1) }));
    const total = lineas.reduce((s, l) => s + l.sub, 0);
    return [
      { texto: `Hola ${this.nombreNegocio()}, quiero hacer este pedido:` }, { texto: '' },
      ...lineas.map((l) => ({ texto: `• ${l.n} × ${l.nombre} — ${this.monto(l.sub)}` })),
      { texto: '' }, { texto: `Total: ${this.monto(total)}`, negrita: true },
    ];
  });

  protected readonly vistaProductos = computed<ProductoVista[]>(() =>
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
    this.destroyRef.onDestroy(() => {
      this.alertas.soltarCambios();
      this.tSlug?.unsubscribe();
      clearTimeout(this.tFoco); clearTimeout(this.tTec);
    });
  }

  // ── Formulario ────────────────────────────────────────────────────────
  protected set<K extends keyof Borrador>(k: K, v: Borrador[K], extra?: Partial<Borrador>): void {
    this.f.update((f) => ({ ...f, [k]: v, ...extra }));
    if (k === 'numero' || k === 'pais' || k === 'moneda') {
      clearTimeout(this.tTec); this.tecleando.set(true);
      this.tTec = setTimeout(() => this.tecleando.set(false), 750);
    }
  }

  protected alCambiarSlug(valor: string): void {
    const slug = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').slice(0, 60);
    this.f.update((f) => ({ ...f, slug }));
    this.tSlug?.unsubscribe();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return this.slugEstado.set('invalido');
    if (slug === this.guardado()?.slug) return this.slugEstado.set('actual');
    this.slugEstado.set('comprobando');
    this.tSlug = timer(500).pipe(switchMap(() => this.tiendaService.slugDisponible(slug)))
      .subscribe({ next: (r) => this.slugEstado.set(r.disponible ? 'libre' : 'ocupado'), error: () => this.slugEstado.set('libre') });
  }

  protected agregarSugerencia(t: string): void {
    const actual = this.f().frase.trim();
    this.set('frase', `${actual ? actual.replace(/\.?$/, '. ') : ''}${t}.`);
  }

  protected guardar(): void {
    if (!this.cambios().length || this.guardando()) return;
    if (!this.formOk()) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Revisa antes de guardar', texto: 'Hay un campo con error. Corrígelo y vuelve a intentarlo.' });
      return;
    }
    this.enviar(this.payload(), { titulo: 'Cambios guardados', texto: this.activa() ? 'Ya se ven en tu tienda' : 'Se verán cuando la publiques' });
  }

  protected descartar(): void {
    const g = this.guardado();
    if (!g) return;
    this.f.set({ ...g });
    this.slugEstado.set('actual');
    this.alertas.mostrar({ estado: 'info', titulo: 'Cambios descartados' });
  }

  protected publicar(): void {
    if (this.activa()) return;
    if (!this.publicable()) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Revisa antes de publicar', texto: !this.dirOk() ? 'La dirección tiene un problema.' : 'Falta el WhatsApp donde te llegan los pedidos.' });
      this.irA(!this.dirOk() ? 'direccion' : 'whatsapp');
      return;
    }
    this.enviar({ ...this.payload(), activa: true }, { titulo: 'Tienda publicada', texto: 'Comparte el enlace con tus clientes', accion: { label: 'Copiar enlace', ejecutar: () => this.copiar() } });
  }

  protected pausar(): void {
    if (!this.activa()) return;
    this.tab.set('tienda');
    this.enviar({ activa: false }, { titulo: 'Tienda pausada', texto: 'Nadie la ve hasta que la publiques', accion: { label: 'Deshacer', ejecutar: () => this.enviar({ activa: true }, { titulo: 'Tienda publicada' }) } }, 'warning');
  }

  private enviar(cambios: CambiosTienda, exito: { titulo: string; texto?: string; accion?: { label: string; ejecutar: () => void } }, estadoExito: 'success' | 'warning' = 'success'): void {
    this.guardando.set(true);
    const id = this.alertas.mostrar({ titulo: 'Guardando cambios', texto: 'Tienda en línea' });
    this.tiendaService.guardar(cambios).subscribe({
      next: (t) => {
        this.cargarFormulario(t);
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

  private cargarFormulario(t: MiTienda): void {
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
    };
    this.guardado.set(b);
    this.f.set({ ...b });
    this.slugEstado.set('actual');
  }

  // ── Logo ──────────────────────────────────────────────────────────────
  protected alElegirLogo(e: Event): void {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    this.subirLogo(archivo);
  }
  protected alSoltar(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(false);
    this.subirLogo(e.dataTransfer?.files?.[0]);
  }
  private subirLogo(archivo: File | undefined): void {
    if (!archivo) return;
    if (!/^image\//.test(archivo.type)) { this.alertas.mostrar({ estado: 'warning', titulo: 'Solo se aceptan imágenes (JPG, PNG o WebP)' }); return; }
    if (archivo.size > MAX_LOGO) { this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo subir el logo', texto: `${archivo.name} pesa más de 4 MB. Redúcelo e inténtalo de nuevo.` }); return; }
    const previo = { logoUrl: this.f().logoUrl, logoNombre: this.f().logoNombre };
    const id = this.alertas.mostrar({ titulo: 'Subiendo logo', texto: archivo.name });
    this.uploadService.subir(archivo).subscribe({
      next: (r) => {
        this.set('logoUrl', r.url, { logoNombre: archivo.name });
        this.alertas.resolver(id, { estado: 'success', titulo: 'Logo listo', texto: 'Míralo en la vista previa', accion: { label: 'Deshacer', ejecutar: () => this.set('logoUrl', previo.logoUrl, { logoNombre: previo.logoNombre }) } });
      },
      error: (e) => this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo subir el logo', texto: mensajeDeError(e) }),
    });
  }
  protected quitarLogo(): void {
    const previo = { logoUrl: this.f().logoUrl, logoNombre: this.f().logoNombre };
    this.set('logoUrl', null, { logoNombre: '' });
    this.alertas.mostrar({ estado: 'success', titulo: 'Logo quitado', texto: 'Se mostrará la inicial', accion: { label: 'Deshacer', ejecutar: () => this.set('logoUrl', previo.logoUrl, { logoNombre: previo.logoNombre }) } });
  }

  // ── Acciones ──────────────────────────────────────────────────────────
  protected async copiar(): Promise<void> {
    const url = this.tienda()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.alertas.mostrar({ estado: 'success', titulo: 'Enlace copiado', texto: url.replace(/^https?:\/\//, '') });
    } catch {
      this.alertas.mostrar({ estado: 'info', titulo: 'Copia este enlace', texto: url });
    }
  }
  protected probarChat(): void { window.open(`https://wa.me/${this.whatsapp()}`, '_blank'); }
  protected irProductos(id?: number): void { this.router.navigate(['/productos'], id ? { queryParams: { producto: id } } : {}); }

  /** Lleva a la tarjeta, enfoca su primer campo y la marca 1,5 s (borde #303030). */
  protected irA(sec: SeccionTienda): void {
    const el = this.seccionEl(sec), box = el ? padreConScroll(el) : null;
    if (el && box) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 16, behavior: 'smooth' });
    const campo = el?.querySelector<HTMLElement>('input:not([type=file]),textarea');
    if (campo) setTimeout(() => campo.focus({ preventScroll: true }), 400);
    clearTimeout(this.tFoco);
    this.foco.set(sec); this.tab.set('tienda');
    this.tFoco = setTimeout(() => this.foco.set(null), 1500);
  }

  protected atajo(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.guardar(); }
  }

  protected limpiarFiltros(): void { this.q.set(''); this.fEst.set([]); this.fCat.set([]); this.fFoto.set('todas'); }
  protected plegar(k: string): void { this.plegados.update((p) => ({ ...p, [k]: !p[k] })); }

  // ── Presentación ──────────────────────────────────────────────────────
  protected monto(n: number): string {
    return this.f().moneda === 'USD'
      ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${Math.round(n).toLocaleString('es-CO')}`;
  }
  /** Borde y sombra de cada tarjeta: foco (clic en la vista previa) > hover > reposo. */
  protected borde(k: SeccionTienda): string { return this.foco() === k ? '#303030' : this.hov() === k ? '#d4d4d4' : '#ebebeb'; }
  protected sombra(k: SeccionTienda): string {
    return this.foco() === k ? '0 0 0 1px #303030,0 0 0 4px rgba(48,48,48,.08),0 12px 28px -22px rgba(0,0,0,.28)' : '0 1px 2px rgba(0,0,0,.03),0 12px 28px -22px rgba(0,0,0,.28)';
  }
  protected sombraSlug(): string {
    const s = this.slugEstado();
    return s === 'ocupado' || s === 'invalido' ? SH_ERR : s === 'libre' ? SH_OK : SH_IN;
  }
  protected sombraNumero(): string { return this.waOk() ? SH_IN : SH_ERR; }
  protected stockTxt(n: number | null): string { return n === null ? '' : n ? `${n} u.` : 'Sin stock'; }
  protected stockColor(n: number | null): string { return !n ? '#b42318' : n < 5 ? '#8a6100' : '#303030'; }
  protected stockAncho(n: number | null): string { return `${n ? Math.max(6, Math.min(100, (n / 40) * 100)) : 0}%`; }
}

const SH_IN = '0 0 0 1px #e5e5e5';
const SH_ERR = '0 0 0 1px #e0605a,0 0 0 4px rgba(224,96,90,.1)';
const SH_OK = '0 0 0 1px #7cc49b,0 0 0 4px rgba(47,166,90,.08)';
function normalizar(t: string): string { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function alternar<T>(xs: T[], v: T): T[] { return xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]; }
/** El contenedor que scrollea en el Shell (o el documento). */
function padreConScroll(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement as HTMLElement;
}
