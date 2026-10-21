/** Espejo parcial de `Usuario` con lo que hace falta para gestionar al
 * personal de Goods (sin las columnas de e-commerce: dirección, puntos,
 * referidos). Acá `empresaId` siempre es `null`. */
export interface UsuarioGoods {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  correoVerificado: boolean;
  telefono: string | null;
  imagenPerfil: string | null;
  rolId: number;
  /** Siempre viene (el backend carga la relación). */
  rol: { id: number; nombre: string };
  activo: boolean;
  creadoEn: string;
  /** Puede ser `null` en cuentas que no han vuelto a entrar aunque tengan
   * accesos auditados: por eso `usuarios-page` lo combina con la auditoría
   * (`ultimoMsEfectivo`). */
  ultimoAcceso: string | null;
}

/** Igual que el de `core/catalog/models/empresa.model.ts`; se repite a propósito. */
export interface RespuestaPaginada<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPaginas: number;
}
