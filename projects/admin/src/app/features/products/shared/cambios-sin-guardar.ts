import { DestroyRef, Signal, effect, inject } from '@angular/core';
import { AlertaService } from '../../../core/ui/alerta.service';

/**
 * Conecta un borrador de la hoja con la alerta fija "Cambios sin guardar".
 * Llamar en el constructor de la página:
 *
 *   vigilarCambios({ borrador: this.borrador, guardado: this.guardado, etiquetas: ETIQUETAS,
 *     nuevo: () => this.esNuevo(), guardar: () => this.guardar(), descartar: () => this.descartar() });
 *
 * Copy exacto del prototipo (productos-pila.js → pilaVM).
 */
export function vigilarCambios<T extends object>(cfg: {
  borrador: Signal<T | null>;
  guardado: Signal<T | null>;
  etiquetas: Partial<Record<keyof T, string>>;
  nuevo: () => boolean;
  /** "Producto sin guardar" / "Proveedor sin guardar"… */
  tituloNuevo: string;
  textoNuevo: string;
  guardar: () => void;
  descartar: () => void;
  /** Validación opcional: devuelve { titulo, texto } para mostrar en rojo. */
  invalido?: () => { titulo: string; texto: string } | null;
}): void {
  const alertas = inject(AlertaService);
  effect(() => {
    const d = cfg.borrador();
    const o = cfg.guardado();
    if (!d) return alertas.soltarCambios();
    const nuevo = cfg.nuevo() || !o;
    const campos = nuevo
      ? []
      : [...new Set((Object.keys(d) as (keyof T)[]).filter((k) => cfg.etiquetas[k] && JSON.stringify(d[k]) !== JSON.stringify(o![k])).map((k) => cfg.etiquetas[k]!))];
    if (!nuevo && !campos.length) return alertas.soltarCambios();
    const mal = cfg.invalido?.();
    const lista = campos.length === 1 ? campos[0] : campos.slice(0, -1).join(', ') + ' y ' + campos.at(-1);
    alertas.fijarCambios({
      estado: mal ? 'error' : 'warning',
      titulo: mal?.titulo ?? (nuevo ? cfg.tituloNuevo : 'Cambios sin guardar'),
      texto: mal?.texto ?? (nuevo ? cfg.textoNuevo : `Cambiaste ${lista}. Guarda para aplicarlo o descarta para volver a como estaba. Atajo: Ctrl + S.`),
      guardar: cfg.guardar,
      descartar: cfg.descartar,
    });
  });
  inject(DestroyRef).onDestroy(() => alertas.soltarCambios());
}

/** Ctrl/⌘ + S guarda; si hay cambios y se intenta cambiar de fila, la pila se sacude. */
export function esGuardar(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
}
