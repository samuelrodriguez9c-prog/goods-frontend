import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Modal genérico (backdrop + tarjeta blanca centrada) para los
 * formularios de crear/editar y las confirmaciones de eliminar que suma
 * el sidebar de staff (Planes, Usuarios, Roles — ver
 * PIVOTE_SAAS_MULTITENANT.md §8, sidebar de staff). No existía ningún
 * patrón de modal en el proyecto todavía (ni en `admin` ni en `staff`,
 * confirmado por grep) — se construye acá, local a `staff`, en vez de
 * promoverlo directo a `shared-ui`: mismo criterio que se usó con los
 * composites de `admin` antes de la librería (ver ADMIN_DISENO.md > "Qué
 * construir como librería propia") — recién se promueve cuando un
 * segundo proyecto también lo necesita.
 *
 * Deliberadamente NO usa `p-dialog` de PrimeNG: ninguna pantalla del
 * proyecto lo usaba todavía, y un `<div>` con Tailwind alcanza para lo
 * que hace falta acá (overlay + tarjeta + cerrar), sin sumar el `pt`
 * (passthrough) que requeriría estilizarlo al lenguaje visual propio —
 * mismo criterio anti-Angular-Forms del resto del código: no traer más
 * librería de la que la tarea realmente necesita.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  @Input() titulo = '';
  @Output() cerrar = new EventEmitter<void>();

  protected readonly iconClose = IconX;

  protected onBackdropClick(event: MouseEvent): void {
    // Solo cierra si el click fue directo sobre el backdrop, no si
    // empezó dentro de la tarjeta y arrastró hasta afuera (selección de
    // texto que termina fuera del modal no debería cerrarlo por error).
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
