import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { icono } from '../../../../shared/ui/iconos';
import { PopoverDirective } from '../../../../../../shared/ui/popover.directive';
import { Borrador, Miniatura, nombreCategoria, puntoEstado } from '../../categorias.util';
import { MenuActivo } from '../../menu-activo';
import { EtiquetaCampoComponent } from '../etiqueta-campo/etiqueta-campo.component';
import { MiniaturaComponent } from '../miniatura/miniatura.component';
import { TarjetaHojaComponent } from '../tarjeta-hoja/tarjeta-hoja.component';

export interface Subcategoria {
  id: number;
  nombre: string;
  miniatura: Miniatura;
  activa: boolean;
  productos: string;
}

/** Pestaña General de la hoja: Identidad, Organización y (en una principal) sus subcategorías. */
@Component({
  selector: 'app-pestana-general',
  standalone: true,
  imports: [TablerIconComponent, PopoverDirective, EtiquetaCampoComponent, MiniaturaComponent, TarjetaHojaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-[repeat(auto-fit,_minmax(max(270px,_calc((100%_-_12px)_/_2)),_1fr))] gap-3 pt-4' },
  templateUrl: './pestana-general.component.html',
})
export class PestanaGeneralComponent {
  private readonly s = inject(CatalogoStore);
  protected readonly menu = inject(MenuActivo);

  readonly borrador = input.required<Borrador>();
  /** null = nueva. */
  readonly categoriaId = input.required<number | null>();
  readonly soloLectura = input(false);
  /** Error del nombre a mostrar ('' = ninguno). */
  readonly errorNombre = input('');
  readonly subcategorias = input<Subcategoria[]>([]);
  readonly cambiar = output<Partial<Borrador>>();
  readonly nuevaSubcategoria = output<void>();
  readonly abrir = output<number>();

  private readonly nombreInput = viewChild<ElementRef<HTMLInputElement>>('nombreInput');

  protected readonly icono = icono;
  protected readonly puntoEstado = puntoEstado;

  protected readonly esPrincipal = computed(() => this.borrador().categoriaPadreId === '');
  /** Con subcategorías tiene que seguir siendo principal. */
  protected readonly padreBloqueado = computed(() => this.subcategorias().length > 0);
  protected readonly opcionesPadre = computed(() => {
    const id = this.categoriaId();
    const principales = this.s
      .categorias()
      .filter((c) => !c.categoriaPadreId && c.id !== id)
      .sort((a, b) => a.id - b.id);
    return [
      { valor: '', nombre: 'Ninguna · es principal', icono: 'folder-up' },
      ...principales.map((c) => ({ valor: String(c.id), nombre: c.nombre, icono: this.s.tono(c.id)[2] })),
    ];
  });
  protected readonly nombrePadre = computed(() =>
    this.esPrincipal() ? 'Ninguna · es principal' : nombreCategoria(this.s, +this.borrador().categoriaPadreId),
  );

  enfocarNombre(): void {
    this.nombreInput()?.nativeElement.focus();
  }

  protected alternarPadre(e: Event): void {
    if (this.soloLectura() || this.padreBloqueado()) e.stopPropagation();
    else this.menu.alternar('padre', e);
  }
  protected elegirPadre(valor: string): void {
    this.cambiar.emit({ categoriaPadreId: valor });
    this.menu.cerrar();
  }
  protected elegirEstado(activo: boolean): void {
    if (!this.soloLectura()) this.cambiar.emit({ activo });
  }
}
