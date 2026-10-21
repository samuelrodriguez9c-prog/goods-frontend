import { ChangeDetectionStrategy, Component, HostListener, computed, inject, output, signal } from '@angular/core';
import {
  IconArrowBackUp, IconChevronDown, IconCornerDownRight, IconFolder, IconX, TablerIconComponent,
} from '@tabler/icons-angular';
import { ATAJOS_POR_DEFECTO, AtajoId, AtajosService, verTecla } from '../../../../core/ui/atajos.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';

interface Fila {
  label: string;
  /** Editable: id del atajo. Fijo: las teclas tal cual. */
  id?: AtajoId;
  pre?: string;
  teclas?: string[];
  sep?: string;
}

/** La guía en árbol, igual que el filtro de categorías: grupo plegable → filas con ↳. */
const GRUPOS: { k: string; t: string; filas: Fila[] }[] = [
  { k: 'general', t: 'General', filas: [
    { label: 'Ver esta guía', teclas: ['Ctrl', '.'] },
    { label: 'Guardar cambios', teclas: ['Ctrl', 'S'] },
    { label: 'Ir al buscador general', teclas: ['Ctrl', 'K'] },
    { label: 'Cerrar menú, ventana o selección', teclas: ['Esc'] },
  ] },
  { k: 'mover', t: 'Moverte por el panel', filas: [
    { label: 'Ir a Productos', id: 'goP', pre: 'G' },
    { label: 'Ir a Categorías', id: 'goC', pre: 'G' },
    { label: 'Ir a Inventario', id: 'goI', pre: 'G' },
    { label: 'Ir a Proveedores', id: 'goR', pre: 'G' },
    { label: 'Ir a Compras', id: 'goM', pre: 'G' },
    { label: 'Subir o bajar al final de la lista', teclas: ['Inicio', 'Fin'], sep: 'o' },
  ] },
  { k: 'lista', t: 'Lista de productos', filas: [
    { label: 'Buscar en la lista', id: 'buscar' },
    { label: 'Producto siguiente', id: 'sig' },
    { label: 'Producto anterior', id: 'ant' },
    { label: 'Nuevo producto', id: 'nuevo' },
    { label: 'Mostrar u ocultar filtros', id: 'filtros' },
    { label: 'Cambiar entre lista y grilla', id: 'vista' },
    { label: 'Seleccionar el producto abierto', id: 'marcar' },
    { label: 'Seleccionar todos los visibles', teclas: ['Ctrl', 'A'] },
  ] },
  { k: 'ficha', t: 'Ficha y edición rápida', filas: [
    { label: 'Producto siguiente o anterior', teclas: ['↓', '↑'], sep: 'o' },
    { label: 'Expandir o contraer la ficha', id: 'expandir' },
    { label: 'Editar precio o stock en la tabla', teclas: ['Doble clic'] },
    { label: 'Confirmar o cancelar la edición', teclas: ['Enter', 'Esc'], sep: 'o' },
  ] },
];

/**
 * Guía de atajos (Ctrl + . o «Atajos» del menú).
 * "Cambiar" deja la fila esperando una tecla; Esc o Cancelar sale sin cambiar.
 */
@Component({
  selector: 'app-atajos-dialogo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TablerIconComponent],
  templateUrl: './atajos-dialogo.component.html',
})
export class AtajosDialogoComponent {
  protected readonly atajos = inject(AtajosService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  readonly cerrar = output<void>();

  protected readonly ic = { x: IconX, carpeta: IconFolder, abajo: IconChevronDown, hija: IconCornerDownRight, volver: IconArrowBackUp };
  protected readonly plegados = signal<Set<string>>(new Set());

  protected readonly grupos = computed(() => {
    const K = this.atajos.teclas(), cap = this.atajos.capturando();
    this.atajos.personalizados();
    return GRUPOS.map((g) => {
      const filas = g.filas.map((f) => {
        if (!f.id) return { ...f, editable: false, capturando: false, propio: false, teclas: f.teclas!, sep: f.sep ?? '+', original: '' };
        const t = verTecla(K[f.id]);
        return {
          ...f, editable: true, capturando: cap === f.id, propio: this.atajos.esPersonalizado(f.id),
          teclas: f.pre ? [f.pre, t] : [t], sep: 'luego',
          original: 'Volver a ' + (f.pre ? f.pre + ' luego ' : '') + verTecla(ATAJOS_POR_DEFECTO[f.id]),
        };
      });
      const editables = filas.filter((f) => f.editable).length;
      return {
        ...g, filas, abierto: !this.plegados().has(g.k), conPropios: filas.some((f) => f.propio),
        sub: filas.length + ' atajos' + (editables ? ' · ' + editables + ' editables' : ''),
      };
    });
  });

  protected alternar(k: string): void {
    this.atajos.capturando.set(null);
    this.plegados.update((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  protected cambiar(id: AtajoId): void {
    this.atajos.capturando.update((c) => (c === id ? null : id));
  }

  protected restablecer(id?: AtajoId): void {
    this.atajos.restablecer(id);
    this.pista.hecho(id ? 'Atajo restablecido' : 'Atajos restablecidos');
  }

  @HostListener('window:keydown', ['$event'])
  protected tecla(e: KeyboardEvent): void {
    const id = this.atajos.capturando();
    if (!id) {
      if (e.key === 'Escape') this.cerrar.emit();
      return;
    }
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return this.atajos.capturando.set(null);
    const r = this.atajos.aplicar(id, e);
    if (r.error) this.alertas.mostrar({ estado: 'warning', titulo: r.error });
    else if (r.intercambiado) this.pista.hecho('Intercambiado: el otro atajo ahora usa ' + verTecla(r.intercambiado));
  }
}
