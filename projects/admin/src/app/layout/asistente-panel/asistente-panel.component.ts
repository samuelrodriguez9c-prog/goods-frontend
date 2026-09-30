import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconCheck,
  IconLoader2,
  IconMessagePlus,
  IconPaperclip,
  IconPlus,
  IconRobot,
  IconSend2,
  IconTrash,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { catchError, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { AsistenteService } from '../../core/asistente/asistente.service';
import { AsistenteConversacion, AsistenteMensaje, FacturaProveedorExtraida } from '../../core/asistente/models/asistente.model';
import { CompraService } from '../../core/compra/compra.service';
import { CrearCompraItemPayload } from '../../core/compra/models/compra.model';
import { Producto } from '../../core/producto/models/producto.model';
import { ProductoService } from '../../core/producto/producto.service';
import { Proveedor } from '../../core/proveedor/models/proveedor.model';
import { ProveedorService } from '../../core/proveedor/proveedor.service';
import { UploadService } from '../../core/upload/upload.service';

/** Nombre de tool → etiqueta corta en español para "Consulté: …" (§4.7/
 * §5.1 paso 13: mostrar siempre de dónde salió la respuesta). Si algún
 * día se suma una tool nueva (Fase 2) y no está acá, se muestra el nombre
 * crudo — nunca se cae ni se esconde la cita. */
const ETIQUETAS_HERRAMIENTA: Record<string, string> = {
  consultarStock: 'tu inventario',
  resumenVentas: 'tus ventas',
  buscarProducto: 'tu catálogo de productos',
  consultaLibre: 'tus datos',
};

/** Tipos de archivo que acepta el input de adjuntar — mismo criterio que
 * `MIME_TYPES_IMAGEN`/`application/pdf` del backend
 * (`ExtraccionFacturaProveedorService`). */
const ACCEPT_ARCHIVO_FACTURA = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

/** Borrador editable de una línea de factura en el modo documento — nace
 * de `ItemFacturaExtraido` pero es mutable (el usuario edita todo antes
 * de confirmar) y usa `productoId` (no `productoIdSugerido`) porque acá
 * ya es la elección del usuario, no solo una sugerencia. */
interface ItemFacturaDraft {
  nombre: string;
  cantidad: number | null;
  precioUnitario: number | null;
  productoId: number | null;
}

/** Sub-estado del modo documento (§5.5 de `PROPUESTA_ASISTENTE_IA_RAG.md`,
 * "extracción de documentos") — independiente del `modo` general del
 * panel (chat vs. documento), que decide qué se está mostrando en el
 * cuerpo del panel mientras el modo documento está activo:
 * - `vacio`: recién entrado al modo, esperando que se adjunte un archivo.
 * - `extrayendo`: subiendo + esperando la respuesta del modelo.
 * - `revisando`: formulario prellenado, editable, esperando confirmación.
 * - `guardando`: confirmando (subiendo el archivo original, creando
 *   proveedor si hace falta, creando la Compra).
 */
type EstadoDocumento = 'vacio' | 'extrayendo' | 'revisando' | 'guardando';

/**
 * Panel lateral del Asistente de IA (§4.6/§5.1 pasos 10 y 13 de
 * `PROPUESTA_ASISTENTE_IA_RAG.md`) — se abre desde el ícono `IconRobot`
 * del topbar (`TopbarComponent.abrirAsistente()`) y se monta siempre en
 * `ShellComponent`, condicionado acá adentro por `asistenteService.abierto()`
 * (mismo criterio que un `@if` en el padre, pero self-contained: así
 * `ShellComponent` no necesita saber nada de este estado).
 *
 * Backdrop + slide-in calcado de `staff/shared/ui/side-panel/` (ver el
 * docblock de ese componente: "se promueve a la librería recién si admin
 * también lo necesita" — hoy sí pasa, pero promoverlo a `shared-ui`
 * implica también migrar a `staff` para no dejar dos copias, que es más
 * cambio del que pide esta feature puntual; se deja como una plantilla
 * local, idéntica en CSS/estructura, hasta que un cambio futuro justifique
 * ese refactor). El hilo de mensajes reusa el mismo patrón de burbujas de
 * `MessageListPageComponent` (`features/messages/`, la inspiración de
 * layout que pide el punto 10 de §5.1).
 *
 * Conversación nueva: NO se crea contra el backend al tocar "Nueva
 * conversación" — eso solo limpia el estado local a un borrador
 * (`conversacionActivaId` null). La fila real recién se crea en el primer
 * `enviar()`, para no ensuciar el historial con conversaciones vacías que
 * el usuario abrió y nunca usó.
 *
 * Modo documento (§5.5, 2026-09-29, "Nuevo modo dentro del mismo panel"):
 * el ícono de clip (`IconPaperclip`, al lado del input de texto) cambia
 * el panel de "hilo de chat" a "formulario de revisión" — mismo panel,
 * sin navegar a otra pantalla (decisión tomada explícitamente con el
 * usuario). El adjunto SIEMPRE termina en uno de dos lugares: se cancela
 * (no se guarda nada, ni siquiera el archivo — la extracción corre en
 * memoria del lado del backend) o se confirma, y ahí el archivo original
 * se sube de nuevo vía `UploadService` (esta vez sí queda en disco) y su
 * URL se guarda como `archivoUrl` de la Compra resultante (decisión
 * tomada con el usuario: "Guardarlo como adjunto").
 */
@Component({
  selector: 'app-asistente-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistente-panel.component.html',
})
export class AsistentePanelComponent {
  protected readonly asistenteService = inject(AsistenteService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly productoService = inject(ProductoService);
  private readonly compraService = inject(CompraService);
  private readonly uploadService = inject(UploadService);

  protected readonly iconBot = IconRobot;
  protected readonly iconNueva = IconMessagePlus;
  protected readonly iconEnviar = IconSend2;
  protected readonly iconCerrar = IconX;
  protected readonly iconClip = IconPaperclip;
  protected readonly iconCargando = IconLoader2;
  protected readonly iconAgregar = IconPlus;
  protected readonly iconQuitar = IconTrash;
  protected readonly iconConfirmar = IconCheck;

  protected readonly conversaciones = signal<AsistenteConversacion[]>([]);
  protected readonly conversacionActivaId = signal<number | null>(null);
  protected readonly mensajes = signal<AsistenteMensaje[]>([]);
  protected readonly texto = signal('');

  protected readonly cargandoConversaciones = signal(false);
  protected readonly cargandoHilo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Ya se cargó al menos una vez desde que el panel está abierto — evita
   * volver a pedir `listarConversaciones` cada vez que Angular reevalúa el
   * `@if` del template (no dispara nada solo, pero deja la intención
   * explícita en vez de depender del orden de ejecución del effect). */
  private cargoAlAbrir = false;

  // --- Modo documento (§5.5) ---------------------------------------
  protected readonly modo = signal<'chat' | 'documento'>('chat');
  protected readonly estadoDocumento = signal<EstadoDocumento>('vacio');
  protected readonly errorDocumento = signal<string | null>(null);

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly productos = signal<Producto[]>([]);
  private catalogosCargados = false;

  /** El `File` elegido en `onArchivoSeleccionado` — se guarda ACÁ, no se
   * relee del `<input type="file">` al confirmar: ese input se vacía
   * (`input.value = ''`) apenas se selecciona el archivo (para poder
   * volver a elegir el mismo archivo dos veces seguidas), así que sus
   * `files` ya están vacíos para cuando se llega a `confirmarDocumento`.
   * Es lo que se vuelve a subir en el paso de confirmar (decisión
   * tomada con el usuario: "Guardarlo como adjunto"). */
  private archivoSeleccionado: File | null = null;

  /** `null` = "crear proveedor nuevo con `proveedorNombreDraft`" — nunca
   * un id inventado, así que el `<select>` siempre puede distinguir
   * "elegí uno existente" de "no, es nuevo" sin un tercer estado aparte. */
  protected readonly proveedorIdDraft = signal<number | null>(null);
  protected readonly proveedorNombreDraft = signal('');
  protected readonly numeroFacturaDraft = signal('');
  protected readonly fechaDraft = signal('');
  protected readonly notasDraft = signal('');
  protected readonly itemsDraft = signal<ItemFacturaDraft[]>([]);

  protected readonly totalDraft = computed(() =>
    this.itemsDraft().reduce(
      (acc, item) => acc + (item.cantidad ?? 0) * (item.precioUnitario ?? 0),
      0,
    ),
  );

  @ViewChild('hiloScroll') private readonly hiloScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('inputMensaje') private readonly inputMensajeRef?: ElementRef<HTMLInputElement>;
  @ViewChild('inputArchivoFactura') private readonly inputArchivoRef?: ElementRef<HTMLInputElement>;

  protected readonly conversacionActiva = computed(
    () => this.conversaciones().find((c) => c.id === this.conversacionActivaId()) ?? null,
  );

  constructor() {
    // Carga perezosa: recién la primera vez que el panel se abre, no en
    // cuanto `ShellComponent` monta la app (el panel arranca cerrado para
    // toda sesión que nunca lo toca).
    effect(() => {
      if (this.asistenteService.abierto() && !this.cargoAlAbrir) {
        this.cargoAlAbrir = true;
        this.cargarConversaciones();
      }
    });
    // Auto-scroll al último mensaje — mismo criterio que
    // `MessageListPageComponent`.
    effect(() => {
      this.mensajes();
      setTimeout(() => {
        const el = this.hiloScrollRef?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  protected cerrar(): void {
    this.asistenteService.cerrarPanel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar();
    }
  }

  protected cargarConversaciones(mostrarCargando = true): void {
    if (mostrarCargando) {
      this.cargandoConversaciones.set(true);
      this.error.set(null);
    }
    this.asistenteService
      .listarConversaciones()
      .pipe(finalize(() => this.cargandoConversaciones.set(false)))
      .subscribe({
        next: (lista) => {
          this.conversaciones.set(lista);
          if (this.conversacionActivaId() === null && lista.length) {
            this.seleccionar(lista[0].id);
          }
        },
        error: () => {
          if (mostrarCargando) {
            this.error.set('No se pudo cargar tu historial con el asistente.');
          }
        },
      });
  }

  protected seleccionar(id: number): void {
    this.conversacionActivaId.set(id);
    this.cargandoHilo.set(true);
    this.asistenteService
      .listarMensajes(id)
      .pipe(finalize(() => this.cargandoHilo.set(false)))
      .subscribe({
        next: (lista) => this.mensajes.set(lista),
        error: () => this.mensajes.set([]),
      });
  }

  protected nuevaConversacion(): void {
    this.conversacionActivaId.set(null);
    this.mensajes.set([]);
    this.texto.set('');
    this.error.set(null);
    this.inputMensajeRef?.nativeElement.focus();
  }

  protected enviar(): void {
    const cuerpo = this.texto().trim();
    if (!cuerpo || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.texto.set('');

    const idActivo = this.conversacionActivaId();
    const conFlujo$ = idActivo
      ? this.asistenteService.enviarMensaje(idActivo, cuerpo)
      : this.asistenteService.crearConversacion().pipe(
          switchMap((conversacion) => {
            this.conversaciones.update((actual) => [conversacion, ...actual]);
            this.conversacionActivaId.set(conversacion.id);
            return this.asistenteService.enviarMensaje(conversacion.id, cuerpo);
          }),
        );

    conFlujo$.pipe(finalize(() => this.enviando.set(false))).subscribe({
      next: () => {
        const id = this.conversacionActivaId();
        if (id !== null) {
          // Refresco en silencio: trae el mensaje del usuario (ya
          // persistido del lado del servidor) + la respuesta final del
          // asistente en un solo pedido, en vez de tratar de reconstruir
          // ambos a mano acá (ver el comentario de
          // `AsistenteService.enviarMensaje`).
          this.asistenteService.listarMensajes(id).subscribe((lista) => this.mensajes.set(lista));
        }
        this.cargarConversaciones(false);
        this.inputMensajeRef?.nativeElement.focus();
      },
      error: () => {
        this.error.set('El asistente no pudo responder. Probá de nuevo en un momento.');
        this.texto.set(cuerpo);
      },
    });
  }

  /** "Consulté: tu inventario, tus ventas" — `null` si el mensaje no usó
   * ninguna tool (§4.7). */
  protected herramientasTexto(m: AsistenteMensaje): string | null {
    if (!m.herramientasUsadas?.length) {
      return null;
    }
    const etiquetas = [
      ...new Set(
        m.herramientasUsadas.map((h) => ETIQUETAS_HERRAMIENTA[h.nombre] ?? h.nombre),
      ),
    ];
    return `Consulté ${etiquetas.join(' y ')}`;
  }

  protected horaCorta(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  protected tituloConversacion(c: AsistenteConversacion): string {
    return c.titulo ?? 'Nueva conversación';
  }

  // --- Modo documento (§5.5) ---------------------------------------

  protected readonly acceptArchivoFactura = ACCEPT_ARCHIVO_FACTURA;

  /** Dispara el `<input type="file">` oculto — el clip nunca abre el modo
   * documento por sí solo: recién lo hace `onArchivoSeleccionado` cuando
   * de verdad hay un archivo (si el usuario cancela el diálogo del SO,
   * el panel se queda en el chat tal cual estaba). */
  protected elegirArchivoFactura(): void {
    this.inputArchivoRef?.nativeElement.click();
  }

  protected onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    // Limpiar el valor ya: sin esto, elegir el MISMO archivo dos veces
    // seguidas no vuelve a disparar `change`.
    input.value = '';
    if (archivo) {
      this.procesarFactura(archivo);
    }
  }

  /** Corre la extracción y la carga del catálogo EN PARALELO (`forkJoin`)
   * y recién pasa a `estadoDocumento: 'revisando'` cuando las dos
   * terminaron — no una detrás de la otra. Antes, `cargarCatalogosSiHaceFalta`
   * se disparaba pero no se esperaba: el formulario de revisión podía
   * pintarse con `productoId` ya resuelto (el que sugirió el cruce contra
   * catálogo, corrido del lado del backend) pero `productos()` todavía
   * vacío del lado del frontend — el `<select>` no tenía todavía la
   * `<option>` con ese id, así que se veía en blanco hasta el próximo
   * repintado. Bug real visto con el usuario (2026-09-30): confirmó y la
   * Compra se guardó bien (el valor SÍ estaba, no era un error de datos),
   * pero los desplegables se veían vacíos. Esperar a `forkJoin` no agrega
   * demora perceptible: la carga de catálogo (dos `GET` livianos) termina
   * mucho antes que la extracción (una llamada a un modelo con visión). */
  private procesarFactura(archivo: File): void {
    this.archivoSeleccionado = archivo;
    this.modo.set('documento');
    this.estadoDocumento.set('extrayendo');
    this.errorDocumento.set(null);

    forkJoin({
      extraccion: this.asistenteService.extraerFacturaProveedor(archivo),
      catalogos: this.cargarCatalogosSiHaceFalta(),
    }).subscribe({
      next: ({ extraccion }) => {
        this.prellenarDesdeExtraccion(extraccion);
        this.estadoDocumento.set('revisando');
      },
      error: (err: unknown) => {
        this.errorDocumento.set(this.mensajeError(err, 'No se pudo leer el documento.'));
        this.estadoDocumento.set('vacio');
      },
    });
  }

  private prellenarDesdeExtraccion(extraccion: FacturaProveedorExtraida): void {
    this.proveedorIdDraft.set(extraccion.proveedorIdSugerido);
    this.proveedorNombreDraft.set(extraccion.proveedorNombreDetectado ?? '');
    this.numeroFacturaDraft.set(extraccion.numeroFactura ?? '');
    this.fechaDraft.set(extraccion.fecha ?? '');
    this.notasDraft.set(extraccion.notas ?? '');
    this.itemsDraft.set(
      extraccion.items.map((item) => ({
        nombre: item.nombreDetectado,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        productoId: item.productoIdSugerido,
      })),
    );
  }

  /** Devuelve un observable que se resuelve cuando el catálogo (Proveedor +
   * Producto) ya está en los signals — `of(undefined)` al toque si esta
   * apertura del panel ya lo había cargado antes (no se vuelve a pedir).
   * `procesarFactura` espera esto con `forkJoin` antes de pasar a
   * `revisando` (ver su docblock) — por eso ahora es un observable y no un
   * "fire and forget" como antes. */
  private cargarCatalogosSiHaceFalta() {
    if (this.catalogosCargados) {
      return of(undefined);
    }
    this.catalogosCargados = true;
    const proveedores$ = this.proveedorService.listar().pipe(
      tap((lista) => this.proveedores.set(lista)),
      catchError(() => {
        this.proveedores.set([]);
        return of(null);
      }),
    );
    const productos$ = this.productoService.listar().pipe(
      tap((respuesta) => this.productos.set(respuesta.data)),
      catchError(() => {
        this.productos.set([]);
        return of(null);
      }),
    );
    return forkJoin([proveedores$, productos$]).pipe(map(() => undefined));
  }

  protected agregarItemDraft(): void {
    this.itemsDraft.update((items) => [
      ...items,
      { nombre: '', cantidad: 1, precioUnitario: 0, productoId: null },
    ]);
  }

  protected quitarItemDraft(index: number): void {
    this.itemsDraft.update((items) => items.filter((_, i) => i !== index));
  }

  /** Setter genérico para un campo de una línea — evita repetir el mismo
   * `.update(items => items.map(...))` cuatro veces (uno por campo) en
   * el template. */
  protected actualizarItemDraft<K extends keyof ItemFacturaDraft>(
    index: number,
    campo: K,
    valor: ItemFacturaDraft[K],
  ): void {
    this.itemsDraft.update((items) =>
      items.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)),
    );
  }

  protected cancelarDocumento(): void {
    this.modo.set('chat');
    this.estadoDocumento.set('vacio');
    this.errorDocumento.set(null);
    this.itemsDraft.set([]);
    this.archivoSeleccionado = null;
  }

  protected confirmarDocumento(): void {
    if (this.estadoDocumento() === 'guardando') {
      return;
    }
    const nombreProveedor = this.proveedorNombreDraft().trim();
    if (this.proveedorIdDraft() === null && !nombreProveedor) {
      this.errorDocumento.set('Elegí un proveedor existente o escribí el nombre del nuevo.');
      return;
    }
    if (!this.itemsDraft().length) {
      this.errorDocumento.set('Agregá al menos un producto.');
      return;
    }
    const itemSinProducto = this.itemsDraft().some((item) => item.productoId === null);
    if (itemSinProducto) {
      this.errorDocumento.set('Elegí a qué producto del catálogo corresponde cada línea (o quitala).');
      return;
    }

    this.estadoDocumento.set('guardando');
    this.errorDocumento.set(null);

    this.resolverProveedor$(nombreProveedor).subscribe({
      next: ({ id, nombre }) => this.guardarCompra(id, nombre),
      error: (err: unknown) => {
        this.errorDocumento.set(this.mensajeError(err, 'No se pudo crear el proveedor.'));
        this.estadoDocumento.set('revisando');
      },
    });
  }

  /** `of({id, nombre})` cuando el usuario eligió un proveedor ya cargado
   * — sin esto habría que crear una Compra igual pero ramificando todo
   * el resto del flujo en dos copias (con/sin creación de proveedor). El
   * `nombre` viaja junto al `id` para poder armar el mensaje de éxito
   * (`guardarCompra`) sin tener que volver a buscarlo en `proveedores()`
   * — que además no lo tendría todavía si el proveedor se acaba de crear
   * en esta misma llamada. */
  private resolverProveedor$(nombreProveedor: string) {
    const idExistente = this.proveedorIdDraft();
    if (idExistente !== null) {
      const existente = this.proveedores().find((p) => p.id === idExistente);
      return of({ id: idExistente, nombre: existente?.nombre ?? nombreProveedor });
    }
    return this.proveedorService
      .crear({ nombre: nombreProveedor })
      .pipe(switchMap((proveedor) => of({ id: proveedor.id, nombre: proveedor.nombre })));
  }

  /** Deja `cuerpo` como un mensaje real de rol 'asistente' en el hilo de
   * chat (§5.5.6, 2026-09-30) — reemplaza el aviso "banner" que se probó
   * primero: el usuario pidió explícitamente que la confirmación quede
   * DENTRO de la conversación, como si el asistente le hubiera respondido,
   * en vez de un aviso aparte que no queda guardado en el historial (bug
   * real reportado: "el asistente no me responde nada" tras confirmar).
   *
   * Si no hay conversación activa (se entró al modo documento con el clip
   * sin haber chateado antes), se crea una primero — mismo patrón que la
   * rama sin `idActivo` de `enviar()` — para que el mensaje tenga dónde
   * vivir. La Compra/Pago YA quedó guardado antes de llamar a esto: si
   * este paso falla (ej. se cayó la red justo acá), no tiene sentido
   * bloquear ni mostrar error de "no se pudo guardar" — el volver al chat
   * sigue siendo el resultado correcto. */
  private confirmarEnHilo(cuerpo: string): void {
    const idActivo = this.conversacionActivaId();
    const conversacionId$ = idActivo
      ? of(idActivo)
      : this.asistenteService.crearConversacion().pipe(
          switchMap((conversacion) => {
            this.conversaciones.update((actual) => [conversacion, ...actual]);
            this.conversacionActivaId.set(conversacion.id);
            return of(conversacion.id);
          }),
        );

    conversacionId$
      .pipe(switchMap((id) => this.asistenteService.registrarMensajeSistema(id, cuerpo)))
      .subscribe({
        next: (mensaje) => {
          this.mensajes.update((actual) => [...actual, mensaje]);
          this.cargarConversaciones(false);
          this.error.set(null);
          this.cancelarDocumento();
        },
        error: () => {
          // La Compra ya está guardada — esto solo afectó el aviso en el
          // chat, no la operación en sí.
          this.cancelarDocumento();
        },
      });
  }

  private guardarCompra(proveedorId: number, nombreProveedor: string): void {
    const items: CrearCompraItemPayload[] = this.itemsDraft().map((item) => ({
      productoId: item.productoId!,
      cantidad: item.cantidad ?? 1,
      precioUnitario: item.precioUnitario ?? 0,
    }));

    const crearCompraConArchivo = (archivoUrl?: string) =>
      this.compraService
        .crear({
          proveedorId,
          fecha: this.fechaDraft() || undefined,
          notas: this.notasDraft() || undefined,
          numeroFactura: this.numeroFacturaDraft() || undefined,
          archivoUrl,
          items,
        })
        .subscribe({
          next: (compra) => {
            const cantidad = items.length;
            const total = Number(compra.total);
            const totalTexto = Number.isFinite(total) ? total.toLocaleString('es-CO') : String(compra.total);
            this.confirmarEnHilo(
              `Listo, registré la Compra a ${nombreProveedor} — ${cantidad} producto${cantidad === 1 ? '' : 's'}, total $${totalTexto}.`,
            );
          },
          error: (err: unknown) => {
            this.errorDocumento.set(this.mensajeError(err, 'No se pudo guardar la compra.'));
            this.estadoDocumento.set('revisando');
          },
        });

    // Siempre se sube el archivo original de nuevo (esta vez a disco, no
    // en memoria) para que quede como adjunto de la Compra — decisión
    // tomada con el usuario ("Guardarlo como adjunto"). `archivoSeleccionado`
    // solo puede ser `null` acá si se llegó a este método sin haber
    // pasado por `procesarFactura` (no debería ocurrir: es el único
    // camino hacia `revisando`) — en ese caso, igual se crea la Compra
    // sin adjunto en vez de bloquear la confirmación.
    if (!this.archivoSeleccionado) {
      crearCompraConArchivo(undefined);
      return;
    }
    this.uploadService.subir(this.archivoSeleccionado).subscribe({
      next: (subido) => crearCompraConArchivo(subido.url),
      error: (err: unknown) => {
        this.errorDocumento.set(this.mensajeError(err, 'No se pudo subir el archivo original.'));
        this.estadoDocumento.set('revisando');
      },
    });
  }

  private mensajeError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
      return err.error.message;
    }
    return fallback;
  }
}
