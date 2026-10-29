import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { AdjuntoSolicitud } from '../../../../../../core/solicitudes/models/solicitud.model';
import { SolicitudesService } from '../../../../../../core/solicitudes/solicitudes.service';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/**
 * Miniaturas de las capturas de una solicitud. Son privadas: cada una se
 * descarga con el token (blob → `URL.createObjectURL`) y se libera al salir.
 * Un clic la abre en una pestaña nueva.
 */
@Component({
  selector: 'app-capturas-solicitud',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-2' },
  template: `
    @for (a of adjuntos(); track a.id) {
      @let url = urls()[a.id];
      <button
        type="button"
        (click)="abrir(a.id)"
        [title]="a.nombre"
        class="relative size-16 animate-[st-fade-in_.2s_both] cursor-zoom-in overflow-hidden rounded-[10px] bg-[#f4f4f4] shadow-[0_0_0_1px_#ececec] hover:shadow-[0_0_0_1px_#303030]"
      >
        @if (url) {
          <img [src]="url" [alt]="a.nombre" class="size-full object-cover" />
        } @else {
          <span class="flex size-full items-center justify-center text-[#9ca3af]"
            ><app-ic nombre="photo" [size]="18"
          /></span>
        }
      </button>
    }
  `,
})
export class CapturasSolicitudComponent {
  private readonly servicio = inject(SolicitudesService);

  readonly solicitudId = input.required<number>();
  readonly adjuntos = input.required<AdjuntoSolicitud[]>();

  protected readonly urls = signal<Record<number, string>>({});

  constructor() {
    effect(() => {
      const id = this.solicitudId();
      const faltan = this.adjuntos().filter((a) => !untracked(this.urls)[a.id]);
      for (const a of faltan)
        this.servicio
          .adjunto(id, a.id)
          .subscribe((b) =>
            this.urls.update((u) => (u[a.id] ? u : { ...u, [a.id]: URL.createObjectURL(b) })),
          );
    });
    inject(DestroyRef).onDestroy(() =>
      Object.values(this.urls()).forEach((u) => URL.revokeObjectURL(u)),
    );
  }

  protected abrir(id: number): void {
    const u = this.urls()[id];
    if (u) window.open(u, '_blank', 'noopener');
  }
}
