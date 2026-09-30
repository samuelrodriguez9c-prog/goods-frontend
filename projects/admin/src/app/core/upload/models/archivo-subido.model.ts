// Espejo de `ArchivoSubido` (backend, `modules/upload/upload.service.ts`).
export interface ArchivoSubido {
  url: string;
  nombreArchivo: string;
  mimetype: string;
  tamano: number;
}
