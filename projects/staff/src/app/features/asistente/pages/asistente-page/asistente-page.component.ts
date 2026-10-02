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
  IconArrowUp,
  IconArrowUpRight,
  IconBuildingBank,
  IconBuildingStore,
  IconCalendarDue,
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
  IconUserPlus,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AsistenteChatStore } from '../../../../core/asistente-staff/asistente-chat.store';
import { AsistenteStaffService } from '../../../../core/asistente-staff/asistente-staff.service';
import { AsistenteStaffConversacion, AsistenteStaffMensaje } from '../../../../core/asistente-staff/models/asistente-staff.model';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { IaMarcaComponent } from '../../../../shared/ui/ia-marca/ia-marca.component';
import { IaSaludoComponent } from '../../../../shared/ui/ia-saludo/ia-saludo.component';
import { TopbarComponent } from '../../../../layout/topbar/topbar.component';
import { MarkdownLigeroPipe } from '../../../../shared/ui/markdown-ligero/markdown-ligero.pipe';

type PasoPago = 'empresa' | 'comprobante' | 'leyendo' | 'revisar' | 'guardando' | 'guardado' | 'cancelado';
type CampoPago = 'monto' | 'fecha' | 'referencia' | 'banco' | 'notas';
type Campos = Record<CampoPago, string>;

const CAMPOS: { k: CampoPago; label: string; full?: boolean }[] = [
  { k: 'monto', label: 'Monto' },
  { k: 'fecha', label: 'Fecha del pago' },
  { k: 'referencia', label: 'Referencia / N° de operación' },
  { k: 'banco', label: 'Banco o billetera' },
  { k: 'notas', label: 'Notas', full: true },
];
const VACIO: Campos = { monto: '', fecha: '', referencia: '', banco: '', notas: '' };
const ACCEPT_COMPROBANTE = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Badge de estado de Empresa (tokens `--color-badge-*` de styles.css). */
const TONO_ESTADO: Record<string, { bg: string; fg: string; texto: string }> = {
  activa: { bg: '#a4ffb6', fg: '#0b5d3f', texto: 'Activa' },
  suspendida: { bg: '#e3e3e3', fg: '#404040', texto: 'Suspendida' },
  cancelada: { bg: '#e3e3e3', fg: '#404040', texto: 'Cancelada' },
  rechazada: { bg: '#e3e3e3', fg: '#404040', texto: 'Rechazada' },
};
const TONO_DEFAULT = { bg: '#c8ecff', fg: '#075985', texto: 'En alta' };

const SUGERENCIAS = [
  { icono: IconBuildingStore, texto: '¿Cuántas Empresas están activas hoy?' },
  { icono: IconUserPlus, texto: '¿Qué altas llevan más de 3 días esperando?' },
  { icono: IconCalendarDue, texto: '¿Qué suscripciones vencen esta semana?' },
  { icono: IconChartLine, texto: '¿Cuánto facturamos en septiembre?' },
];

/**
 * Asistente de IA a pantalla completa (ruta `/asistente`, fuera del Shell).
 * Referencia de diseño: `Asistente IA v2.dc.html`.
 *
 * - Rail izquierdo (272 px, colapsable): Nueva conversación, búsqueda,
 *   Registrar pago, Fijadas/Recientes con menú ⋮, tarjeta "Conectado a Goods".
 * - Inicio vacío: saludo (`app-ia-saludo`) + composer centrado + sugerencias.
 *   Al primer mensaje el composer baja al pie (700 ms) y el saludo se desvanece.
 * - Registrar pago: tarjeta DENTRO del hilo (no modal), 3 pasos
 *   Empresa → Comprobante → Revisión, con campos prellenados marcados "IA".
 */
