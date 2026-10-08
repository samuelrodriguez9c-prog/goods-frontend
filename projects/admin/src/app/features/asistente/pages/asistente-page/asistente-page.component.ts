import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IconAlertCircle,
  IconBooks,
  IconArrowUp,
  IconArrowUpRight,
  IconBuildingBank,
  IconCalendarRepeat,
  IconChartLine,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconCircleX,
  IconCloudUpload,
  IconCopy,
  IconDatabase,
  IconDotsVertical,
  IconFile,
  IconFileText,
  IconFileTypePdf,
  IconHash,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLoader2,
  IconPaperclip,
  IconPencil,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconPlayerStopFilled,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconShare,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
  IconInbox,
  IconPackages,
  IconTrophy,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AsistenteChatStore } from '../../../../core/asistente/asistente-chat.store';
import { AsistenteService } from '../../../../core/asistente/asistente.service';
import { AsistenteConversacion, AsistenteMensaje, FacturaProveedorExtraida } from '../../../../core/asistente/models/asistente.model';
import { CompraService } from '../../../../core/compra/compra.service';
import { CrearCompraItemPayload } from '../../../../core/compra/models/compra.model';
import { Producto } from '../../../../core/producto/models/producto.model';
import { ProductoService } from '../../../../core/producto/producto.service';
import { Proveedor } from '../../../../core/proveedor/models/proveedor.model';
import { ProveedorService } from '../../../../core/proveedor/proveedor.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { IaMarcaComponent } from '../../../../shared/ui/ia-marca/ia-marca.component';
import { IaSaludoComponent } from '../../../../shared/ui/ia-saludo/ia-saludo.component';
import { TopbarComponent } from '../../../../layout/topbar/topbar.component';
import { MarkdownLigeroPipe } from '../../../../shared/ui/markdown-ligero/markdown-ligero.pipe';
import { IaEscribiendoComponent } from '../../../../shared/ui/ia-escribiendo/ia-escribiendo.component';
import { IaMenuMasComponent } from '../../../../shared/ui/ia-menu-mas/ia-menu-mas.component';
import { DocumentoInternoCardComponent } from '../../components/documento-interno-card/documento-interno-card.component';
import { AsistenteDocumento } from '../../../../core/asistente/models/asistente.model';

type PasoCompra = 'factura' | 'leyendo' | 'revisar' | 'guardando' | 'guardado' | 'cancelado';
type CampoCompra = 'proveedor' | 'numero' | 'fecha' | 'notas';

/** Línea de la factura mientras se revisa. */
interface ItemDraft {
  nombre: string;
  cantidad: number | null;
  precioUnitario: number | null;
  productoId: number | null;
}

const ACCEPT_COMPROBANTE = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
/** "agregar un manual", "cargar la política", "subir documento"… */
const DOC_RE = /(agreg|carg|sub|guard)\w*\s+(un\s+|una\s+|el\s+|la\s+)?(documento|manual|procedimiento|pol[ií]tica)/i;
/** "registrar una compra", "cargar la factura del proveedor"… */
const COMPRA_RE = /registr\w*\s+(una\s+)?compra|factura/i;
const EXT_DOC = /\.(md|txt|docx)$/i;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const SUGERENCIAS = [
  { icono: IconPackages, texto: '¿Qué productos tienen poco stock?' },
  { icono: IconChartLine, texto: '¿Cuánto vendí esta semana?' },
  { icono: IconInbox, texto: '¿Qué pedidos están pendientes?' },
  { icono: IconTrophy, texto: '¿Cuáles son mis productos más vendidos?' },
];

/**
 * Asistente de IA a pantalla completa (ruta `/asistente`, fuera del Shell)
 * — calcado del de staff (2026-10-07).
 *
 * - Rail izquierdo (272 px, colapsable): Nueva conversación, búsqueda,
 *   Registrar compra, Documentos, Fijadas/Recientes con menú ⋮.
 * - Inicio vacío: composer centrado + sugerencias. Al primer mensaje el
 *   composer baja al pie.
 * - Registrar compra (lo que en staff es "Registrar pago"): tarjeta DENTRO
 *   del hilo, 2 pasos Factura → Revisión. La IA lee la factura del
 *   proveedor (`POST /asistente/facturas-proveedor/extraer`) y prellena
 *   proveedor, número, fecha y líneas; al confirmar se crea el proveedor si
 *   es nuevo, se sube la factura y se guarda la Compra (entra al
 *   inventario). Mismo flujo que tenía el panel lateral viejo.
 */
