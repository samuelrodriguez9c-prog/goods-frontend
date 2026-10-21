# Cómo comentar el código

Guía corta para `admin`, `staff` y `tienda` (Angular, TypeScript, CSS con Tailwind v4).

**La regla de oro:** el código dice *qué* hace y *cómo*; el comentario explica *por qué*. Si hace falta un comentario para entender qué hace algo, primero mejora los nombres o divide la función.

**Idioma:** los comentarios van en español, con tuteo, igual que los textos de la interfaz. Los nombres técnicos (tipos, métodos, códigos HTTP) se dejan como están.

---

## 1. Cuándo comentar

**Sí:**
- **Reglas de negocio** que a simple vista parecen raras.
  `// Los pedidos de la tienda no apartan stock: se valida al confirmar.`
- **Decisiones de producto** que alguien podría «arreglar» sin saber el motivo. Se deja el motivo, no quién ni cuándo lo decidió.
  `// Sin barra de scroll: tapaba el botón del Asistente de IA.`
- **Casos límite y restricciones externas** (backend, navegador, librerías).
  `// Safari no anima height: auto; por eso se mide y se fija en px.`
- **Parches temporales**, con un `TODO` que diga qué falta y dónde.
- **Lo que usa todo el equipo:** servicios, stores, utilidades compartidas, y los `input()`/`output()` que no sean obvios.

**No:**
- Repetir lo que dice el código: `contador++; // suma 1`.
- **Historia:** fechas, «rediseño del 14 de octubre», «antes era así», «lo pidió X», «handoff Y». Eso va en el commit o el PR.
  La diferencia con una decisión de producto: el **motivo** se queda en el código; la **anécdota** (fecha, persona, reunión, versión del diseño) se va al PR.
- **Código comentado:** si sobra, se borra. Git lo guarda.
- Repetir el tipo: TypeScript ya lo dice.

---

## 2. TypeScript: JSDoc / TSDoc

Usa `/** … */` en clases, servicios y stores. Para notas dentro de una función, `//`.

En los **métodos públicos**, el JSDoc es obligatorio cuando hay algo que no se ve en la firma:

- efectos secundarios (avisa al equipo, reserva stock, cierra la sesión);
- errores que el que llama debe manejar (por ejemplo, un 409);
- reglas sobre los parámetros, o un valor de retorno que hay que interpretar.

Un método que se entiende por su nombre y sus tipos (`listar()`, `obtener(id)`) no lo necesita: basta el comentario de la clase. Un JSDoc que repite el nombre es ruido.

Qué incluir:

| Parte | Para qué |
|---|---|
| Descripción | Qué resuelve, en una o dos líneas. |
| `@param nombre -` | Qué representa y sus reglas. **No el tipo.** |
| `@returns` | Qué devuelve y qué significa (por ejemplo, `true` = el servidor aceptó). |
| `@throws` | Solo si lanza errores que el que llama debe manejar. |
| `@remarks` | Detalles importantes: efectos secundarios, reintentos, eventos. |
| `@example` | En utilidades compartidas. |
| `@deprecated` | Qué usar en su lugar. |

### Mal

```ts
// Servicio de pedidos
@Injectable({ providedIn: 'root' })
export class PedidoService {
  // Cambia el estado
  cambiarEstado(id: number, estado: EstadoPedido) {
    // hace la petición
    return this.http.patch(`${this.base}/${id}/estado`, { estado });
  }
}
```

### Bien

```ts
/** Cliente de `PedidoController` (módulo `orders`, permisos `pedidos.*`). */
@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);

  /**
   * Pasa el pedido al estado indicado.
   *
   * @remarks
   * Confirmar un pedido puede responder 409 si ya no alcanza el stock;
   * el mensaje del servidor dice qué falta.
   *
   * @param id - Id del pedido.
   * @param estado - Destino; debe estar en `TRANSICIONES_PEDIDO[estado actual]`.
   * @param motivo - Opcional; se guarda al cancelar o devolver.
   * @returns El pedido como quedó en el servidor.
   */
  cambiarEstado(id: number, estado: EstadoPedido, motivo?: string): Observable<DetallePedido> {
    return this.http.patch<DetallePedido>(`${this.base}/${id}/estado`, motivo ? { estado, motivo } : { estado });
  }
}
```

