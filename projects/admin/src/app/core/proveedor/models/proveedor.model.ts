// Espejo mínimo de la entidad `Proveedor` del backend
// (`modules/proveedor/entities/proveedor.entity.ts`) — solo los campos
// que el frontend de `admin` necesita hoy (el listado/creación desde el
// modo documento del Asistente de IA, §5.5 de
// `PROPUESTA_ASISTENTE_IA_RAG.md`). El resto de campos (nit, correo,
// telefono, direccion, contactoNombre, notas) existen en el backend pero
// no hace falta modelarlos acá todavía — no hay ninguna pantalla de
// gestión de proveedores construida aún (`ProductSuppliersPageComponent`
// sigue siendo un placeholder).
export interface Proveedor {
  id: number;
  nombre: string;
  activo: boolean;
}
