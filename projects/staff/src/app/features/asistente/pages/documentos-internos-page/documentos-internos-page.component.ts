// projects/staff/src/app/features/asistente/pages/documentos-internos-page/documentos-internos-page.component.ts
//
// Pantalla de gestión de "Documentos internos" (Fase 6, §5.6.4 de
// PROPUESTA_ASISTENTE_IA_RAG.md) — listar/crear/editar/eliminar los
// manuales/procedimientos que el asistente busca por similitud
// (`buscarEnDocumentosInternos`, backend). Hasta el 2026-10-02 esto se
// cargaba a mano por Postman/Thunder Client porque no existía ninguna
// pantalla (ver AsistenteStaffDocumentoService).
//
// Primer consumidor real de `SidePanelComponent` (editor) y
// `ModalComponent` (confirmación de eliminar) — ninguno de los dos tenía
// uso real en el proyecto todavía (confirmado por grep antes de escribir
// esto), así que esta pantalla sigue el criterio documentado en sus
// propios docblocks (formularios de crear/editar en el panel,
// confirmaciones en el modal) en vez de copiar un ejemplo ya armado.
//
// Fuera del Shell, igual que `AsistentePageComponent` (ver
// `asistente.routes.ts`): trae su propia `<app-topbar />`.
//
// "Subir archivo" (§5.6.5, 2026-10-02): a diferencia del comprobante de
// pago / factura de proveedor (Fase 5, admin/staff), acá NO se manda
// nada a una IA — .md/.txt se leen directo en el navegador
// (`FileReader`) y .pdf/.docx se mandan al nuevo
// `POST /asistente-staff/documentos/extraer-texto`, que extrae el texto
// con una librería (sin IA, ver `extraccion-texto-documento.util.ts`,
// backend). En los dos casos el resultado solo PRELLENA el formulario —
// se sigue guardando con el mismo `guardar()` de siempre, así que el
// staff revisa/edita antes de confirmar, igual que el resto de
// extracciones del proyecto.
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IconCloudUpload,
  IconFileText,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  TablerIconComponent,
} from '@tabler/icons-angular';
import {
  ActualizarDocumentoStaffDto,
  AsistenteStaffDocumentoService,
} from '../../../../core/asistente-staff/asistente-staff-documento.service';
import { AsistenteStaffDocumento } from '../../../../core/asistente-staff/models/asistente-staff.model';
import { TopbarComponent } from '../../../../layout/topbar/topbar.component';
import { CabeceraModuloComponent } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { SidePanelComponent } from '../../../../shared/ui/side-panel/side-panel.component';

const MAX_TITULO = 200;
/** Tamaño del recorte que se muestra en la fila — el contenido completo
 * solo se ve al editar. */
const LARGO_PREVIEW = 160;
/** Mismo texto que el `accept` del `<input type="file">` — centralizado
 * acá para no repetirlo entre el template y la validación. */
const EXTENSIONES_ACEPTADAS = '.md,.txt,.pdf,.docx';

