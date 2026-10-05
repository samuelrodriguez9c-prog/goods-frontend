import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconCheck,
  IconCircleCheckFilled,
  IconCircleX,
  IconFile,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileText,
  IconFileUpload,
  IconLoader2,
  IconLock,
  IconPaperclip,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AsistenteStaffDocumentoService } from '../../../../core/asistente-staff/asistente-staff-documento.service';
import { AsistenteStaffDocumento } from '../../../../core/asistente-staff/models/asistente-staff.model';
import { IaMarcaComponent } from '../../../../shared/ui/ia-marca/ia-marca.component';

type Paso = 'archivo' | 'leyendo' | 'revisar' | 'guardando' | 'guardado' | 'cancelado';

const MAX_TITULO = 200; // mismo límite que DocumentosInternosPageComponent
const EXTENSIONES = '.md,.txt,.pdf,.docx';

/**
 * "Agregar documento interno" como tarjeta DENTRO del hilo del asistente
 * (mismo patrón que la tarjeta de pago). Pasos: Archivo → Revisión.
 *
 * Misma lógica que `DocumentosInternosPageComponent` (repo, 2026-10-02):
 *  - .md / .txt se leen en el navegador con `FileReader`.
 *  - .pdf / .docx van a `AsistenteStaffDocumentoService.extraerTexto` (sin IA).
 *  - Nada se guarda hasta "Guardar documento" → `crear({ titulo, contenido })`.
 *  - El backend trocea y embebe el contenido solo.
 *
 * Emite `guardado` con el documento creado (la página agrega un mensaje de
 * confirmación al hilo y refresca la lista de documentos) y `finalizado`
 * cuando la tarjeta queda cerrada (guardada o cancelada).
 */
