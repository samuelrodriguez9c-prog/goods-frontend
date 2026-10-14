import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, output, signal, viewChild } from '@angular/core';
import { IconArrowUp, IconBolt, IconLock, IconPackage, IconSparkles, TablerIconComponent } from '@tabler/icons-angular';
import { Plantilla, ProductoMostrador, RespuestaRapida } from '../../../../../../core/whatsapp/whatsapp.model';
import { MostradorProductosComponent } from '../mostrador-productos/mostrador-productos.component';
import { PlantillasVentanaComponent } from '../plantillas-ventana/plantillas-ventana.component';
import { RespuestasRapidasComponent } from '../respuestas-rapidas/respuestas-rapidas.component';
import { DatosPlantilla } from '../../../../shared/variables';
import { IaMarcaComponent } from '../../../../../../shared/ui/ia-marca/ia-marca.component';

type Pop = 'rapidas' | 'productos' | null;

/**
 * Pie de la conversación. Con la ventana abierta: el cuadro de texto con sus
 * herramientas (Rápidas "/" y Producto → Mostrador) y el aviso si la IA está
 * atendiendo. Con la ventana cerrada: las plantillas aprobadas. Si el usuario
 * no puede responder (permiso o número caído), el motivo.
 */
@Component({
  selector: 'app-compositor',
  imports: [IaMarcaComponent, TablerIconComponent, MostradorProductosComponent, RespuestasRapidasComponent, PlantillasVentanaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compositor.component.html',
  host: { class: 'relative block border-t border-[#f1f1f1] px-3 pt-2.5 pb-3' },
})
export class CompositorComponent {
  readonly texto = model('');
  /** Por qué no puede responder (sin permiso, número desconectado); null = puede. */
  readonly motivo = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly enviando = input(false);
  readonly abierta = input(true);
  readonly enIa = input(false);
  /** Respuesta que propone la IA al último mensaje del cliente (Tab la usa). */
  readonly sugerencia = input<string | null>(null);
  readonly rapidas = input<RespuestaRapida[]>([]);
  readonly cliente = input('');
  readonly productos = input<ProductoMostrador[] | null>(null);
  readonly interes = input<number[]>([]);
  readonly borrador = input<Record<number, number>>({});
  /** Alto del área de mensajes: los popovers no lo pasan. */
  readonly altoMensajes = input(400);
  readonly aprobadas = input<Plantilla[] | null>(null);
  readonly aceptaPromociones = input(false);
  /** Datos del chat para llenar solas las variables de una plantilla. */
  readonly datosPlantilla = input<DatosPlantilla>({ nombre: '' });
  readonly puedeConfigurar = input(false);

  readonly enviar = output<string>();
  readonly mostrarProducto = output<number>();
  readonly agregar = output<{ productoId: number; cantidad: number }>();
  readonly enviarPlantilla = output<{ plantilla: Plantilla; variables: string[] }>();
  readonly editarRapidas = output<void>();
  /** Se abrió el Mostrador (para traer los productos si hace falta). */
  readonly abrirMostrador = output<void>();

  protected readonly i = { rapidas: IconBolt, producto: IconPackage, enviar: IconArrowUp, candado: IconLock, ia: IconSparkles };

  protected readonly pop = signal<Pop>(null);
  protected readonly rapQ = signal('');
  protected readonly rapIdx = signal(0);
  /** Esc sobre un "/atajo" escrito: no se vuelve a abrir hasta que cambie el texto. */
  private readonly rapCerrada = signal(false);

  private readonly cuadro = viewChild<ElementRef<HTMLTextAreaElement>>('cuadro');
  private readonly popRapidas = viewChild(RespuestasRapidasComponent);

  protected readonly maxAlto = computed(() => Math.max(200, this.altoMensajes() - 6));

  /** "/atajo" que se está escribiendo al final del texto. */
  private readonly atajo = computed(() => /(?:^|\s)\/([a-z0-9_-]*)$/i.exec(this.texto()));

  protected readonly consulta = computed(() => {
    const m = this.atajo();
    return m ? m[1] : this.rapQ();
  });

  protected readonly rapidasFiltradas = computed(() => {
    const q = norm(this.consulta());
    return this.rapidas().filter((r) => !q || r.atajo.toLowerCase().startsWith(q) || norm(r.texto).includes(q) || norm(r.atajo).includes(q));
  });

  protected readonly rapIdxVisible = computed(() => Math.min(this.rapIdx(), Math.max(0, this.rapidasFiltradas().length - 1)));

  protected readonly verRapidas = computed(
    () => this.pop() === 'rapidas' || (!!this.atajo() && !this.rapCerrada() && this.rapidasFiltradas().length > 0),
  );

  protected readonly herramientas = computed(() => [
    { k: 'rapidas' as const, icono: this.i.rapidas, label: 'Rápidas', tip: 'Respuestas rápidas ( / )', on: this.pop() === 'rapidas' },
    { k: 'productos' as const, icono: this.i.producto, label: 'Producto', tip: 'Enviar un producto del catálogo', on: this.pop() === 'productos' },
  ]);

  /** La sugerencia se ofrece con el cuadro vacío y si la IA no está atendiendo el chat. */
  protected readonly sugActiva = computed(() => (!this.enIa() && !this.texto() ? this.sugerencia() : null));
  protected readonly placeholder = computed(
    () => this.sugActiva() ?? (this.enIa() ? 'Escribe para tomar el chat…' : 'Escribe un mensaje · / para respuestas rápidas'),
  );

  protected usarSugerencia(): void {
    const s = this.sugActiva();
    if (!s) return;
    this.cambiarTexto(s);
    requestAnimationFrame(() => this.cuadro()?.nativeElement.focus());
  }

  protected cambiarTexto(v: string): void {
    this.texto.set(v);
    this.rapCerrada.set(false);
    this.rapIdx.set(0);
    if (this.pop() === 'productos') this.pop.set(null);
  }

  protected herramienta(k: 'rapidas' | 'productos'): void {
    const abrir = !(k === 'rapidas' ? this.verRapidas() : this.pop() === 'productos');
    this.pop.set(abrir ? k : null);
    this.rapQ.set('');
    this.rapIdx.set(0);
    if (!abrir) {
      if (k === 'rapidas') this.rapCerrada.set(true);
      return;
    }
    if (k === 'productos') this.abrirMostrador.emit();
    else setTimeout(() => this.popRapidas()?.enfocar(), 60);
  }

  protected cambiarConsulta(v: string): void {
    this.rapQ.set(v);
    this.rapIdx.set(0);
  }

  protected tecla(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const lista = this.rapidasFiltradas();
    if (this.verRapidas() && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const n = lista.length || 1;
      this.rapIdx.set((this.rapIdxVisible() + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && this.sugActiva() && !this.verRapidas()) {
      e.preventDefault();
      this.usarSugerencia();
      return;
    }
    if (e.key === 'Escape') {
      if (this.pop() || this.verRapidas()) e.preventDefault();
      this.cerrarPop();
      return;
    }
    if ((e.key === 'Enter' || (e.key === 'Tab' && this.atajo())) && !e.shiftKey) {
      if (this.verRapidas() && lista.length) {
        e.preventDefault();
        this.usarRapida(lista[this.rapIdxVisible()]);
        return;
      }
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'TEXTAREA') {
        e.preventDefault();
        this.mandar();
      }
    }
  }

  /** Inserta la respuesta ({nombre} = nombre del cliente) en lugar del "/atajo" que se estaba escribiendo. */
  protected usarRapida(r: RespuestaRapida): void {
    const nombre = this.cliente();
    const texto = r.texto
      .replace(/\{nombre\}/gi, nombre)
      .replace(/ ,/g, ',')
      .replace(/Hola ,/g, 'Hola,');
    const actual = this.texto();
    this.texto.set((this.atajo() ? actual.replace(/\/[a-z0-9_-]*$/i, '') : actual) + texto);
    this.pop.set(null);
    this.rapQ.set('');
    this.rapIdx.set(0);
    this.enfocar(true);
  }

  protected cerrarPop(): void {
    if (this.atajo()) this.rapCerrada.set(true);
    this.pop.set(null);
    this.rapQ.set('');
    this.enfocar();
  }

  protected mandar(): void {
    const t = this.texto().trim();
    if (!t || this.enviando()) return;
    this.pop.set(null);
    this.enviar.emit(t);
  }

  protected mostrar(id: number): void {
    this.pop.set(null);
    this.mostrarProducto.emit(id);
  }

  enfocar(alFinal = false): void {
    requestAnimationFrame(() => {
      const el = this.cuadro()?.nativeElement;
      if (!el) return;
      el.focus();
      if (alFinal) el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  /** Cambio de chat: se cierran los popovers. */
  reiniciar(): void {
    this.pop.set(null);
    this.rapQ.set('');
    this.rapIdx.set(0);
    this.rapCerrada.set(false);
  }
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
