import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * Aviso "Hay cambios nuevos · Actualizar" (§5.4.4/§8, 2026-10-02) — banner
 * chico e inline (NO un toast flotante tipo `PistaComponent`: ese es para
 * confirmar algo que YA pasó y se auto-cierra solo en 2-5 s; acá es al
 * revés, invita a una acción y debe quedarse hasta que el usuario la
 * tome, así que vive dentro del propio contenido de la página, arriba de
 * la tabla/filtros).
 *
 * Puramente presentacional: la pantalla que lo usa decide CUÁNDO
 * mostrarlo (su propio `@if`) y qué hacer al tocar "Actualizar"
 * (`(actualizar)`) — normalmente, volver a llamar a su `cargar()` y
 * ocultar el aviso.
 */
@Component({
  selector: 'app-aviso-datos-nuevos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="animate-[fade-in-up_0.2s_ease-out] mb-3 flex items-center gap-2.5 rounded-xl border border-[#2be0d5]/30 bg-[#2be0d5]/[0.08] px-3.5 py-2.5 text-[13.5px] text-[#00605b]"
    >
      <span class="relative flex size-2 shrink-0">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2be0d5] opacity-75"></span>
        <span class="relative inline-flex size-2 rounded-full bg-[#2be0d5]"></span>
      </span>
      <span class="flex-1 font-medium">Hay cambios nuevos</span>
      <button
        type="button"
        (click)="actualizar.emit()"
        class="flex items-center gap-1.5 rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]"
      >
        Actualizar
      </button>
    </div>
  `,
})
export class AvisoDatosNuevosComponent {
  readonly actualizar = output<void>();
}