@Component({
  selector: 'app-documentos-internos-page',
  standalone: true,
  imports: [
    FormsModule,
    TablerIconComponent,
    CabeceraModuloComponent,
    PantallaEstadoComponent,
    SidePanelComponent,
    ModalComponent,
    TopbarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documentos-internos-page.component.html',
})
export class DocumentosInternosPageComponent implements OnInit {
  private readonly servicio = inject(AsistenteStaffDocumentoService);
  private readonly router = inject(Router);

  protected readonly iconModulo = IconFileText;
  protected readonly iconNuevo = IconPlus;
  protected readonly iconEditar = IconPencil;
  protected readonly iconEliminar = IconTrash;
  protected readonly iconBuscar = IconSearch;
  protected readonly iconSubir = IconCloudUpload;

  protected readonly maxTitulo = MAX_TITULO;
  protected readonly skeletons = [1, 2, 3, 4];
  protected readonly extensionesAceptadas = EXTENSIONES_ACEPTADAS;

  // ── Listado ─────────────────────────────────────────────────
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly documentos = signal<AsistenteStaffDocumento[]>([]);
  protected readonly busqueda = signal('');

  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  protected readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const lista = [...this.documentos()].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    if (!q) {
      return lista;
    }
    return lista.filter((d) => d.titulo.toLowerCase().includes(q) || d.contenido.toLowerCase().includes(q));
  });

  /** Subtítulo de la cabecera — misma convención del resto de `staff`:
   * prosa corta que refleja el estado real, no una etiqueta genérica. */
  protected readonly lectura = computed(() => {
    const total = this.documentos().length;
    const q = this.busqueda().trim();
    if (q) {
      const n = this.filtrados().length;
      return n
        ? `${n} de ${total} documento${total === 1 ? '' : 's'} coincide${n === 1 ? '' : 'n'} con "${q}".`
        : `Ninguno de los ${total} documentos coincide con "${q}".`;
    }
    if (total === 0) {
      return 'Todavía no cargaste ningún documento — el asistente solo busca en lo que suba acá.';
    }
    return `El asistente busca por similitud en estos ${total} documento${total === 1 ? '' : 's'} cuando una pregunta de staff lo necesita.`;
  });

  // ── Panel crear/editar ──────────────────────────────────────
  protected readonly panelAbierto = signal(false);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly cargandoDocumento = signal(false);
  protected readonly tituloForm = signal('');
  protected readonly contenidoForm = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal('');

  // ── Subir archivo (precarga el form, no guarda nada por sí sola) ──
  protected readonly subiendoArchivo = signal(false);
  protected readonly errorArchivo = signal('');

  protected readonly tituloPanel = computed(() =>
    this.editandoId() === null ? 'Nuevo documento' : 'Editar documento',
  );
  protected readonly formValido = computed(
    () => this.tituloForm().trim().length > 0 && this.contenidoForm().trim().length > 0,
  );

  // ── Confirmación de borrado ──────────────────────────────────
  protected readonly documentoABorrar = signal<AsistenteStaffDocumento | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.listar().subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          err.status === 403
            ? 'No tenés permiso para ver los documentos internos del asistente.'
            : this.mensajeDeError(err, 'No se pudo cargar la lista de documentos. Intentá de nuevo.'),
        );
        this.cargando.set(false);
      },
    });
  }

  protected reintentar(): void {
    this.cargar();
  }

  protected volver(): void {
    this.router.navigateByUrl('/asistente');
  }

  // ── Crear / editar ────────────────────────────────────────────
  protected abrirNuevo(): void {
    this.editandoId.set(null);
    this.tituloForm.set('');
    this.contenidoForm.set('');
    this.errorGuardar.set('');
    this.errorArchivo.set('');
    this.cargandoDocumento.set(false);
    this.panelAbierto.set(true);
  }

  protected abrirEditar(doc: AsistenteStaffDocumento): void {
    this.editandoId.set(doc.id);
    this.tituloForm.set(doc.titulo);
    this.contenidoForm.set(doc.contenido);
    this.errorGuardar.set('');
    this.errorArchivo.set('');
    this.panelAbierto.set(true);

    // El listado puede traer una copia algo vieja si alguien más lo editó
    // recién — se pide la fila fresca antes de dejar guardar encima.
    this.cargandoDocumento.set(true);
    this.servicio.obtener(doc.id).subscribe({
      next: (fresco) => {
        if (this.editandoId() === doc.id) {
          this.tituloForm.set(fresco.titulo);
          this.contenidoForm.set(fresco.contenido);
        }
        this.cargandoDocumento.set(false);
      },
      error: () => {
        // Si falla, se sigue editando con lo que ya había en la lista —
        // no vale la pena bloquear el panel por esto.
        this.cargandoDocumento.set(false);
      },
    });
  }

  protected cerrarPanel(): void {
    if (this.guardando()) {
      return;
    }
    this.panelAbierto.set(false);
  }

  // ── Subir archivo ──────────────────────────────────────────────
  /** `(change)` del `<input type="file">` del panel. `.md`/`.txt` se leen
   * directo en el navegador — no hace falta IA ni backend para texto que
   * ya está en texto plano. `.pdf`/`.docx` se mandan a
   * `extraer-texto` (sin IA tampoco, ver el docblock de este archivo). En
   * los dos casos solo se PRELLENA el formulario: nada se guarda hasta
   * que el staff revise y toque "Guardar". */
  protected manejarArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = ''; // permite volver a elegir el mismo archivo después

    if (!archivo || this.guardando()) {
      return;
    }

    this.errorArchivo.set('');
    const nombre = archivo.name.toLowerCase();

    if (nombre.endsWith('.md') || nombre.endsWith('.txt')) {
      const lector = new FileReader();
      lector.onload = () => this.aplicarTextoSubido(archivo.name, String(lector.result ?? ''));
      lector.onerror = () =>
        this.errorArchivo.set('No se pudo leer el archivo. Probá de nuevo o pegá el contenido a mano.');
      lector.readAsText(archivo);
      return;
    }

    if (nombre.endsWith('.pdf') || nombre.endsWith('.docx')) {
      this.subiendoArchivo.set(true);
      this.servicio.extraerTexto(archivo).subscribe({
        next: ({ contenido }) => {
          this.aplicarTextoSubido(archivo.name, contenido);
          this.subiendoArchivo.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.errorArchivo.set(
            this.mensajeDeError(err, 'No se pudo leer el archivo. Probá de nuevo o pegá el contenido a mano.'),
          );
          this.subiendoArchivo.set(false);
        },
      });
      return;
    }

    this.errorArchivo.set('Formato no soportado — subí un .md, .txt, .pdf o .docx.');
  }

  /** Solo pisa el título si todavía está vacío — si ya estabas editando
   * un título propio (por ejemplo al reemplazar el contenido de un
   * documento existente), no se lo lleva por delante. */
  private aplicarTextoSubido(nombreArchivo: string, contenido: string): void {
    if (!this.tituloForm().trim()) {
      this.tituloForm.set(this.tituloDesdeNombre(nombreArchivo));
    }
    this.contenidoForm.set(contenido.trim());
  }

  private tituloDesdeNombre(nombreArchivo: string): string {
    const sinExtension = nombreArchivo.replace(/\.[^./]+$/, '');
    const conEspacios = sinExtension.replace(/[-_]+/g, ' ').trim();
    return conEspacios.slice(0, MAX_TITULO);
  }

  protected guardar(): void {
    const titulo = this.tituloForm().trim();
    const contenido = this.contenidoForm().trim();
    if (!titulo || !contenido) {
      this.errorGuardar.set('Completá el título y el contenido antes de guardar.');
      return;
    }
    if (titulo.length > MAX_TITULO) {
      this.errorGuardar.set(`El título no puede superar los ${MAX_TITULO} caracteres.`);
      return;
    }

    this.guardando.set(true);
    this.errorGuardar.set('');

    const id = this.editandoId();
    const alGuardar = {
      next: (doc: AsistenteStaffDocumento) => {
        this.documentos.update((lista) => [...lista.filter((d) => d.id !== doc.id), doc]);
        this.guardando.set(false);
        this.panelAbierto.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorGuardar.set(
          err.status === 403
            ? 'No tenés permiso para guardar documentos del asistente.'
            : this.mensajeDeError(err, 'No se pudo guardar el documento. Intentá de nuevo.'),
        );
        this.guardando.set(false);
      },
    };

    if (id === null) {
      this.servicio.crear({ titulo, contenido }).subscribe(alGuardar);
    } else {
      const dto: ActualizarDocumentoStaffDto = { titulo, contenido };
      this.servicio.actualizar(id, dto).subscribe(alGuardar);
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────
  protected pedirEliminar(doc: AsistenteStaffDocumento): void {
    this.documentoABorrar.set(doc);
    this.errorEliminar.set('');
  }

  protected cancelarEliminar(): void {
    if (this.eliminando()) {
      return;
    }
    this.documentoABorrar.set(null);
  }

  protected confirmarEliminar(): void {
    const doc = this.documentoABorrar();
    if (!doc) {
      return;
    }
    this.eliminando.set(true);
    this.errorEliminar.set('');
    this.servicio.eliminar(doc.id).subscribe({
      next: () => {
        this.documentos.update((lista) => lista.filter((d) => d.id !== doc.id));
        this.eliminando.set(false);
        this.documentoABorrar.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.errorEliminar.set(
          err.status === 403
            ? 'No tenés permiso para eliminar documentos del asistente.'
            : this.mensajeDeError(err, 'No se pudo eliminar el documento. Intentá de nuevo.'),
        );
        this.eliminando.set(false);
      },
    });
  }

  // ── Presentación ──────────────────────────────────────────────
  protected preview(contenido: string): string {
    const limpio = contenido.replace(/\s+/g, ' ').trim();
    return limpio.length > LARGO_PREVIEW ? `${limpio.slice(0, LARGO_PREVIEW)}…` : limpio;
  }

  protected textoActualizado(doc: AsistenteStaffDocumento): string {
    const ms = new Date(doc.actualizadoEn).getTime();
    const dias = Math.floor((Date.now() - ms) / 86_400_000);
    if (dias <= 0) {
      const horas = Math.floor((Date.now() - ms) / 3_600_000);
      return horas < 1 ? 'hace minutos' : `hace ${horas} h`;
    }
    return dias === 1 ? 'ayer' : `hace ${dias} días`;
  }

  /** Mismo criterio que `SettingsPageComponent.mensajeDeError`: el
   * backend (ValidationPipe de Nest) devuelve `message` como string o
   * array de strings según el error — se normaliza acá para no repetir
   * esto en cada `.subscribe({ error })`. */
  private mensajeDeError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const m = (err.error as { message?: string | string[] } | null)?.message;
      if (m) {
        return Array.isArray(m) ? m.join(' ') : m;
      }
    }
    return fallback;
  }
}
