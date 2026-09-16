import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IconX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Modal genérico (backdrop + tarjeta blanca centrada) — copiado a
 * propósito de `staff/shared/ui/modal/modal.component.ts` en vez de
 * importarlo desde ahí: son proyectos Angular separados, no hay forma de
 * importar entre ellos directamente. El comentario original de `staff`
 * decía que esto se promovería a `shared-ui` "recién cuando un segundo
 * proyecto también lo necesite" — ya pasó (Fase 5 de
 * PROPUESTA_ROLES_Y_ACCESOS.md, `SettingsUsersPageComponent`/
 * `SettingsRolesPageComponent`), pero migrar los 7 usos ya existentes en
 * `staff` a `shared-ui` es un refactor aparte, sin relación funcional con
 * esta fase — queda pendiente para no arriesgar pantallas que ya
 * funcionan por una limpieza cosmética.
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
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }
}
