import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Observable } from 'rxjs';
import { IconCornerDownRight, IconPencil, IconPlus, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { mensajeDeError } from '../../../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../../../core/ui/alerta.service';
import { Automatizacion } from '../../../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../../../core/whatsapp/whatsapp.service';
import { normalizar } from '../../automatico';
import { InterruptorComponent } from '../interruptor/interruptor.component';

type Regla = Automatizacion<{ palabras: string[]; texto: string }>;

/**
 * Editor del paso "Palabras clave": las reglas (palabras → respuesta) con su
 * interruptor, y el alta, edición y borrado. Guarda solo y avisa con
 * `cambio` para que la página recargue.
 */
@Component({
  selector: 'app-editor-palabras',
  imports: [NgTemplateOutlet, TablerIconComponent, InterruptorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editor-palabras.component.html',
  host: { class: 'block' },
})
export class EditorPalabrasComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly alertas = inject(AlertaService);

  readonly reglas = input.required<Regla[]>();
  readonly puedeConfigurar = input(false);
  readonly llenar = input.required<(texto: string) => string>();
  /** La página pide abrir el alta (p. ej. al prender el paso sin reglas); se avisa con `nuevaAbierta`. */
  readonly abrirNueva = input(false);
  readonly nuevaAbierta = output<void>();
  readonly cambio = output<void>();

  protected readonly i = { respuesta: IconCornerDownRight, mas: IconPlus, editar: IconPencil, borrar: IconTrash };
  protected readonly form = signal<{ id?: number; palabras: string; texto: string } | null>(null);
  protected readonly guardando = signal(false);
  protected readonly ocupada = signal<number | null>(null);
  protected readonly confirmar = signal<number | null>(null);
  private timerConfirmar?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (!this.abrirNueva()) return;
      untracked(() => {
        this.nueva();
        this.nuevaAbierta.emit();
      });
    });
  }

  /** Sin repetir la misma palabra con y sin tilde ("catálogo", "catalogo"). */
  protected palabrasVisibles(r: Regla): string[] {
    return r.config.palabras.filter((w, j, xs) => j === 0 || normalizar(w) !== normalizar(xs[j - 1]));
  }

  protected nueva(): void {
    this.form.set({ palabras: '', texto: '' });
  }

  protected editar(r: Regla): void {
    this.form.set({ id: r.id, palabras: r.config.palabras.join(', '), texto: r.config.texto });
  }

  protected parche(cambio: Partial<{ palabras: string; texto: string }>): void {
    this.form.update((f) => (f ? { ...f, ...cambio } : f));
  }

  protected guardar(): void {
    const f = this.form();
    if (!f || this.guardando()) return;
    const palabras = f.palabras.split(',').map((p) => p.trim()).filter(Boolean);
    if (!palabras.length || !f.texto.trim()) return;
    this.guardando.set(true);
    this.ejecutar(this.whatsapp.guardarPalabraClave({ palabras, texto: f.texto.trim() }, f.id), f.id ? 'Palabra clave actualizada' : 'Palabra clave creada', () => {
      this.guardando.set(false);
      this.form.set(null);
    }, () => this.guardando.set(false));
  }

  protected alternar(r: Regla): void {
    if (this.ocupada()) return;
    this.ocupada.set(r.id);
    this.ejecutar(
      this.whatsapp.guardarPalabraClave({ ...r.config, activa: !r.activa }, r.id),
      r.activa ? 'Palabra clave apagada' : 'Palabra clave prendida',
      () => this.ocupada.set(null),
      () => this.ocupada.set(null),
    );
  }

  /** Primer toque pide confirmación; el segundo borra. */
  protected borrar(r: Regla): void {
    clearTimeout(this.timerConfirmar);
    if (this.confirmar() !== r.id) {
      this.confirmar.set(r.id);
      this.timerConfirmar = setTimeout(() => this.confirmar.set(null), 4000);
      return;
    }
    this.confirmar.set(null);
    this.ocupada.set(r.id);
    this.ejecutar(this.whatsapp.borrarPalabraClave(r.id), 'Palabra clave borrada', () => {
      this.ocupada.set(null);
      if (this.form()?.id === r.id) this.form.set(null);
    }, () => this.ocupada.set(null));
  }

  private ejecutar(peticion: Observable<unknown>, exito: string, listo: () => void, fallo: () => void): void {
    peticion.subscribe({
      next: () => {
        listo();
        this.alertas.mostrar({ estado: 'success', titulo: exito });
        this.cambio.emit();
      },
      error: (e) => {
        fallo();
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e, 'No pudimos guardar la palabra clave.') });
      },
    });
  }
}
