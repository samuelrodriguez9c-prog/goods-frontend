import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeDeError } from '../../../../../../core/solicitudes/solicitudes.service';
import { MonedaTienda } from '../../../../../../core/tienda/tienda.service';
import { AlertaService } from '../../../../../../core/ui/alerta.service';
import { UploadService } from '../../../../../../core/upload/upload.service';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/**
 * Paso 3 · cómo se ve: logo (se puede soltar encima o elegir), la frase
 * bajo el nombre y la moneda de los precios.
 */
@Component({
  selector: 'app-seccion-identidad',
  standalone: true,
  imports: [FormsModule, IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
      <!-- Logo -->
      <label class="group relative flex size-[104px] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[22px] border border-dashed text-center transition-[border-color,background-color] duration-200"
        [class]="arrastrando() ? 'border-[#2be0d5] bg-[#e0f7f5]' : logoUrl() ? 'border-transparent bg-[#f4f4f4]' : 'border-[#d4d4d4] bg-[#fafafa] hover:border-[#303030]'"
        (dragover)="$event.preventDefault(); arrastrando.set(true)" (dragleave)="arrastrando.set(false)" (drop)="soltar($event)" title="Logo de la tienda">
        @if (logoUrl()) {
          <img [src]="logoUrl()" alt="Logo de la tienda" class="absolute inset-0 size-full object-cover" />
          <span class="absolute inset-0 flex items-center justify-center bg-black/45 text-[11.5px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Cambiar</span>
        } @else {
          <app-ic [nombre]="subiendo() ? 'clock' : 'photo'" [size]="20" class="text-[#8a8a8a]" />
          <span class="px-2 text-[11px] leading-[14px] text-[#6b7280]">{{ subiendo() ? 'Subiendo…' : 'Suelta o elige tu logo' }}</span>
        }
        <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="elegir($event)" [disabled]="subiendo()" />
      </label>
      <!-- Frase -->
      <div class="flex min-w-0 flex-col">
        <span class="gp-label">Frase bajo el nombre</span>
        <textarea id="descripcion" name="descripcion" rows="3" maxlength="280" [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)"
          placeholder="Ej. Pan de masa madre horneado cada mañana. Entregas el mismo día en Medellín." class="gp-input resize-none leading-[19px]"></textarea>
        <div class="mt-1 flex items-center justify-between text-[11.5px]">
          @if (logoUrl()) {
            <button type="button" (click)="logoUrl.set(null)" class="flex cursor-pointer items-center gap-1 text-[#8a8a8a] hover:text-[#b42318]"><app-ic nombre="trash" [size]="12" />Quitar logo</button>
          } @else {
            <span class="text-[#a3a3a3]">Logo cuadrado, mínimo 200 × 200 px</span>
          }
          <span class="tabular-nums" [style.color]="descripcion().length > 250 ? '#b45309' : '#a3a3a3'">{{ descripcion().length }}/280</span>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-[12.5px] font-medium text-gray-500">Moneda de los precios</span>
      <div class="flex gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]" role="radiogroup" aria-label="Moneda">
        @for (m of monedas; track m.v) {
          <button type="button" role="radio" [attr.aria-checked]="moneda() === m.v" (click)="moneda.set(m.v)"
            class="h-[30px] cursor-pointer rounded-lg px-3 text-[12.5px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200"
            [class]="moneda() === m.v ? 'bg-white font-semibold text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)]' : 'font-medium text-[#6b7280] hover:text-[#111827]'">{{ m.t }}</button>
        }
      </div>
    </div>
  `,
})
export class SeccionIdentidadComponent {
  private readonly upload = inject(UploadService);
  private readonly alertas = inject(AlertaService);
  readonly logoUrl = model.required<string | null>();
  readonly descripcion = model.required<string>();
  readonly moneda = model.required<MonedaTienda>();
  protected readonly subiendo = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly monedas: { v: MonedaTienda; t: string }[] = [
    { v: 'COP', t: 'Pesos · COP' },
    { v: 'USD', t: 'Dólares · USD' },
  ];

  protected elegir(e: Event): void {
    const input = e.target as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (f) this.subir(f);
  }

  protected soltar(e: DragEvent): void {
    e.preventDefault();
    this.arrastrando.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && /^image\/(png|jpe?g|webp)$/.test(f.type)) this.subir(f);
  }

  private subir(f: File): void {
    this.subiendo.set(true);
    this.upload.subir(f).subscribe({
      next: (r) => { this.logoUrl.set(r.url); this.subiendo.set(false); },
      error: (e) => {
        this.subiendo.set(false);
        this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo subir el logo', texto: mensajeDeError(e) });
      },
    });
  }
}