@Component({
  selector: 'app-asistente-page',
  standalone: true,
  imports: [
    FormsModule, RouterLink, TablerIconComponent, IaMarcaComponent, IaSaludoComponent, TopbarComponent, MarkdownLigeroPipe,
    IaEscribiendoComponent, IaMenuMasComponent, DocumentoInternoCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistente-page.component.html',
})
export class AsistentePageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly api = inject(AsistenteService);
  private readonly compraService = inject(CompraService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly productoService = inject(ProductoService);
  private readonly uploadService = inject(UploadService);
  protected readonly store = inject(AsistenteChatStore);

  protected readonly i = {
    mas: IconPlus, buscar: IconSearch, pago: IconReceipt2, kebab: IconDotsVertical,
    cerrar: IconX, chevron: IconChevronDown,
    ingresos: IconChartLine, escudo: IconShieldCheck, railCerrar: IconLayoutSidebarLeftCollapse, railAbrir: IconLayoutSidebarLeftExpand,
    enviar: IconArrowUp, detener: IconPlayerStopFilled, clip: IconPaperclip, copiar: IconCopy, copiado: IconCheck,
    fuentes: IconDatabase, subir: IconCloudUpload, hecho: IconCircleCheckFilled, ia: IconSparkles, cargando: IconLoader2,
    renov: IconCalendarRepeat, alerta: IconAlertCircle, ok: IconCircleCheck, banco: IconBuildingBank, hash: IconHash,
    externo: IconArrowUpRight, cancelado: IconCircleX, compartir: IconShare, fijar: IconPin, desfijar: IconPinnedOff,
    renombrar: IconPencil, eliminar: IconTrash, pdf: IconFileTypePdf, imagen: IconPhoto, archivo: IconFile, libros: IconBooks,
    documentos: IconFileText,
  };
  protected readonly sugerencias = SUGERENCIAS;
  protected readonly acceptComprobante = ACCEPT_COMPROBANTE;
  protected readonly totalLineas = (it: ItemDraft) => (it.cantidad ?? 0) * (it.precioUnitario ?? 0);

  protected readonly nombre = computed(() => this.auth.currentUser()?.nombres?.split(' ')[0] ?? '');

  // ── Rail ────────────────────────────────────────────────────
  protected readonly railAbierto = signal(true);
  protected readonly buscando = signal(false);
  protected readonly busqueda = signal('');
  protected readonly hoverId = signal<number | null>(null);
  protected readonly capAbierto = signal(true);
  protected readonly menu = signal<{ id: number; x: number; y: number } | null>(null);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly nombreDraft = signal('');
  protected readonly toast = signal<{ texto: string; accion?: { texto: string; fn: () => void } } | null>(null);
  protected readonly horaSync = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  protected readonly secciones = computed(() => {
    const q = this.norm(this.busqueda());
    const vis = this.store.conversaciones().filter((c) => !q || this.norm(this.titulo(c)).includes(q));
    const fij = this.store.fijadas();
    return [
      { titulo: 'Fijadas', items: vis.filter((c) => fij.has(c.id)) },
      { titulo: 'Recientes', items: vis.filter((c) => !fij.has(c.id)) },
    ].filter((g) => g.items.length);
  });
  protected readonly convMenu = computed(() => {
    const m = this.menu();
    return m ? (this.store.conversaciones().find((c) => c.id === m.id) ?? null) : null;
  });

  // ── Composer ────────────────────────────────────────────────
  protected readonly texto = signal('');
  protected readonly enfocado = signal(false);
  protected readonly arrastre = signal(false);
  protected readonly copiado = signal<number | null>(null);
  protected readonly adjunto = signal<{ archivo: File; url: string | null } | null>(null);
  protected readonly vacio = computed(() => !this.store.mensajes().length && !this.compra() && !this.doc());
  protected readonly puedeEnviar = computed(() => !!this.texto().trim() || !!this.adjunto());

  // ── Compra (tarjeta en el hilo) ─────────────────────────────
  protected readonly compra = signal<PasoCompra | null>(null);
  protected readonly comprobante = signal<{ archivo: File; url: string | null } | null>(null);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  protected readonly proveedorId = signal<number | null>(null);
  protected readonly proveedorNombre = signal('');
  protected readonly numero = signal('');
  protected readonly fecha = signal('');
  protected readonly notas = signal('');
  protected readonly items = signal<ItemDraft[]>([]);
  /** Lo que leyó la IA, para marcar "IA" / "editado" en cada campo. */
  private readonly extraido = signal<Record<CampoCompra, string>>({ proveedor: '', numero: '', fecha: '', notas: '' });
  protected readonly errorCompra = signal<string | null>(null);
  protected readonly arrastreComprobante = signal(false);
  protected readonly guardada = signal<{ proveedor: string; total: number; lineas: number } | null>(null);
  private catalogosCargados = false;

  protected readonly totalCompra = computed(() =>
    this.items().reduce((t, it) => t + (it.cantidad ?? 0) * (it.precioUnitario ?? 0), 0),
  );

  // ── Documento interno (tarjeta en el hilo) ─────────────────
  /** `key` fuerza a recrear la tarjeta si se arranca otra carga. */
  protected readonly doc = signal<{ key: number; archivo: File | null; activo: boolean } | null>(null);

  protected readonly pasos = computed(() => {
    const idx = { factura: 0, leyendo: 1, revisar: 1, guardando: 1 }[this.compra() as string] ?? 2;
    return ['Factura', 'Revisión'].map((label, n) => ({ label, hecho: n < idx, actual: n === idx, alcanzado: n <= idx }));
  });
  protected readonly progreso = computed(
    () => ({ factura: '30%', leyendo: '70%' })[this.compra() as string] ?? '100%',
  );
  protected readonly subtitulo = computed(
    () =>
      ({
        factura: 'Adjunta la factura del proveedor; la IA completa el resto',
        leyendo: 'Leyendo la factura',
        revisar: 'Revisa los datos antes de guardar',
        guardando: 'Guardando la compra',
      })[this.compra() as string] ?? '',
  );
  protected readonly enLectura = computed(() => ['leyendo', 'revisar', 'guardando'].includes(this.compra() ?? ''));

  @ViewChild('hilo') private hiloRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') private composerRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('buscador') private buscadorRef?: ElementRef<HTMLInputElement>;
  @ViewChild('docs') private docsRef?: ElementRef<HTMLInputElement>;
  @ViewChild('archivoCompra') private archivoCompraRef?: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      this.store.mensajes();
      this.store.visible();
      this.compra();
      this.doc();
      requestAnimationFrame(() => {
        const el = this.hiloRef?.nativeElement;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: this.store.fase() === 'escribiendo' ? 'auto' : 'smooth' });
      });
    });
    effect(() => {
      const b = this.store.borradorDevuelto();
      if (b) {
        this.texto.set(b);
        this.store.borradorDevuelto.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.store.cargar();
    const pendiente = this.store.archivoPendiente();
    if (pendiente) {
      this.store.archivoPendiente.set(null);
      EXT_DOC.test(pendiente.name) ? this.iniciarDoc(pendiente) : this.iniciarCompra(pendiente);
    } else if (this.route.snapshot.queryParamMap.get('compra')) {
      this.iniciarCompra();
    } else if (this.route.snapshot.queryParamMap.get('doc')) {
      this.iniciarDoc();
    }
    setTimeout(() => this.composerRef?.nativeElement.focus(), 60);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.menu()) return (this.menu.set(null), undefined);
      if (document.querySelector('app-ia-menu-mas [role=menu]')) return; // el menú + se cierra solo con Esc
      if (this.buscando()) return this.cerrarBusqueda();
      if (this.store.generando()) return this.store.detener();
      this.volver();
      return;
    }
    const tag = (e.target as HTMLElement)?.tagName ?? '';
    if (/INPUT|TEXTAREA/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      this.abrirBusqueda();
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      this.nueva();
    }
  }

  protected volver(): void {
    history.length > 1 ? history.back() : this.router.navigate(['/']);
  }

  // ── Rail ────────────────────────────────────────────────────
  protected titulo(c: AsistenteConversacion): string {
    return c.titulo ?? 'Nueva conversación';
  }

  protected nueva(): void {
    this.store.nueva();
    this.compra.set(null);
    this.doc.set(null);
    this.texto.set('');
    setTimeout(() => this.composerRef?.nativeElement.focus(), 60);
  }

  /** Entrada a la pantalla de gestión de documentos (Fase 6,
   * §5.6.4 de PROPUESTA_ASISTENTE_IA_RAG.md) — hasta el 2026-10-02 esto
   * se cargaba a mano por Postman porque no existía ninguna pantalla. */
  protected irADocumentos(): void {
    this.router.navigateByUrl('/asistente/documentos');
  }

  protected abrir(c: AsistenteConversacion): void {
    this.compra.set(null);
    this.doc.set(null);
    this.store.seleccionar(c.id);
  }

  protected abrirBusqueda(): void {
    this.buscando.set(true);
    setTimeout(() => this.buscadorRef?.nativeElement.focus(), 30);
  }

  protected cerrarBusqueda(): void {
    this.buscando.set(false);
    this.busqueda.set('');
  }

  protected abrirMenu(e: MouseEvent, c: AsistenteConversacion): void {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set({ id: c.id, x: r.right + 6, y: Math.max(8, Math.min(r.top - 4, window.innerHeight - 200)) });
  }

  protected accionMenu(tipo: 'compartir' | 'fijar' | 'renombrar' | 'eliminar', c: AsistenteConversacion): void {
    this.menu.set(null);
    if (tipo === 'compartir') {
      navigator.clipboard?.writeText(`${location.origin}/asistente?c=${c.id}`).catch(() => undefined);
      this.toastear('Enlace copiado al portapapeles');
    }
    if (tipo === 'fijar') {
      const estaba = this.store.fijadas().has(c.id);
      this.store.toggleFijada(c.id);
      this.toastear(estaba ? 'Conversación desfijada' : 'Conversación fijada');
    }
    if (tipo === 'renombrar') {
      this.editandoId.set(c.id);
      this.nombreDraft.set(this.titulo(c));
    }
    if (tipo === 'eliminar') {
      this.store.eliminar(c.id);
      this.toastear('Conversación eliminada');
    }
  }

  protected guardarNombre(): void {
    const id = this.editandoId();
    const t = this.nombreDraft().trim();
    if (id && t) this.store.renombrar(id, t);
    this.editandoId.set(null);
  }

  private toastear(texto: string): void {
    const t = { texto };
    this.toast.set(t);
    setTimeout(() => this.toast() === t && this.toast.set(null), 4200);
  }

  // ── Composer ────────────────────────────────────────────────
  protected enviar(t?: string): void {
    const cuerpo = (t ?? this.texto()).trim();
    const adj = t === undefined ? this.adjunto() : null;
    if (!cuerpo && !adj) return;
    if (adj) {
      this.adjunto.set(null);
      this.texto.set('');
      // .md/.txt/.docx → documento · PDF/imagen → factura de compra.
      EXT_DOC.test(adj.archivo.name) ? this.iniciarDoc(adj.archivo) : this.iniciarCompra(adj.archivo);
      return;
    }
    if (DOC_RE.test(cuerpo)) {
      this.texto.set('');
      this.iniciarDoc();
      return;
    }
    if (COMPRA_RE.test(cuerpo)) {
      this.texto.set('');
      this.iniciarCompra();
      return;
    }
    if (this.store.enviar(cuerpo)) this.texto.set('');
  }

  protected accionBoton(): void {
    this.store.generando() ? this.store.detener() : this.enviar();
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.enviar();
    }
  }

  protected adjuntarDesdeMenu(): void {
    this.docsRef?.nativeElement.click();
  }

  // ── Documento interno ───────────────────────────────────────
  protected iniciarDoc(archivo?: File): void {
    if (this.store.generando()) return;
    if (this.doc()?.activo) return;
    this.doc.set({ key: Date.now(), archivo: archivo ?? null, activo: true });
  }

  protected onDocGuardado(d: AsistenteDocumento): void {
    this.store.cargarDocumentos();
    this.store.agregarMensajeSistema(
      `Listo, guardé "${d.titulo}". Desde ahora lo consulto cuando una pregunta lo necesite.`,
    );
  }

  protected onDocFinalizado(): void {
    this.doc.update((d) => (d ? { ...d, activo: false } : d));
  }

  protected preguntarDocumento(titulo: string): void {
    this.enviar(`¿Qué dice "${titulo}"?`);
  }

  protected onDocs(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) this.tomarAdjunto(f);
  }

  protected onComposerDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastre.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.tomarAdjunto(f);
  }

  private tomarAdjunto(f: File): void {
    if (!ACCEPT_COMPROBANTE.split(',').includes(f.type) && !EXT_DOC.test(f.name)) {
      this.toastear('Por ahora se leen facturas (PDF o imagen) y documentos (.md, .txt, .docx)');
      return;
    }
    this.adjunto.set({ archivo: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null });
    this.composerRef?.nativeElement.focus();
  }

  protected tamano(b: number): string {
    return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }

  protected copiar(m: AsistenteMensaje): void {
    navigator.clipboard?.writeText(m.cuerpo).catch(() => undefined);
    this.copiado.set(m.id);
    setTimeout(() => this.copiado.set(null), 1400);
  }

  // ── Compra ──────────────────────────────────────────────────
  protected iniciarCompra(archivo?: File): void {
    if (this.store.generando()) return;
    if (this.compra() && !['guardado', 'cancelado'].includes(this.compra()!)) return;
    this.compra.set('factura');
    this.comprobante.set(null);
    this.errorCompra.set(null);
    this.guardada.set(null);
    if (archivo) setTimeout(() => this.procesar(archivo), 280);
  }

  protected elegirComprobante(): void {
    this.archivoCompraRef?.nativeElement.click();
  }

  protected onArchivoCompra(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) this.procesar(f);
  }

  protected onDropComprobante(e: DragEvent): void {
    e.preventDefault();
    this.arrastreComprobante.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.procesar(f);
  }

  /** Lectura de la factura y catálogo (proveedores y productos) en paralelo:
   * así los desplegables ya tienen las opciones cuando se prellenan. */
  private procesar(f: File): void {
    this.comprobante.set({ archivo: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null });
    this.errorCompra.set(null);
    this.compra.set('leyendo');
    forkJoin({ x: this.api.extraerFacturaProveedor(f), _: this.cargarCatalogos() }).subscribe({
      next: ({ x }) => {
        this.prellenar(x);
        this.compra.set('revisar');
      },
      error: (err: unknown) => {
        this.errorCompra.set(this.mensajeError(err, 'No se pudo leer la factura.'));
        this.compra.set('factura');
      },
    });
  }

  private prellenar(x: FacturaProveedorExtraida): void {
    const prov = x.proveedorIdSugerido != null ? (this.proveedores().find((p) => p.id === x.proveedorIdSugerido)?.nombre ?? '') : '';
    this.proveedorId.set(x.proveedorIdSugerido);
    this.proveedorNombre.set(prov || (x.proveedorNombreDetectado ?? ''));
    this.numero.set(x.numeroFactura ?? '');
    this.fecha.set(x.fecha ?? '');
    this.notas.set(x.notas ?? '');
    this.items.set(
      x.items.map((it) => ({ nombre: it.nombreDetectado, cantidad: it.cantidad, precioUnitario: it.precioUnitario, productoId: it.productoIdSugerido })),
    );
    this.extraido.set({ proveedor: this.proveedorNombre(), numero: this.numero(), fecha: this.fecha(), notas: this.notas() });
  }

  private cargarCatalogos() {
    if (this.catalogosCargados) return of(undefined);
    this.catalogosCargados = true;
    return forkJoin([
      this.proveedorService.listar().pipe(tap((l) => this.proveedores.set(l)), catchError(() => of(null))),
      this.productoService.listar().pipe(tap((r) => this.productos.set(r.data)), catchError(() => of(null))),
    ]).pipe(map(() => undefined));
  }

  /** Valor actual de un campo de cabecera (para "IA" / "editado"). */
  private valor(k: CampoCompra): string {
    return { proveedor: this.proveedorNombre(), numero: this.numero(), fecha: this.fecha(), notas: this.notas() }[k];
  }

  protected deIa(k: CampoCompra): boolean {
    const v = this.valor(k);
    return v !== '' && v === this.extraido()[k];
  }

  protected editado(k: CampoCompra): boolean {
    return this.valor(k) !== this.extraido()[k];
  }

  /** Elegir un proveedor del catálogo o escribir uno nuevo en el mismo campo. */
  protected setProveedor(nombre: string): void {
    this.proveedorNombre.set(nombre);
    const t = this.norm(nombre.trim());
    this.proveedorId.set(this.proveedores().find((p) => this.norm(p.nombre) === t)?.id ?? null);
    this.errorCompra.set(null);
  }

  protected setItem<K extends keyof ItemDraft>(i: number, k: K, v: ItemDraft[K]): void {
    this.items.update((l) => l.map((it, n) => (n === i ? { ...it, [k]: v } : it)));
    this.errorCompra.set(null);
  }

  protected numeroDe(v: string): number | null {
    const n = Number(String(v).replace(/[^\d.]/g, ''));
    return v === '' || !Number.isFinite(n) ? null : n;
  }

  protected agregarItem(): void {
    this.items.update((l) => [...l, { nombre: '', cantidad: 1, precioUnitario: 0, productoId: null }]);
  }

  protected quitarItem(i: number): void {
    this.items.update((l) => l.filter((_, n) => n !== i));
  }

  protected fechaLarga(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1]} ${y}`;
  }

  protected moneda(v: number): string {
    return '$' + Math.round(v || 0).toLocaleString('es-CO');
  }

  protected confirmarCompra(): void {
    if (this.compra() !== 'revisar') return;
    const nombre = this.proveedorNombre().trim();
    if (!nombre) return this.errorCompra.set('Elige un proveedor o escribe el nombre del nuevo.');
    if (!this.items().length) return this.errorCompra.set('Agrega al menos un producto.');
    if (this.items().some((it) => it.productoId === null)) {
      return this.errorCompra.set('Elige a qué producto del catálogo corresponde cada línea (o quítala).');
    }
    this.compra.set('guardando');
    this.errorCompra.set(null);

    const id = this.proveedorId();
    const proveedor$ = id !== null ? of({ id, nombre }) : this.proveedorService.crear({ nombre }).pipe(map((p) => ({ id: p.id, nombre: p.nombre })));
    const c = this.comprobante();
    const archivo$ = c ? this.uploadService.subir(c.archivo).pipe(map((s) => s.url as string | undefined)) : of(undefined);
    const items: CrearCompraItemPayload[] = this.items().map((it) => ({
      productoId: it.productoId!,
      cantidad: it.cantidad ?? 1,
      precioUnitario: it.precioUnitario ?? 0,
    }));

    forkJoin({ prov: proveedor$, archivoUrl: archivo$ })
      .pipe(
        switchMap(({ prov, archivoUrl }) =>
          this.compraService
            .crear({
              proveedorId: prov.id,
              fecha: this.fecha() || undefined,
              notas: this.notas() || undefined,
              numeroFactura: this.numero() || undefined,
              archivoUrl,
              items,
            })
            .pipe(map((compra) => ({ compra, prov }))),
        ),
      )
      .subscribe({
        next: ({ compra, prov }) => {
          const total = Number(compra.total);
          this.guardada.set({ proveedor: prov.nombre, total: Number.isFinite(total) ? total : this.totalCompra(), lineas: items.length });
          this.compra.set('guardado');
          this.catalogosCargados = id !== null; // un proveedor nuevo: recargar la lista la próxima vez
          this.store.agregarMensajeSistema(
            `Listo, registré la compra a ${prov.nombre} — ${items.length} producto${items.length === 1 ? '' : 's'}, total ${this.moneda(this.guardada()!.total)}.`,
          );
        },
        error: (err: unknown) => {
          this.errorCompra.set(this.mensajeError(err, 'No se pudo guardar la compra.'));
          this.compra.set('revisar');
        },
      });
  }

  protected cancelarCompra(): void {
    this.compra.set('cancelado');
  }

  private mensajeError(err: unknown, fallback: string): string {
    return err instanceof HttpErrorResponse && typeof err.error?.message === 'string' ? err.error.message : fallback;
  }

  private norm(s: string): string {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
