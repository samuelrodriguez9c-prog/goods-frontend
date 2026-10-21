import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { AjustesModulo } from '../../../../core/catalog/models/modulo.model';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { hace } from '../../../../shared/ui/lista-hoja/formato';

/**
 * Ajustes de un módulo para una Empresa, dentro de la fila del módulo en la
 * ficha. Los campos y sus opciones vienen del backend (catálogo cerrado por
 * módulo), así que un módulo nuevo con ajustes no necesita cambios acá.
 */
@Component({
  selector: 'app-ajustes-modulo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ml-[19px] mt-2 flex animate-[fade-in-up_0.18s_ease-out] flex-col gap-3 rounded-xl bg-[#f7f7f7] p-3">
      @if (datos(); as d) {
        @for (c of d.campos; track c.clave) {
          <div class="flex flex-col gap-1.5" role="radiogroup" [attr.aria-label]="c.titulo">
            <span class="flex flex-col gap-px">
              <span class="text-[12.5px] font-medium text-gray-900">{{ c.titulo }}</span>
              <span class="text-[11.5px] text-gray-500">{{ c.ayuda }}</span>
            </span>
            <div class="flex flex-wrap gap-1.5">
              @for (o of c.opciones; track o.valor) {
                @let elegida = borrador()[c.clave] === o.valor;
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="elegida"
                  (click)="elegir(c.clave, o.valor)"
                  class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors duration-150"
                  [class]="elegida ? 'bg-[#303030] text-white' : 'bg-white text-[#303030] hover:bg-[#ececec]'"
                >
                  {{ o.texto }}
                  @if (o.valor === d.defectos[c.clave]) {
                    <span class="text-[10.5px]" [class]="elegida ? 'text-white/60' : 'text-gray-400'">defecto</span>
                  }
                </button>
              }
            </div>
          </div>
        }
        @if (d.actualizadoEn) {
          <p class="text-[11.5px] text-gray-400">Último cambio {{ hace(d.actualizadoEn) }}{{ d.actualizadoPor ? ' · ' + d.actualizadoPor : '' }}</p>
        }
        <div class="flex items-center gap-1.5">
          @if (!enDefectos()) {
            <button type="button" (click)="aDefectos()" class="rounded-full px-[13px] py-1.5 text-[12.5px] font-medium text-gray-600 hover:bg-[#ececec]">Volver a los defectos</button>
          }
          <span class="flex-1"></span>
          <button type="button" (click)="cerrar.emit()" class="rounded-full px-[13px] py-1.5 text-[12.5px] font-medium text-gray-600 hover:bg-[#ececec]">Cancelar</button>
          <button
            type="button"
            (click)="guardar()"
            [disabled]="!cambiado() || guardando()"
            class="rounded-full bg-[#303030] px-[13px] py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
          >Guardar</button>
        </div>
      } @else if (error()) {
        <p class="text-xs text-gray-600">No se pudieron cargar los ajustes.</p>
        <div class="flex justify-end gap-1.5">
          <button type="button" (click)="cerrar.emit()" class="rounded-full px-[13px] py-1.5 text-[12.5px] font-medium text-gray-600 hover:bg-[#ececec]">Cerrar</button>
          <button type="button" (click)="cargar()" class="rounded-full bg-[#303030] px-[13px] py-1.5 text-[12.5px] font-medium text-white">Reintentar</button>
        </div>
      } @else {
        <p class="text-xs text-gray-500">Cargando ajustes…</p>
      }
    </div>
  `,
})
export class AjustesModuloComponent implements OnInit {
  private readonly moduloService = inject(ModuloService);
  private readonly alertas = inject(AlertaService);

  readonly empresaId = input.required<number>();
  readonly empresaNombre = input.required<string>();
  readonly codigo = input.required<string>();
  readonly cerrar = output<void>();
  /** Se guardó: la ficha recarga el desglose (cuenta de ajustes propios). */
  readonly guardado = output<void>();

  protected readonly hace = hace;
  protected readonly datos = signal<AjustesModulo | null>(null);
  protected readonly error = signal(false);
  protected readonly guardando = signal(false);
  /** Valor elegido por campo; arranca en los efectivos. */
  protected readonly borrador = signal<Record<string, string>>({});

  protected readonly cambiado = computed(() => {
    const d = this.datos();
    return !!d && d.campos.some((c) => this.borrador()[c.clave] !== d.efectivos[c.clave]);
  });
  protected readonly enDefectos = computed(() => {
    const d = this.datos();
    return !d || d.campos.every((c) => this.borrador()[c.clave] === d.defectos[c.clave]);
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.error.set(false);
    this.moduloService.ajustes(this.empresaId(), this.codigo()).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.borrador.set({ ...d.efectivos });
      },
      error: () => this.error.set(true),
    });
  }

  protected elegir(clave: string, valor: string): void {
    this.borrador.update((b) => ({ ...b, [clave]: valor }));
  }

  protected aDefectos(): void {
    const d = this.datos();
    if (d) this.borrador.set({ ...d.defectos });
  }

  /** Manda solo lo que se aparta de los defectos; el backend descarta el resto igual. */
  protected guardar(): void {
    const d = this.datos();
    if (!d) return;
    const valores = Object.fromEntries(Object.entries(this.borrador()).filter(([k, v]) => v !== d.defectos[k]));
    this.guardando.set(true);
    this.alertas
      .seguir(this.moduloService.guardarAjustes(this.empresaId(), this.codigo(), valores), {
        titulo: 'Guardando ajustes', texto: `${d.nombre} · ${this.empresaNombre()}`,
        exito: { titulo: 'Ajustes guardados', texto: Object.keys(valores).length ? d.nombre : `${d.nombre} vuelve a los defectos` },
        error: { titulo: 'No se pudieron guardar los ajustes', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.guardado.emit();
          this.cerrar.emit();
        },
        error: () => this.guardando.set(false),
      });
  }
}
