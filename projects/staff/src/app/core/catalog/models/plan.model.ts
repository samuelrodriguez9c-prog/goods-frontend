/** Espejo de la entidad `Plan` del backend (`plan.entity.ts`). */
export interface Plan {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioMensual: number | null;
  caracteristicas: string[] | null;
  activo: boolean;
  /** Entitlement real de módulos (Fase 2 de
   * PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md, §11.6) — sumado a `GET
   * /planes/todos` recién en esa sección (antes esta respuesta no lo
   * traía). `ActivarEmpresaWizardComponent` lo usa para saber qué módulos
   * ya vienen incluidos en el plan elegido, antes de mostrar los "extra"
   * pedidos en el checkout (§11.7). */
  modulos: { codigo: string; nombre: string }[];
}
