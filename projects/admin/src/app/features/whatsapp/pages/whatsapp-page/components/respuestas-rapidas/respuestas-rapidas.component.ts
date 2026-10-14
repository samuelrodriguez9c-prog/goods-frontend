import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { RespuestaRapida } from '../../../../../../core/whatsapp/whatsapp.model';

/**
 * Popover de Respuestas rápidas sobre el compositor: buscador por atajo o
 * texto, lista con ↑/↓ y Enter, y `{nombre}` resaltado con el nombre del
 * cliente (se llena solo al insertar). El estado (consulta, elegida) lo
 * lleva el compositor, que también atiende "/atajo" en el cuadro de texto.
 */
@Component({
  selector: 'app-respuestas-rapidas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './respuestas-rapidas.component.html',
  host: {
    class:
      'animar-popover absolute bottom-[calc(100%-2px)] left-3 z-20 flex w-[min(440px,calc(100%-24px))] flex-col rounded-2xl bg-white p-2.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)]',
    '[style.max-height.px]': 'maxAlto()',
    '(click)': '$event.stopPropagation()',
  },
})
export class RespuestasRapidasComponent {
  readonly rapidas = input.required<RespuestaRapida[]>();
  readonly elegida = input(0);
  readonly consulta = input('');
  readonly cliente = input('');
  readonly maxAlto = input<number | null>(null);

  readonly consultaChange = output<string>();
  readonly tecla = output<KeyboardEvent>();
  readonly usar = output<RespuestaRapida>();
  readonly resaltar = output<number>();
  readonly editar = output<void>();

  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  protected readonly filas = computed(() =>
    this.rapidas().map((r) => ({
      r,
      titulo: titulo(r.atajo),
      partes: r.texto
        .split(/(\{nombre\})/i)
        .filter(Boolean)
        .map((t) => (/^\{nombre\}$/i.test(t) ? { t: this.cliente() || 'cliente', token: true } : { t, token: false })),
    })),
  );

  enfocar(): void {
    this.buscador()?.nativeElement.focus();
  }
}

/** "domicilio-express" → "Domicilio express". */
function titulo(atajo: string): string {
  const t = atajo.replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