@Component({
  selector: 'app-asistente-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TablerIconComponent, IaMarcaComponent, IaSaludoComponent, TopbarComponent, MarkdownLigeroPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistente-page.component.html',
})
export class AsistentePageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly api = inject(AsistenteStaffService);
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly uploadService = inject(UploadService);
  protected readonly store = inject(AsistenteChatStore);

  protected readonly i = {
    mas: IconPlus, buscar: IconSearch, pago: IconReceipt2, kebab: IconDotsVertical,
    cerrar: IconX, chevron: IconChevronDown, empresas: IconBuildingStore, altas: IconUserPlus, suscripciones: IconCalendarDue,
    ingresos: IconChartLine, escudo: IconShieldCheck, railCerrar: IconLayoutSidebarLeftCollapse, railAbrir: IconLayoutSidebarLeftExpand,
    enviar: IconArrowUp, detener: IconPlayerStopFilled, clip: IconPaperclip, copiar: IconCopy, copiado: IconCheck,
    fuentes: IconDatabase, subir: IconCloudUpload, hecho: IconCircleCheckFilled, ia: IconSparkles, cargando: IconLoader2,
    renov: IconCalendarRepeat, alerta: IconAlertCircle, ok: IconCircleCheck, banco: IconBuildingBank, hash: IconHash,
    externo: IconArrowUpRight, cancelado: IconCircleX, compartir: IconShare, fijar: IconPin, desfijar: IconPinnedOff,
    renombrar: IconPencil, eliminar: IconTrash, pdf: IconFileTypePdf, imagen: IconPhoto, archivo: IconFile,
    documentos: IconFileText,
  };
  protected readonly sugerencias = SUGERENCIAS;
  protected readonly campos = CAMPOS;
  protected readonly acceptComprobante = ACCEPT_COMPROBANTE;

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
  protected readonly masAbierto = signal(false);
  protected readonly arrastre = signal(false);
  protected readonly copiado = signal<number | null>(null);
  protected readonly adjunto = signal<{ archivo: File; url: string | null } | null>(null);
  protected readonly vacio = computed(() => !this.store.mensajes().length && !this.pago());
  protected readonly puedeEnviar = computed(() => !!this.texto().trim() || !!this.adjunto());

  // ── Pago (tarjeta en el hilo) ──────────────────────────────
  protected readonly pago = signal<PasoPago | null>(null);
  protected readonly busquedaEmpresa = signal('');
  protected readonly resultados = signal<Empresa[]>([]);
  protected readonly buscandoEmpresa = signal(false);
  protected readonly empresa = signal<Empresa | null>(null);
  protected readonly eligiendo = signal<number | null>(null);
  protected readonly comprobante = signal<{ archivo: File; url: string | null } | null>(null);
  protected readonly valores = signal<Campos>({ ...VACIO });
  protected readonly extraidos = signal<Campos>({ ...VACIO });
  protected readonly errorPago = signal<string | null>(null);
  protected readonly arrastreComprobante = signal(false);
  private archivoPendientePago: File | null = null;

  protected readonly pasos = computed(() => {
    const idx = { empresa: 0, comprobante: 1, leyendo: 2, revisar: 2, guardando: 2 }[this.pago() as string] ?? 3;
    return ['Empresa', 'Comprobante', 'Revisión'].map((label, n) => ({ label, hecho: n < idx, actual: n === idx, alcanzado: n <= idx }));
  });
  protected readonly progreso = computed(
    () => ({ empresa: '18%', comprobante: '50%', leyendo: '76%' })[this.pago() as string] ?? '100%',
  );
  protected readonly subtitulo = computed(
    () =>
      ({
        empresa: '¿De qué Empresa es el pago?',
        comprobante: 'Adjuntá el comprobante; la IA completa el resto',
        leyendo: 'Leyendo el comprobante',
        revisar: 'Revisá los datos antes de guardar',
        guardando: 'Guardando el pago',
      })[this.pago() as string] ?? '',
  );
  protected readonly enLectura = computed(() => ['leyendo', 'revisar', 'guardando'].includes(this.pago() ?? ''));

  @ViewChild('hilo') private hiloRef?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') private composerRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('buscador') private buscadorRef?: ElementRef<HTMLInputElement>;
  @ViewChild('docs') private docsRef?: ElementRef<HTMLInputElement>;
  @ViewChild('archivoPago') private archivoPagoRef?: ElementRef<HTMLInputElement>;

  private tBusqueda?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      this.store.mensajes();
      this.store.visible();
      this.pago();
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
      this.iniciarPago(pendiente);
    } else if (this.route.snapshot.queryParamMap.get('pago')) {
      this.iniciarPago();
    }
    setTimeout(() => this.composerRef?.nativeElement.focus(), 60);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.menu() || this.masAbierto()) return (this.menu.set(null), this.masAbierto.set(false), undefined);
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
  protected titulo(c: AsistenteStaffConversacion): string {
    return c.titulo ?? 'Nueva conversación';
  }

  protected nueva(): void {
    this.store.nueva();
    this.pago.set(null);
    this.texto.set('');
    setTimeout(() => this.composerRef?.nativeElement.focus(), 60);
  }

  /** Entrada a la pantalla de gestión de documentos internos (Fase 6,
   * §5.6.4 de PROPUESTA_ASISTENTE_IA_RAG.md) — hasta el 2026-10-02 esto
   * se cargaba a mano por Postman porque no existía ninguna pantalla. */
  protected irADocumentos(): void {
    this.router.navigateByUrl('/asistente/documentos');
  }

  protected abrir(c: AsistenteStaffConversacion): void {
    this.pago.set(null);
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

  protected abrirMenu(e: MouseEvent, c: AsistenteStaffConversacion): void {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.menu.set({ id: c.id, x: r.right + 6, y: Math.max(8, Math.min(r.top - 4, window.innerHeight - 200)) });
  }

  protected accionMenu(tipo: 'compartir' | 'fijar' | 'renombrar' | 'eliminar', c: AsistenteStaffConversacion): void {
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
      // Por ahora el backend solo lee comprobantes de pago → flujo de pago.
      this.adjunto.set(null);
      this.texto.set('');
      this.iniciarPago(adj.archivo);
      return;
    }
    if (/registr\w*\s+(un\s+)?pago|comprobante/i.test(cuerpo)) {
      this.texto.set('');
      this.iniciarPago();
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
    this.masAbierto.set(false);
    this.docsRef?.nativeElement.click();
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
    if (!ACCEPT_COMPROBANTE.split(',').includes(f.type)) {
      this.toastear('Por ahora solo se leen comprobantes en PDF o imagen');
      return;
    }
    this.adjunto.set({ archivo: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null });
    this.composerRef?.nativeElement.focus();
  }

  protected tamano(b: number): string {
    return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }

  protected copiar(m: AsistenteStaffMensaje): void {
    navigator.clipboard?.writeText(m.cuerpo).catch(() => undefined);
    this.copiado.set(m.id);
    setTimeout(() => this.copiado.set(null), 1400);
  }

  // ── Pago ────────────────────────────────────────────────────
  protected iniciarPago(archivo?: File): void {
    if (this.store.generando()) return;
    if (this.pago() && !['guardado', 'cancelado'].includes(this.pago()!)) return;
    this.archivoPendientePago = archivo ?? null;
    this.pago.set('empresa');
    this.busquedaEmpresa.set('');
    this.resultados.set([]);
    this.empresa.set(null);
    this.comprobante.set(null);
    this.errorPago.set(null);
  }

  protected onBusquedaEmpresa(v: string): void {
    this.busquedaEmpresa.set(v);
    clearTimeout(this.tBusqueda);
    this.tBusqueda = setTimeout(() => {
      const t = v.trim();
      if (!t) return this.resultados.set([]);
      this.buscandoEmpresa.set(true);
      this.empresaService
        .listar({ buscar: t })
        .pipe(finalize(() => this.buscandoEmpresa.set(false)))
        .subscribe({
          next: (r) => this.resultados.set(r.data.slice(0, 5)),
          error: () => this.errorPago.set('No se pudo buscar la Empresa.'),
        });
    }, 250);
  }

  protected tono(e: Empresa) {
    return TONO_ESTADO[e.estado] ?? TONO_DEFAULT;
  }

  protected inicialesEmpresa(e: Empresa): string {
    return e.nombre.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  protected elegirEmpresa(e: Empresa): void {
    this.eligiendo.set(e.id);
    setTimeout(() => {
      this.empresa.set(e);
      this.eligiendo.set(null);
      this.pago.set('comprobante');
      const f = this.archivoPendientePago;
      this.archivoPendientePago = null;
      if (f) setTimeout(() => this.procesar(f), 280);
    }, 360);
  }

  protected cambiarEmpresa(): void {
    this.empresa.set(null);
    this.comprobante.set(null);
    this.pago.set('empresa');
  }

  protected elegirComprobante(): void {
    this.archivoPagoRef?.nativeElement.click();
  }

  protected onArchivoPago(e: Event): void {
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

  private procesar(f: File): void {
    this.comprobante.set({ archivo: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null });
    this.valores.set({ ...VACIO });
    this.extraidos.set({ ...VACIO });
    this.errorPago.set(null);
    this.pago.set('leyendo');
    this.api.extraerComprobantePago(f).subscribe({
      next: (x) => {
        const v: Campos = {
          monto: x.monto != null ? String(x.monto) : '',
          fecha: x.fecha ?? '',
          referencia: x.referencia ?? '',
          banco: x.entidadBancaria ?? '',
          notas: x.notas ?? '',
        };
        this.valores.set({ ...v });
        this.extraidos.set({ ...v });
        this.pago.set('revisar');
      },
      error: (err: unknown) => {
        this.errorPago.set(this.mensajeError(err, 'No se pudo leer el comprobante.'));
        this.pago.set('comprobante');
      },
    });
  }

  protected setCampo(k: CampoPago, v: string): void {
    this.valores.update((x) => ({ ...x, [k]: v }));
    this.errorPago.set(null);
  }

  protected deIa(k: CampoPago): boolean {
    const v = this.valores()[k];
    return v !== '' && v === this.extraidos()[k];
  }

  protected editado(k: CampoPago): boolean {
    return this.valores()[k] !== this.extraidos()[k];
  }

  protected renovacion(): string {
    const f = this.valores().fecha;
    if (!f) return 'Falta la fecha del pago';
    const [y, m, d] = f.split('-').map(Number);
    return `Se renueva hasta el ${d} ${MESES[m % 12]} ${m === 12 ? y + 1 : y}`;
  }

  protected fechaLarga(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1]} ${y}`;
  }

  protected moneda(v: string): string {
    return '$' + Number(String(v || 0).replace(/[^\d]/g, '') || 0).toLocaleString('es-CO');
  }

  protected confirmarPago(): void {
    if (this.pago() !== 'revisar') return;
    const emp = this.empresa();
    const v = this.valores();
    const monto = Number(String(v.monto).replace(/[^\d]/g, ''));
    if (!emp) return this.errorPago.set('Elegí una Empresa primero.');
    if (!monto) return this.errorPago.set('Ingresá el monto del pago.');
    if (!v.fecha) return this.errorPago.set('Ingresá la fecha del pago.');
    this.pago.set('guardando');
    this.errorPago.set(null);

    const registrar = (archivoUrl?: string) =>
      this.suscripcionService
        .registrarPago({
          empresaId: emp.id,
          monto,
          fechaPago: v.fecha,
          referencia: v.referencia || undefined,
          entidadBancaria: v.banco || undefined,
          notas: v.notas || undefined,
          archivoUrl,
        })
        .subscribe({
          next: () => {
            this.pago.set('guardado');
            this.store.agregarMensajeSistema(
              `Listo, registré el pago de ${emp.nombre} por ${this.moneda(v.monto)} del ${this.fechaLarga(v.fecha)}.`,
            );
          },
          error: (err: unknown) => {
            this.errorPago.set(this.mensajeError(err, 'No se pudo registrar el pago.'));
            this.pago.set('revisar');
          },
        });

    const c = this.comprobante();
    if (!c) return void registrar();
    this.uploadService.subir(c.archivo).subscribe({
      next: (s) => registrar(s.url),
      error: (err: unknown) => {
        this.errorPago.set(this.mensajeError(err, 'No se pudo subir el archivo original.'));
        this.pago.set('revisar');
      },
    });
  }

  protected cancelarPago(): void {
    this.pago.set('cancelado');
  }

  private mensajeError(err: unknown, fallback: string): string {
    return err instanceof HttpErrorResponse && typeof err.error?.message === 'string' ? err.error.message : fallback;
  }

  private norm(s: string): string {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
