import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Observable } from 'rxjs';
import { IconPlus, TablerIconComponent } from '@tabler/icons-angular';
import { mensajeDeError } from '../../../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../../../core/ui/alerta.service';
import { RespuestaRapida } from '../../../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../../../core/whatsapp/whatsapp.service';

/**
 * "Respuestas rápidas del equipo": los textos que se insertan con "/" en el
 * chat. Tocar una la edita (y deja borrarla); "Nueva respuesta" agrega otra.
 */
@Component({
  selector: 'app-respuestas-rapidas',
  imports: [NgTemplateOutlet, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './respuestas-rapidas.component.html',
  host: { class: 'block' },
})
export class RespuestasRapidasComponent {
  private readonly whatsapp = inject(WhatsappService);
  private readonly alertas = inject(AlertaService);

  readonly respuestas = input.required<RespuestaRapida[]>();
  readonly puedeConfigurar = input(false);
  readonly cambio = output<void>();

  protected readonly iMas = IconPlus;
  /** En el orden en que se crearon: las nuevas quedan al final. */
  protected readonly lista = computed(() => [...this.respuestas()].sort((a, b) => a.id - b.id));
  protected readonly form = signal<{ id?: number; atajo: string; texto: string } | null>(null);
  protected readonly guardando = signal(false);
  protected readonly confirmar = signal(false);
  private timerConfirmar?: ReturnType<typeof setTimeout>;

  protected abrir(r?: RespuestaRapida): void {
    if (!this.puedeConfigurar()) return;
    this.confirmar.set(false);
    this.form.set(r ? { id: r.id, atajo: r.atajo, texto: r.texto } : { atajo: '', texto: '' });
  }

  protected parche(cambio: Partial<{ atajo: string; texto: string }>): void {
    this.form.update((f) => (f ? { ...f, ...cambio } : f));
  }

  protected guardar(): void {
    const f = this.form();
    if (!f || this.guardando()) return;
    const atajo = f.atajo.trim().replace(/^\/+/, '');
    if (!atajo || !f.texto.trim()) return;
    this.ejecutar(
      this.whatsapp.guardarRespuestaRapida({ atajo, texto: f.texto.trim() }, f.id),
      f.id ? 'Respuesta rápida actualizada' : 'Respuesta rápida creada',
    );
  }

  /** Primer toque pide confirmación; el segundo borra. */
  protected borrar(): void {
    const id = this.form()?.id;
    if (!id || this.guardando()) return;
    clearTimeout(this.timerConfirmar);
    if (!this.confirmar()) {
      this.confirmar.set(true);
      this.timerConfirmar = setTimeout(() => this.confirmar.set(false), 4000);
      return;
    }
    this.confirmar.set(false);
    this.ejecutar(this.whatsapp.borrarRespuestaRapida(id), 'Respuesta rápida borrada');
  }

  private ejecutar(peticion: Observable<unknown>, exito: string): void {
    this.guardando.set(true);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.set(null);
        this.alertas.mostrar({ estado: 'success', titulo: exito });
        this.cambio.emit();
      },
      error: (e) => {
        this.guardando.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: mensajeDeError(e, 'No pudimos guardar la respuesta rápida.') });
      },
    });
  }
}
