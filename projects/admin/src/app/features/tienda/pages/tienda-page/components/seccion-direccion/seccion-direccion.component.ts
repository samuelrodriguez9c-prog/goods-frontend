import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Paso 1 · la dirección pública: prefijo fijo + el nombre corto (letras, números y guiones). */
@Component({
  selector: 'app-seccion-direccion',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="flex items-center overflow-hidden rounded-[10px] border bg-white transition-[border-color,box-shadow] duration-200 focus-within:shadow-[0_0_0_3px_rgba(48,48,48,.08)]"
      [class]="valido() ? 'border-[#e3e3e3] focus-within:border-[#303030]' : 'border-[#d82c0d]'">
      <span class="shrink-0 border-r border-[#efefef] bg-[#fafafa] py-2 pr-2 pl-3 text-[13px] text-[#8a8a8a]">{{ prefijo() }}</span>
      <input id="slug" name="slug" [ngModel]="slug()" (ngModelChange)="normalizar($event)" maxlength="60" autocomplete="off" spellcheck="false"
        aria-label="Dirección de tu tienda" class="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] font-medium text-[#111827] outline-none" />
    </label>
    @if (!valido()) {
      <p class="m-0 mt-1.5 text-[12px] text-[#b42318]">Usa letras sin tildes, números y guiones, sin guion al inicio ni al final.</p>
    } @else {
      <p class="m-0 mt-1.5 text-[12px] text-[#8a8a8a]">Corta y fácil de dictar. Si la cambias después, el enlace viejo deja de funcionar.</p>
    }
  `,
})
export class SeccionDireccionComponent {
  readonly slug = model.required<string>();
  readonly prefijo = input('');
  readonly valido = input(true);

  protected normalizar(valor: string): void {
    this.slug.set(
      valor
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .slice(0, 60),
    );
  }
}
