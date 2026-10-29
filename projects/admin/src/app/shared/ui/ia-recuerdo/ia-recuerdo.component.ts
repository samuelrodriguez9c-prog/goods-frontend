import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconBookmark, IconCheck, IconUsers, IconUser, TablerIconComponent } from '@tabler/icons-angular';
import { AsistenteChatStore } from '../../../core/asistente/asistente-chat.store';
import { AsistenteRecuerdosService } from '../../../core/asistente/asistente-recuerdos.service';
import { AsistenteRecuerdo } from '../../../core/asistente/models/asistente.model';

/**
 * Tarjeta de un recuerdo bajo la respuesta del asistente, en la pantalla
 * completa y en el mini chat.
 *
 * - `propuesta`: «¿Lo recuerdo?» con Guardar / Descartar.
 * - `activa`: una línea «Lo recordaré» con Deshacer (lo borra).
 * - `descartada`: no se muestra.
 *
 * Cada acción actualiza el hilo en `AsistenteChatStore`, así la tarjeta no
 * vuelve a ofrecer lo que ya se resolvió al reabrir la conversación.
 */
@Component({
  selector: 'app-ia-recuerdo',
  standalone: true,
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ia-recuerdo.component.html',
})
export class IaRecuerdoComponent {
  private readonly api = inject(AsistenteRecuerdosService);
  private readonly store = inject(AsistenteChatStore);

  readonly recuerdo = input.required<AsistenteRecuerdo>();
  readonly mensajeId = input.required<number>();
  /** En el mini chat todo va un punto más chico. */
  readonly compacto = input(false);

  protected readonly i = { recuerdo: IconBookmark, ok: IconCheck, equipo: IconUsers, persona: IconUser };
  protected readonly ocupado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly paraQuien = computed(() => (this.recuerdo().alcance === 'empresa' ? 'Para todo el equipo' : 'Solo para ti'));

  protected guardar(): void {
    this.guardando.set(true);
    this.accion(this.api.guardar(this.recuerdo().id), 'No se pudo guardar.');
  }

  protected descartar(): void {
    this.accion(this.api.descartar(this.recuerdo().id), 'No se pudo descartar.');
  }

  /** Deshacer un recuerdo ya guardado: se borra de la memoria. */
  protected deshacer(): void {
    const r = this.recuerdo();
    this.ocupado.set(true);
    this.error.set(null);
    this.api.eliminar(r.id).subscribe({
      next: () => this.store.actualizarRecuerdo(this.mensajeId(), r.id, null),
      error: (e: HttpErrorResponse) => this.fallo(e, 'No se pudo deshacer.'),
    });
  }

  private accion(peticion: ReturnType<AsistenteRecuerdosService['guardar']>, porDefecto: string): void {
    const id = this.recuerdo().id;
    this.ocupado.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.store.actualizarRecuerdo(this.mensajeId(), id, r);
      },
      error: (e: HttpErrorResponse) => this.fallo(e, porDefecto),
    });
  }

  private fallo(e: HttpErrorResponse, porDefecto: string): void {
    this.ocupado.set(false);
    this.guardando.set(false);
    this.error.set(
      e.status === 403
        ? 'Tu rol no puede guardar recuerdos para todo el equipo.'
        : e.status === 404
          ? 'Ya no está: se resolvió en otra pestaña.'
          : (e.error?.message as string | undefined) ?? porDefecto,
    );
  }
}