@Component({
  selector: 'app-documento-interno-card',
  standalone: true,
  imports: [FormsModule, RouterLink, TablerIconComponent, IaMarcaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documento-interno-card.component.html',
})
export class DocumentoInternoCardComponent implements OnInit {
  private readonly servicio = inject(AsistenteStaffDocumentoService);

  /** Archivo que ya traía el usuario (adjunto en el composer o menú +). */
  readonly archivoInicial = input<File | null>(null);
  readonly guardado = output<AsistenteStaffDocumento>();
  readonly finalizado = output<void>();

  protected readonly i = {
    subir: IconFileUpload, cerrar: IconX, hecho: IconCircleCheckFilled, alerta: IconAlertCircle, cargando: IconLoader2,
    check: IconCheck, candado: IconLock, clip: IconPaperclip, externo: IconArrowUpRight, cancelado: IconCircleX,
  };
  protected readonly extensiones = EXTENSIONES;
  protected readonly maxTitulo = MAX_TITULO;

  protected readonly paso = signal<Paso>('archivo');
  protected readonly titulo = signal('');
  protected readonly contenido = signal('');
  protected readonly archivo = signal<{ nombre: string; icono: typeof IconFile; bg: string; fg: string; nota: string } | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly arrastrando = signal(false);

  @ViewChild('input') private inputRef?: ElementRef<HTMLInputElement>;

  protected readonly activo = computed(() => !['guardado', 'cancelado'].includes(this.paso()));
  protected readonly enForm = computed(() => ['leyendo', 'revisar', 'guardando'].includes(this.paso()));
  protected readonly pasos = computed(() => {
    const idx = { archivo: 0, leyendo: 1, revisar: 1, guardando: 1 }[this.paso() as string] ?? 2;
    return ['Archivo', 'Revisión'].map((label, n) => ({ label, hecho: n < idx, actual: n === idx, alcanzado: n <= idx }));
  });
  protected readonly progreso = computed(() => ({ archivo: '25%', leyendo: '62%' })[this.paso() as string] ?? '100%');
  protected readonly subtitulo = computed(
    () =>
      ({
        archivo: 'Un manual o procedimiento que el asistente pueda consultar',
        leyendo: 'Extrayendo el texto del archivo',
        revisar: 'Revisá el título y el contenido antes de guardar',
        guardando: 'Guardando el documento',
      })[this.paso() as string] ?? '',
  );
  protected readonly palabras = computed(() => {
    const n = (this.contenido().trim().match(/\S+/g) ?? []).length;
    return `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
  });
  protected readonly valido = computed(() => !!this.titulo().trim() && !!this.contenido().trim());

  ngOnInit(): void {
    const f = this.archivoInicial();
    if (f) setTimeout(() => this.procesar(f), 320);
  }

  protected elegir(): void {
    this.inputRef?.nativeElement.click();
  }

  protected onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (f) this.procesar(f);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.procesar(f);
  }

  protected aMano(): void {
    this.archivo.set(null);
    this.error.set(null);
    this.paso.set('revisar');
  }

  protected cambiarArchivo(): void {
    this.archivo.set(null);
    this.error.set(null);
    this.paso.set('archivo');
  }

  protected setTitulo(v: string): void {
    this.titulo.set(v);
    this.error.set(null);
  }

  protected setContenido(v: string): void {
    this.contenido.set(v);
    this.error.set(null);
  }

  private procesar(f: File): void {
    const nombre = f.name.toLowerCase();
    const plano = nombre.endsWith('.md') || nombre.endsWith('.txt');
    const binario = nombre.endsWith('.pdf') || nombre.endsWith('.docx');
    if (!plano && !binario) {
      this.error.set('Formato no soportado — subí un .md, .txt, .pdf o .docx.');
      return;
    }
    this.error.set(null);
    this.archivo.set({
      nombre: f.name,
      icono: nombre.endsWith('.pdf') ? IconFileTypePdf : nombre.endsWith('.docx') ? IconFileTypeDocx : IconFileText,
      bg: nombre.endsWith('.pdf') ? '#fee2e2' : nombre.endsWith('.docx') ? '#dbeafe' : '#f1f1f1',
      fg: nombre.endsWith('.pdf') ? '#b91c1c' : nombre.endsWith('.docx') ? '#1d4ed8' : '#4b5563',
      nota: plano ? 'Leído en tu navegador · revisalo antes de guardar' : 'Texto extraído del archivo, sin IA · revisalo antes de guardar',
    });
    const aplicar = (txt: string) => {
      this.contenido.set(txt.trim());
      if (!this.titulo().trim()) this.titulo.set(this.tituloDesde(f.name));
      this.paso.set('revisar');
    };

    if (plano) {
      const lector = new FileReader();
      lector.onload = () => aplicar(String(lector.result ?? ''));
      lector.onerror = () => this.error.set('No se pudo leer el archivo. Probá de nuevo o pegá el contenido a mano.');
      lector.readAsText(f);
      return;
    }
    this.paso.set('leyendo');
    this.servicio.extraerTexto(f).subscribe({
      next: (r) => aplicar(r.contenido ?? ''),
      error: (err: unknown) => {
        this.archivo.set(null);
        this.paso.set('archivo');
        this.error.set(this.mensajeError(err, 'No se pudo extraer el texto. Probá con otro archivo o pegá el contenido a mano.'));
      },
    });
  }

  protected guardar(): void {
    if (this.paso() !== 'revisar') return;
    const titulo = this.titulo().trim();
    const contenido = this.contenido().trim();
    if (!titulo || !contenido) return this.error.set('Completá el título y el contenido antes de guardar.');
    if (titulo.length > MAX_TITULO) return this.error.set(`El título no puede superar los ${MAX_TITULO} caracteres.`);
    this.paso.set('guardando');
    this.error.set(null);
    this.servicio.crear({ titulo, contenido }).subscribe({
      next: (doc) => {
        this.titulo.set(doc.titulo);
        this.paso.set('guardado');
        this.guardado.emit(doc);
        this.finalizado.emit();
      },
      error: (err: unknown) => {
        this.paso.set('revisar');
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 403
            ? 'No tenés permiso para guardar documentos del asistente.'
            : this.mensajeError(err, 'No se pudo guardar el documento.'),
        );
      },
    });
  }

  protected cancelar(): void {
    this.paso.set('cancelado');
    this.finalizado.emit();
  }

  /** "manual-de-altas_v2.pdf" → "Manual de altas v2" (máx. 200). */
  private tituloDesde(nombre: string): string {
    const t = nombre.replace(/\.[^./]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  private mensajeError(err: unknown, fallback: string): string {
    return err instanceof HttpErrorResponse && typeof err.error?.message === 'string' ? err.error.message : fallback;
  }
}