**El comentario tiene que ser verdad.** Si dice «reintenta», el código tiene que tener `retry`. Al cambiar el código, revisa el comentario: un comentario desactualizado es peor que ninguno.

### Componentes

Comenta qué muestra el componente y las entradas o salidas que no se entienden solas:

```ts
/** Pastilla del estado del pago («Por cobrar», «Pagado», «Reembolsado») con su punto de color. */
@Component({ selector: 'app-insignia-pago', … })
export class InsigniaPagoComponent {
  readonly estado = input.required<EstadoPago>();
  /** Si se pasa, se muestra después del estado: «Pagado · Nequi». */
  readonly metodo = input('');
}
```

### TODO

Que digan qué falta y de quién depende:

```ts
// TODO(backend): exponer el costo de envío por zona; mientras tanto se escribe a mano.
```

Si hay un issue, enlázalo: `// TODO(backend, #123): …`. Al cerrar el TODO, se borra el comentario.

No: `// TODO arreglar`, `// FIXME`, `// ojo con esto`.

---

## 3. Plantillas HTML

- Sintaxis: `<!-- … -->`. Angular **las quita al compilar**: no llegan al navegador ni al bundle.
- Usa el control de flujo actual (`@if`, `@for`, `@let`), no `*ngIf` / `*ngFor`.
- Un comentario corto para marcar una parte está bien:

  ```html
  <!-- Comprobante: solo en Productos y en lectura -->
  @if (pestana() === 'productos' && !enForm()) { … }
  ```

- **Si la plantilla necesita separadores grandes** (`<!-- ===== SECCIÓN ===== -->`) para no perderse, esa sección debe ser **su propio componente**, en su propia carpeta.

---

## 4. CSS (Tailwind v4)

- El proyecto usa **CSS normal, no SCSS**. El único comentario válido es `/* … */`. **`//` no es comentario en CSS** y puede romper la regla siguiente.
- El build de producción quita los comentarios al minificar; solo quedan los `/*! … */` (licencias).
- Comenta **por qué** existe una regla global, un `@keyframes` o un `@utility`:

  ```css
  /* Con el panel montado la ventana no se desplaza: solo `main`, sin mostrar la barra. */
  html:has(.shell-raiz) { overflow: hidden; }
  ```

---

## 5. Revisiones automáticas

Lo que se puede revisar solo, no debería depender de la memoria de nadie:

| Regla | Cómo se revisa |
|---|---|
| `//` en CSS | stylelint con `no-invalid-double-slash-comments`. |
| Fechas en comentarios | Buscar `20\d\d-\d\d-\d\d` en comentarios de `.ts`, `.html` y `.css` (script en CI o revisión del PR). |
| Código comentado | Revisión del PR; si se repite, una regla de lint para bloques comentados. |

---

## 6. Seguridad

**Nada sensible en el frontend, en ningún formato:** ni en comentarios, ni en código, ni en `environment.ts`. Todo lo que se descarga en el navegador es público. Las llaves, tokens y URLs internas van en el backend.

---

## 7. Alcance

Esta guía es para el frontend. El backend sigue las mismas reglas, con una excepción: las **migraciones** pueden llevar fecha y contexto (qué se cambió y por qué ese día), porque son historia por naturaleza.

---

## Lista rápida antes de subir

- [ ] Los comentarios explican el *por qué*, no el *qué*.
- [ ] Ningún comentario con fechas, historia ni nombres de handoff (el motivo de una decisión sí se queda).
- [ ] Los comentarios del código que cambié siguen siendo verdad.
- [ ] Sin código comentado.
- [ ] Los TODO dicen qué falta y de quién depende.
- [ ] Los métodos públicos con efectos, errores esperables o reglas tienen JSDoc.
- [ ] En CSS, solo `/* … */`.
