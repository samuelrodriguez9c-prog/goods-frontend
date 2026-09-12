# Referencia de diseño — Panel administrativo (Goods)

> Este archivo documenta decisiones de diseño para el frontend del admin,
> basadas en capturas reales del admin de Shopify (versión Spring '26,
> con su asistente "Sidekick" integrado) que el cliente ya aprobó como
> referencia. Las capturas completas (219 imágenes) están en la carpeta
> `png/`, nombradas `Shopify Web <N>.png`, sin categorizar — este
> documento recoge lo ya revisado y organizado por módulo, para no tener
> que volver a examinar las 219 cada vez.
>
> Shopify usa su propio sistema de diseño llamado **Polaris**
> (documentado públicamente: tokens de color, espaciado, tipografía,
> especificación de componentes). Nosotros construimos en Angular, no
> React, así que no podemos usar los componentes de Polaris directo,
> pero sí replicar su lenguaje visual (tokens, layout, comportamiento)
> sobre Angular Material personalizado o Tailwind + componentes propios
> — la decisión de cuál se toma aparte, en la capa de "librería de
> componentes".

## Lenguaje visual general (aplica a todo el admin)

- **Corrección (verificado con pipeta sobre las capturas reales):** el
  sidebar izquierdo **no es negro** — es gris muy claro (`#ebebeb`), el
  mismo tono de familia que el fondo de contenido pero un poco más
  oscuro para diferenciarse como panel. Lo único realmente casi-negro es
  la barra superior (`#0a0a0a`). La descripción anterior ("sidebar casi
  negro") era un error de lectura visual a distancia — quedó corregido
  aquí y en la sección de tokens de color más abajo.
- Sidebar izquierdo gris muy claro, con navegación por ícono + texto y
  submenús expandibles (ej. Orders → Drafts/Shipping labels; Products →
  Collections/Inventory). El item activo se resalta con una píldora aún
  más clara (casi blanca) sobre ese fondo gris.
- Barra superior oscura (casi negra): buscador global, ícono de
  asistente IA, notificaciones, usuario. En pantallas de edición se
  vuelve contextual (breadcrumb + título + acciones a la derecha, o
  aviso de "cambios sin guardar" con Discard/Save).
- Fondo de contenido gris muy claro (`#f1f1f1`, un poco más claro que el
  sidebar); tarjetas blancas puras (`#ffffff`) de esquinas redondeadas
  con sombra sutil — el contraste entre canvas y tarjeta es sutil pero
  real y perceptible al hacer pipeta.
- Color reservado casi exclusivamente para estado: verde (activo/pagado/
  éxito), naranja-ámbar (pendiente/en espera/vencido), rojo (error/
  crítico), azul (links). Todo lo demás en negro/gris.
- Botones primarios: negro sólido (no un negro puro — ver tokens), texto
  blanco. Secundarios: blancos con borde.
- Modales centrados: header con título + X, footer con Cancelar +
  acción primaria.
- Páginas de detalle (pedido, cliente): contenido principal a la
  izquierda (líneas, resumen, timeline), panel derecho con metadata
  (cliente, canal, direcciones, notas, etiquetas) — patrón repetido en
  varios módulos.
- Tablas: checkboxes de selección, badges de estado, barra de acciones
  en lote al seleccionar filas ("3 selected" + botones de acción).

### Tokens de color (extraídos con pipeta de las capturas reales)

Metodología: en vez de adivinar valores hex "que se ven parecidos", se
recortó cada elemento de interés de las capturas PNG originales (sin
comprimir) y se calculó el color dominante real por conteo de píxeles
(moda, no promedio — el promedio se contamina con el anti-aliasing de
bordes y texto). Se evitaron capturas con un modal abierto para los
colores de fondo/superficie, porque el scrim semitransparente del modal
oscurece todo lo que queda detrás y falsea la lectura.

| Token | Hex | Uso | Fuente (captura) |
|---|---|---|---|
| `--color-topbar` | `#0a0a0a` | Barra superior | 106 |
| `--color-sidebar-bg` | `#ebebeb` | Fondo del sidebar | 106 |
| `--color-canvas-bg` | `#f1f1f1` | Fondo del área de contenido | 106, 479 |
| `--color-card-bg` | `#ffffff` | Fondo de tarjetas | 479 |
| `--color-nav-active` | `#fafafa` | Píldora del item de nav activo | 106 |
| `--color-primary-button` | `#303030` | Botón primario (Save, Create order, Add customer) | 445, 479 |
| `--color-badge-neutral-bg` | `#e3e3e3` | Badge neutro (ej. "Paid") | 106 |
| `--color-badge-warning-bg` | `#ffeb79` | Badge de pendiente/en espera (ej. "Unfulfilled", "Payment pending") | 106 |
| `--color-badge-warning-solid` | `#ffb904` | Banner/alerta ámbar sólida (ej. "Erasure request submitted") | 479 |
| `--color-badge-success-bg` | `#a4ffb6` | Badge de éxito claro (ej. "Active") | 336 |
| `--color-success-solid` | `#087b5d` | Verde sólido para indicadores de estado (ej. puntos de "Email/SMS/WhatsApp" en Marketing) | 479 |

Notas:
- Todavía falta un rojo/error de referencia — ninguna de las capturas
  revisadas hasta ahora muestra un badge o alerta de error en pantalla.
  Se tomará de una captura futura que sí lo muestre, o si no aparece
  ninguna, se usará un rojo estándar de Polaris documentado públicamente
  (`#d82c0d` aprox.) como placeholder razonable.
- Estos tokens ya están escritos como bloque `@theme` de Tailwind v4 en
  `frontend/projects/admin/src/styles.css` (ver sección "Implicaciones
  técnicas" más abajo).

## Dashboard / Analítica

Fuente: capturas 19, 20, 26 (Home) y 61 (Orders).

El hallazgo clave: **no es una sola pantalla de dashboard aislada**. Es
un componente de "franja de KPIs" reutilizable que cada módulo puede
instanciar con sus propias métricas — aparece en el Home (Sessions,
Total sales, Orders, Conversion rate, Live visitors) y por separado,
con métricas distintas, en la propia pantalla de Orders (Orders, Items
ordered, Returns, Orders fulfilled, Orders delivered, todo con el
filtro "Today").

Comportamiento del componente de KPI:
- Cada tarjeta muestra: nombre de la métrica, número grande, y una
  mini-gráfica de tendencia (sparkline) sin ejes ni etiquetas — solo la
  forma de la curva. Si no hay tendencia que mostrar (ej. "0%"), se
  muestra un guion en vez del sparkline — no se oculta la tarjeta.
- Al hacer clic en una tarjeta, **se expande en el mismo lugar** (no
  navega a otra página) mostrando uno de dos contenidos:
  - Una gráfica de línea completa con eje de fechas, comparando el
    período actual (línea sólida) contra el período anterior (línea
    punteada), con leyenda de fechas exactas debajo.
  - Una tabla de desglose (ej. "Total sales" se abre en: Ventas brutas,
    Descuentos, Devoluciones, Ventas netas, Envío, Impuestos, Total),
    donde cada fila es a su vez un link para seguir profundizando.
- Arriba de la franja de KPIs: selector de período (ej. "Last 30 days")
  y de canal/alcance (ej. "All channels").
- "Live visitors" con un punto verde pulsante — indicador en tiempo
  real. En Goods esto lo podemos lograr con la infraestructura de
  WebSockets ya construida (`RealtimeGateway`), ej. "usuarios conectados
  ahora".

### Cómo mapea al alcance ya definido para Goods

(Ver `backend/MODULOS_PENDIENTES.md`, sección "Dashboard / analítica"
para el alcance funcional acordado con gerencia.)

- **Usuarios** → tarjeta "Nuevos registros" con sparkline, expandible a
  gráfica de línea con período de comparación.
- **Ventas / ingresos** → tarjeta "Ventas totales" expandible al
  desglose (bruto, descuentos, devoluciones, neto, envío, total) —
  mapea directo a nuestras entidades `pedido`/`pago`.
- **Pedidos** → franja de KPIs propia dentro de la pantalla de listado
  de pedidos (no solo en el dashboard global), con métricas propias:
  pedidos hoy, ítems vendidos, devoluciones, etc.
- **Productos e inventario** → por el mismo patrón, una franja de KPIs
  en la pantalla de productos (más vendidos, stock bajo el mínimo).

### Implicaciones técnicas (para cuando se construya)

- Frontend: un componente Angular de "tarjeta KPI" reutilizable —
  número + sparkline + slot de contenido expandido intercambiable
  (gráfica de línea vs. tabla de desglose).
- Backend: los endpoints de analítica no pueden devolver solo el total
  actual — necesitan series de tiempo con período de comparación (dos
  rangos de fechas, no uno) para poder dibujar la línea sólida vs.
  punteada.

## Pedidos / Órdenes

Fuente: capturas 106, 107, 111, 124, 127, 130, 133, 134 (todas sobre la
misma orden de ejemplo, #1003, vista en distintos momentos de su ciclo de
vida), más 61 y 65 del muestreo general.

### Página de detalle de la orden

Layout de dos columnas (ya anotado en "Lenguaje visual general"), aplicado
aquí así:

- **Header**: `#1003` + badges de estado en línea (ej. "Paid" + "Unfulfilled",
  o "Partially refunded" + "Unfulfilled" — **pueden coexistir dos badges de
  naturaleza distinta**: uno de pago, otro de cumplimiento/envío). A la
  derecha: Refund, Edit, Print, More actions, y flechas de
  orden-anterior/siguiente.
- **Columna izquierda**: una tarjeta por cada "grupo de cumplimiento"
  (fulfillment group) — no es una sola lista de líneas. En la orden de
  ejemplo aparecen tres grupos distintos apilados: "Unfulfilled (13)" con
  método de envío (Express) y sus líneas, "Removed (7)" con las líneas que
  se quitaron de la orden, y un resumen "Partially refunded" (Original
  order / Subtotal / Discount / Shipping / Total / Paid / Refunded / Net
  payment). Cada grupo "Unfulfilled" tiene sus propios botones
  contextuales: "Mark as fulfilled ▾" (split-button con opciones "Mark as
  in progress" / "Mark as on hold") y "Create shipping label".
- **Columna derecha**: Notes, Channel Information, Customer (con link al
  perfil, dirección de envío/facturación, contacto), Conversion summary,
  Order risk ("Analysis not available" cuando no aplica), y Tags (input
  libre).
- **Timeline / bitácora**: lista de eventos en orden cronológico inverso,
  muy granular — cada acción del staff queda registrada como una línea con
  hora relativa: "Fulfillment was released", "You released a manual hold
  on 20 items", "You marked 20 items as on hold", "You canceled
  fulfillment via Manual for 20 items", entradas de email transaccional
  enviado (con botón "View email"), comentarios internos del staff (con
  menú "…" → "Delete comment", que abre un modal de confirmación
  destructivo estándar: título + texto de advertencia, footer
  Cancel/Delete en rojo).

### Flujo "Mark as on hold"

Al elegir la opción desde el split-button: modal con checklist de cada
línea (cantidad editable en formato "X of Y", para retener solo parte de
los ítems), un dropdown "Hold reason" (motivo obligatorio, de lista
cerrada), y footer Cancel / "Mark as on hold" (primario). Este mismo
patrón de "selecciona ítems + cantidad parcial + motivo de lista cerrada"
se repite, con variaciones, en refund y en remove/edit.

### Flujo de reembolso (página dedicada, no modal)

`#1003 > Refund` es una **página completa**, no un modal — separa esta
acción de las demás por su complejidad:

- Por cada línea: cantidad a reembolsar en formato editable "X / Y".
- Checkbox "Restock items" (si se marca, la devolución repone inventario;
  si no, el ítem se da por perdido/no vendible).
- Campo de texto "Reason for refund" (visible solo a staff, igual que
  "Reason for edit" en la edición de orden).
- Panel derecho "Summary": Items subtotal, Refund total (calculado según
  las cantidades marcadas), dropdown "Refund method" (por defecto,
  "Original payment"), campo de monto manual con hint "$X available for
  refund" (permite reembolsos parciales en dinero, no solo por ítem),
  checkbox "Send notification" (email al cliente), y botón primario
  "Refund $X.XX" con el monto ya calculado en el label del botón.

### Flujo de edición de orden ("Edit order")

También página/vista dedicada (no un modal simple), con overlay modal
propio para agregar ítems custom:

- Botones "+ Add product" (buscar y agregar del catálogo) y "+ Add custom
  item" (ítem libre: nombre, precio, cantidad, checkboxes "Item is
  taxable" / "Item is a physical product" — para cosas como tarjetas de
  regalo o cargos manuales que no son un producto real del catálogo).
- Cada línea agregada muestra un badge "Added" hasta que se confirma.
- Panel derecho "Summary" recalculando en vivo: Updated total, Net
  payment, Amount to collect (o a devolver, si el cambio reduce el
  total), checkbox "Send invoice to customer".
- Campo "Reason for edit" (solo staff) antes de poder confirmar.
- El botón de confirmación ("Update order") permanece deshabilitado
  ("No changes have been made") hasta que hay al menos un cambio real.

### Cómo mapea al modelo de `pedido` ya construido en Goods

Estados actuales de `Pedido` en el backend (`pedido.service.ts`,
`TRANSICIONES_VALIDAS`): `pendiente → confirmado | cancelado`,
`confirmado → enviado | cancelado`, `enviado → entregado | cancelado`,
`entregado → devuelto`, `cancelado`/`devuelto` sin salida. Es un modelo
más simple que el de Shopify (que separa estado de **pago**, de
**cumplimiento/envío** y de la orden en sí, con grupos parciales), pero el
lenguaje visual sí es directamente aplicable:

- El patrón de **dos badges independientes** (pago vs. cumplimiento) es
  útil incluso sin cambiar el modelo de datos: podemos derivar un badge de
  "estado de pago" a partir de la entidad `Pago` asociada, y mostrarlo
  junto al badge de `pedido.estado`, sin necesitar una migración.
- El listado de acciones vía **split-button contextual según el estado
  actual** (solo mostrar transiciones válidas) mapea 1:1 con
  `TRANSICIONES_VALIDAS` — el frontend puede pedir al backend qué
  transiciones son válidas para el pedido actual, o replicar el mismo
  mapa en el cliente.
- El **timeline granular** es un patrón nuevo para Goods — hoy no
  registramos un log de eventos por pedido (solo el `estado` actual más
  fechas de auditoría genéricas, si existen). Para replicar esto haría
  falta una tabla de eventos/histórico (`pedido_evento` o similar) que
  registre cada cambio de estado con quién y cuándo.
- El **flujo de reembolso como página dedicada** con reposición opcional
  de inventario mapea bien a lo que ya existe: `InventarioService` para
  ajustar `cantidadDisponible`, y `PagoService.cambiarEstado` (o un nuevo
  método `reembolsar`) para el lado del pago. El campo de "monto manual"
  además del reembolso por ítem es una idea a considerar para pagos
  parciales.
- El **flujo de edición de orden** (agregar/quitar ítems después de
  creada) no existe hoy en el backend — actualmente un pedido se crea
  completo o se cancela; no hay edición de líneas post-creación. Es una
  funcionalidad nueva a evaluar si el negocio la necesita (Shopify la usa
  mucho para "agregar algo que el cliente pidió por teléfono/chat").

### Implicaciones técnicas (para cuando se construya)

- Backend: para el timeline se necesita una tabla de eventos por pedido
  (append-only), no derivarlo solo del estado actual.
- Backend: para reembolsos parciales con reposición de inventario, la
  lógica debe reutilizar la misma transacción + locking pessimistic ya
  construida para reservas de stock (evitar condiciones de carrera al
  reponer).
- Frontend: el componente de línea de pedido (producto + cantidad +
  precio) se reutiliza en al menos tres contextos (detalle, hold parcial,
  refund, edit) — conviene construirlo como un componente Angular
  configurable (modo solo-lectura / modo cantidad-editable) desde el
  principio, no duplicarlo.
- Frontend: los formularios de "motivo" (hold reason, refund reason,
  reason for edit) son casi idénticos — un mismo componente de
  "motivo + visibilidad solo-staff" sirve para los tres.

## Productos / Inventario

Fuente: capturas 304, 336, 348 (misma ficha de producto, "Premium Red
Pepper Spice", en distintos estados: activo/archivado), 397 (Purchase
orders → Create supplier), 409 (Gift cards → Create gift card).

### Ficha de producto (patrón de detalle más elaborado del admin)

- **Columna izquierda**: Title, Description (editor de texto enriquecido:
  negrita/cursiva/subrayado/color/alineación, botón para ver el HTML
  crudo), Media (grid de imágenes + botón "+" para agregar), Category
  (selector jerárquico de taxonomía — ej. "Herbs & Spices" dentro de
  "Seasonings & Spices" — que además desbloquea "N metafields" propios de
  esa categoría, con nota explicando que la categoría también determina
  impuestos y mejora búsqueda/filtros), Price (precio, y un acordeón
  colapsable con Compare-at, Unit price, Charge tax, Cost per item),
  Inventory (tabla por ubicación: Unavailable / Committed / Available /
  On hand, link "View all locations", **popover de ajuste rápido en
  línea**: dropdown "Set to / Add / Subtract" + cantidad + dropdown de
  motivo de lista cerrada, ej. "Damaged" + botón de confirmar; además
  SKU, Barcode, toggle "Sell when out of stock"), Shipping (toggle
  "Physical product", preset de paquete con dimensiones, peso), Variants
  ("Add options like size or color"), y metafields propios de la
  categoría (ej. "Food product form: Ground").
- **Columna derecha**: **Status** como su propia tarjeta con dropdown
  (Active/Draft/Archived — cuando está archivado, en su lugar aparece un
  aviso "Archived — Hidden from your Shopify admin, except your product
  list" con botón "Unarchive product"), Publishing (canales de venta),
  Sales ("No recent sales of this product" / link a detalle), Product
  organization (Type, Vendor, Collections, Tags), Theme template.

### Asistente de IA contextual por registro

Distinto del ícono de IA global de la barra superior: en la ficha de
producto aparece un panel lateral "Setup guide" que **da sugerencias
específicas para ese producto exacto** ("has estado puliendo el listado
de Premium Red Pepper Spice... ¿quieres que genere una foto de producto
o escriba una descripción más fuerte?"), con iconos de pulgar
arriba/abajo para feedback y un campo de chat para seguir pidiendo cosas
("¿alguna recomendación para mejorar el catálogo de productos?"). Es el
mismo asistente ("Sidekick") pero aplicado con contexto del registro
actual, no solo como chat genérico.

### Compras a proveedores y tarjetas de regalo (submenús de Products)

- **Purchase orders → Create supplier**: formulario de alta de proveedor
  (Company, Country/region, Address, Apartment/suite, City/State/ZIP,
  Contact name, Phone, Email, Website, Notes) — entidad separada de
  producto, para gestión de reabastecimiento.
- **Gift cards → Create gift card**: código, valor inicial, fecha de
  expiración, cliente asociado (opcional), notas — un tipo de producto
  especial con su propio flujo de creación.

### Cómo mapea al modelo de `producto`/`inventario` ya construido en Goods

El backend de Goods ya tiene una separación muy parecida a la de
Shopify entre el producto (catálogo) y su inventario (stock):

- `Inventario` (`cantidadDisponible`, `cantidadReservada`, `stockMinimo`)
  mapea directo a la tabla "Locations: Unavailable / Committed /
  Available / On hand" de Shopify — en Goods aún no manejamos múltiples
  ubicaciones/bodegas, solo un total por producto, así que el equivalente
  visual sería una sola fila en vez de una tabla (a menos que se agregue
  soporte multi-bodega más adelante).
- `MovimientoInventario` (`tipo`: `entrada` | `salida` | `ajuste`, más
  `motivo` de texto libre y `delta` con signo) mapea **casi 1:1** al
  popover de ajuste rápido de Shopify (Set to/Add/Subtract + motivo) — ya
  tenemos el modelo de datos necesario, solo falta el componente de UI.
  A diferencia de Shopify (motivo de lista cerrada tipo "Damaged"),
  Goods usa texto libre en `motivo`; se podría mantener así o
  estandarizar a una lista cerrada más adelante.
- `Producto` ya tiene campos de envío (`pesoGramos`, `altoCm`, `anchoCm`,
  `largoCm`) equivalentes a la sección "Shipping" de Shopify, y un
  `estado` (activo/inactivo, a diferencia del Active/Draft/Archived de
  tres estados de Shopify).
- Goods hoy no tiene variantes de producto (talla/color) ni categorías
  jerárquicas con metafields dinámicos — son features de Shopify bastante
  más avanzadas que el alcance actual; no parece prioritario replicarlas
  a menos que el catálogo real de Goods las necesite.
- No existe todavía un módulo de "proveedores"/compras en Goods más allá
  de `compra` (que ya vimos en pagination) — si se decide construir algo
  como "Purchase orders → Create supplier" habría que evaluar si
  `compra` ya cubre esa necesidad o si hace falta una entidad `proveedor`
  nueva.

### Implicaciones técnicas (para cuando se construya)

- Frontend: el popover de ajuste de inventario (Set to/Add/Subtract +
  motivo) es una pieza de UI pequeña y muy reutilizable — conviene
  construirla una vez y usarla tanto en la ficha de producto como en un
  futuro listado de inventario.
- Frontend: el patrón "Status como su propia tarjeta con estados
  especiales" (banner + acción cuando está archivado) es más limpio que
  un simple badge — vale la pena replicarlo para `producto.estado`.
- Backend: si se quiere el asistente de IA contextual por producto más
  adelante, es una función completamente aparte de todo lo ya
  construido (requiere LLM + contexto del registro) — no es parte del
  alcance actual, solo se documenta como inspiración de UX.

## Clientes / Usuarios

Fuente: capturas 446 (listado + import CSV), 445 (alta de cliente +
"Add default address"), 468/479 (detalle del cliente "Sam Lee" en dos
momentos), 459 (Edit tax details), 465 (Add to new company).

### Listado

Tabla simple: Customer name, Email subscription (badge "Subscribed"),
Location, Orders, Amount spent. Barra superior con buscador, botones
Export/Import/"Add customer", y resumen "N customers — X% of your
customer base" (referencia útil si más adelante se segmenta por país,
canal, etc.). "Import customers by CSV" es un modal simple: drop de
archivo + link "Download a sample CSV".

### Alta de cliente

Formulario "Customer overview": First/Last name, Language (para el
idioma de las notificaciones — dato que Goods no tiene hoy),
Email + checkbox de consentimiento de marketing, Phone + checkbox
propio de consentimiento SMS, Notes (privadas, nunca visibles al
cliente), Tags. La dirección por defecto se agrega aparte, en un modal
"Add default address" (Country, First/Last name, Company —para
clientes B2B—, Address con autocompletado, Apartment/suite, City/State/
ZIP, Phone).

### Detalle del cliente

- **Franja de KPIs** arriba (mismo patrón del dashboard, aplicado aquí
  con métricas propias del cliente): Amount spent, Orders, Customer
  since, **RFM group** (ej. "Dormant" — segmentación automática
  Recency/Frequency/Monetary que Shopify calcula solo).
- Card "Last order placed" con preview de la orden más reciente y
  botones "View all orders" / "Create order".
- Timeline de actividad — mismo patrón granular que vimos en Pedidos:
  cada acción queda registrada (envío de email de notificación, crédito
  emitido, solicitudes de datos/borrado, comentarios internos).
- Columna derecha: Contact information (email, teléfono, idioma de
  notificaciones), Default address, Marketing (badges Email/SMS/
  WhatsApp — canales de consentimiento independientes entre sí), Tax
  details (editable vía modal "Edit tax details" → "Collect tax" / "Don't
  collect tax", para clientes exentos de impuestos), **Store credit**
  (saldo + modal "Adjust store credit": monto, moneda, expiración
  opcional, checkbox de notificación por email), Tags, Notes.
- **Privacidad/GDPR**: banner "Erasure request submitted" cuando se
  programó el borrado de datos personales de un cliente (con fecha y
  botón "Cancel request") — Shopify separa "customer data request" (el
  cliente pide sus datos) de "customer erasure request" (pide que se
  borren), ambos quedan registrados en el timeline.
- **B2B**: modal "Add to new company" agrupa clientes bajo una empresa
  (razón social, contacto principal, checkbox para mover las órdenes
  existentes del cliente a la empresa, dirección de envío) — cubre
  ventas al por mayor, fuera del alcance actual de Goods pero vale la
  pena tenerlo mapeado si en el futuro se vende B2B.

### Cómo mapea al modelo de `usuario` ya construido en Goods

La entidad `Usuario` de Goods ya es bastante completa y cubre gran
parte de lo que Shopify separa en "Customer": `nombres`/`apellidos`,
`correo`/`telefono` (con sus flags `correoVerificado`/
`telefonoVerificado`), `direccionPrincipal`/`referenciaDireccion`/
`latitud`/`longitud` (dirección por defecto), `activo`/
`motivoDesactivacion` (equivalente simplificado al archivado),
`aceptaMarketing` (un solo flag, Shopify separa Email/SMS/WhatsApp),
`puntosFidelidad` y `codigoReferido`/`referidoPorId` (fidelización y
referidos — features que Shopify ni siquiera muestra en estas capturas,
Goods ya va adelantado ahí), `preferenciasNotificaciones` (jsonb libre,
cubriría el idioma de notificaciones que Shopify sí expone en el UI).

Lo que **no existe hoy** en Goods y aparece en Shopify:
- **Store credit / saldo a favor**: no hay tabla de crédito de tienda ni
  movimientos asociados — si se quiere replicar, es una entidad nueva
  (`credito_tienda` + histórico de movimientos, análogo a
  `MovimientoInventario`).
- **RFM / segmentación automática**: no hay lógica de segmentación de
  clientes — sería un cálculo periódico (recency/frequency/monetary)
  sobre `pedido`, no un campo almacenado.
- **Solicitudes de datos/borrado (GDPR/Habeas Data)**: no hay flujo de
  "derecho al olvido" — relevante si Goods opera en Colombia (Ley
  1581/2012, Habeas Data) o vende a la UE; sería una tabla de
  solicitudes con estado y fecha programada de borrado, más un job que
  ejecute el borrado real.
- **Impuestos por cliente** (exento de impuestos): no existe — hoy los
  impuestos, si los hay, se calculan igual para todos.
- **Agrupación B2B por empresa**: no existe — coherente con que Goods
  hoy es B2C.

### Implicaciones técnicas (para cuando se construya)

- Frontend: el componente de franja de KPIs (ya identificado en
  Dashboard y Pedidos) se reutiliza una tercera vez aquí con métricas de
  cliente — refuerza que vale la pena construirlo una sola vez, genérico.
- Backend: si se prioriza algo de esta lista, RFM y store credit son los
  de mayor impacto comercial (marketing dirigido, retención); GDPR/
  Habeas Data es el de mayor urgencia legal si aplica al mercado de
  Goods — vale la pena resolverlo con el cliente/negocio antes de
  construir nada de esto.

## Topbar

Fuente: captura 106. Se construye por partes (izquierda → centro →
derecha), calcando la esquina superior izquierda/derecha y el buscador
central de Shopify.

### Izquierda: logo + badge de versión (hecho)

- Shopify usa ícono (bolsa de compras) + wordmark "shopify" en negrita
  itálica, y junto a eso un badge tipo píldora con el texto "Spring '26"
  (la versión de su plataforma): fondo casi idéntico al de la barra
  (transparente en la práctica), borde sutil gris claro, texto itálico
  gris muy claro (casi blanco).
- Goods todavía no tiene un archivo de logo — por ahora es un wordmark de
  texto ("Goods", `font-bold italic`), reemplazable después por un ícono
  real sin tocar el resto del layout.
- El badge se reutiliza para la versión del admin en vez de la versión de
  la plataforma: por ahora texto fijo `v0.1`, sin lectura automática de
  `package.json` (hoy está en `0.0.0`, no tiene sentido mostrarlo hasta
  que se decida versionar el proyecto de verdad).
- Tokens nuevos (pipeta sobre la captura 106): `--color-topbar-badge-border`
  (`#2a2a2a`), `--color-topbar-badge-text` (`#f0f0f0`).

### Centro: buscador global (hecho)

- Barra de búsqueda ancha, fondo `#282828` (levemente más claro que
  `--color-topbar`, token `--color-topbar-search-bg`), esquinas
  redondeadas (`rounded-lg`, no píldora completa — distinto del badge de
  versión), ícono de lupa + placeholder "Search", y al final de la barra
  un hint de atajo de teclado (`⌘` `K`) en dos badges pequeños
  (`--color-topbar-kbd-bg`, `#2f2f2f`, apenas más claro que el fondo de
  la barra — diferencia de ~7 puntos de gris verificada con pipeta).
- Es un `<input>` real (enfocable, con anillo de foco), pero sin lógica
  de búsqueda ni el atajo de teclado ⌘K conectados todavía — eso
  requiere definir qué busca (¿pedidos? ¿productos? ¿clientes? ¿todo a
  la vez, como Shopify?) y es trabajo aparte.

### Tipografía e íconos (decisión de gerencia)

Gerencia pidió definir de una vez fuente e íconos para todo el admin, no
solo para el topbar — estas decisiones aplican a todo `shared/ui` hacia
adelante:

- **Tipografía: Inter, self-hosted** vía `@fontsource/inter`. Las letras
  de las capturas de Shopify se ven como un grotesco geométrico — no se
  pudo confirmar con certeza que sea exactamente Inter (no hay forma de
  extraer metadata de fuente de un PNG), pero es la opción más parecida
  y es un estándar de facto para este estilo de UI. Se eligió
  self-hosted (paquete npm, sin request a Google Fonts en cada carga)
  para no depender de un servicio externo. Solo se importan los pesos
  que el admin ya usa (`400`, `500`, `600`, `700`, más `400-italic` y
  `700-italic` para el wordmark del logo y el badge de versión) — no los
  9 pesos completos que ofrece Inter, para no cargar peso de más.
  Token: `--font-sans` en el `@theme`, con fallback a la fuente nativa
  del sistema si algo falla al cargar.
- **Íconos: `@tabler/icons-angular`** (reemplaza a `@lucide/angular`,
  usado primero — ver "Sidebar > Íconos" para el porqué del cambio).
  Línea limpia y minimalista, cercana al lenguaje visual de
  Shopify/Polaris, sin ser el set exacto de Shopify
  (`@shopify/polaris-icons`, que se descartó por no tener integración
  oficial para Angular — requeriría traer los SVG sueltos a mano). Es
  el paquete **oficial** de Tabler (`@tabler/icons-angular`, no un
  wrapper de comunidad) y trae outline **y relleno** de cada ícono
  desde la misma familia visual — a diferencia de Lucide, que es
  puramente de trazo y no tiene versión rellena.
- Dos formas de usar el componente `<tabler-icon>`, según el caso:
  por referencia de objeto (`[icon]="iconSearch"`, con
  `iconSearch = IconSearch` importado en el componente — así lo usa el
  topbar) cuando los íconos de un componente son fijos, o por nombre
  registrado con `provideTablerIcons(...)` (`[icon]="item.icon"` con
  un string como `"home-filled"`) cuando el ícono depende de un dato
  que cambia por ítem (así lo usa el sidebar — ver "Sidebar >
  Implementación técnica"). `provideTablerIcons` devuelve
  `EnvironmentProviders`, que solo puede registrarse a nivel de app
  (`app.config.ts`) o de ruta, nunca en el `providers` de un
  componente.
- Implicación técnica: `npm install` hay que correrlo de nuevo en cada
  máquina de desarrollo después de este cambio (se agregó
  `@tabler/icons-angular` a `package.json`, se quitó `@lucide/angular`;
  `@fontsource/inter` sigue igual).

### Derecha: íconos (hecho)

- De izquierda a derecha: ícono del asistente IA, campana de
  notificaciones, y avatar + nombre de usuario.
- En Shopify el ícono de asistente es "Sidekick", un ícono propio de
  carita/máscara — no existe en Tabler (ni existía en Lucide). Se usó
  `IconRobot` como el equivalente semántico más cercano dentro del set
  ya elegido; en Goods representaría el mismo patrón de asistente
  contextual ya visto en la ficha de producto (ver "Asistente de IA
  contextual por registro"). Si más adelante hace falta más fidelidad
  visual con Sidekick, es la única pieza del topbar que valdría la pena
  traer como SVG propio en vez de un ícono de la librería.
- La campana de notificaciones sí tiene equivalente exacto (`IconBell`).
- Avatar: cuadrado redondeado con iniciales — en Shopify el color es
  aleatorio por cuenta (no es un token de marca real), pero por
  indicación de gerencia se pipeteó el color exacto de la captura 106
  para que la referencia y el admin se vean iguales: fondo
  `--color-topbar-avatar-bg` (`#2be0d5`, turquesa/cian brillante — se ve
  "azulado" a simple vista), texto `--color-topbar-avatar-text`
  (`#004442`, teal oscuro, también pipeteado) en vez de blanco para
  mantener contraste sobre un fondo tan claro.
- Sin lógica real detrás de ninguno de los tres todavía: no hay panel de
  asistente, no hay lista de notificaciones, y el nombre/iniciales
  ("Admin" / "AD") son un placeholder fijo porque `core/auth` todavía no
  existe (ver estructura de carpetas — hoy es solo un `.gitkeep`). Wirear
  esto a un usuario real es trabajo aparte, depende de que exista login.

### Esquinas redondeadas del contenido (bajo el topbar)

- Detalle que se había pasado por alto: el borde inferior del topbar
  **no es una línea recta** — el sidebar y el canvas, justo debajo,
  tienen la esquina superior (izquierda y derecha respectivamente)
  redondeada, "mordiendo" el negro del topbar en las dos esquinas
  exteriores. La costura interna entre sidebar y canvas sí es recta, sin
  redondeo — el efecto solo se ve en las dos esquinas exteriores de la
  pantalla.
- Radio medido con precisión sobre la captura 106 (no a ojo): se buscó
  en qué fila deja de haber negro lejos de la esquina (y=112 en la
  captura) y en qué fila empieza el gris justo en el borde (x=0, y=130)
  — la diferencia (18px de captura ÷ el factor de escala 1.512 de la
  captura ≈ 12px CSS) coincide casi exacto con `rounded-xl` (12px) de
  Tailwind — se usó ese valor en vez de un `rounded-2xl` a ojo.
  Implementación: el contenedor que envuelve sidebar+canvas tiene fondo
  negro (`bg-topbar`) de base, y sidebar/canvas cada uno con su propia
  esquina superior redondeada (`rounded-tl-xl` / `rounded-tr-xl`) —
  así el negro de fondo se asoma exactamente en las dos esquinas, sin
  necesidad de ningún margen/gap explícito.

## Sidebar

Fuente: captura 106 (sidebar completo, de arriba a abajo). La versión
anterior era texto plano sin íconos, sin estado activo real, sin
Settings — esta sección documenta el rediseño.

### Catálogo completo de la captura (para referencia futura)

De arriba a abajo, la captura 106 tiene: Home, **Orders** (activo, pill
+ badge de conteo "3") con submenú Drafts/Shipping labels/Abandoned
checkouts, Products, Customers, Growth, Discounts, Content, Markets,
Finance, Analytics — sección "Sales channels ›" (Online Store, Agentic,
Point of Sale) — sección "Apps ›" — Messaging (con punto de no-leído) —
sección "Sidekick conversations ›" (historial de chats con el
asistente) — Settings fijo abajo.

### Decisión de alcance (gerencia)

Se replicó el **estilo** exacto (ícono + texto, pill de item activo,
Settings fijo abajo) pero **no el contenido completo** — Goods no tiene
Growth/Discounts/Content/Markets/Finance/Analytics/Online
Store/Agentic/Point of Sale/Apps/Messaging/Sidekick conversations, y
agregar esos ítems como enlaces muertos iba en contra del criterio ya
usado en todo este documento (alcance real de Goods, lenguaje visual de
Shopify). El sidebar de Goods hoy es: **Dashboard, Orders, Products,
Customers, Settings** — los mismos 4 módulos ya documentados en el
resto de este archivo, más Settings.

- Tampoco se replicaron los submenús (Drafts/Shipping labels/Abandoned
  checkouts bajo Orders; Collections/Inventory bajo Products) porque no
  existen como rutas reales en `orders.routes.ts` / `products.routes.ts`
  — Shipping labels/Abandoned checkouts ni siquiera tienen equivalente
  claro en el modelo `pedido` de Goods. Si en algún momento se agrega
  una ruta real (ej. inventario como página propia en vez de sección de
  la ficha de producto), ahí sí tendría sentido agregar el submenú.
- Tampoco se replicó el badge de conteo ("Orders 3") — mostrar un número
  falso hubiera sido peor que no mostrar nada; se agrega el día que haya
  un servicio real de pedidos conectado (`OrdersApiService`, pendiente).
- **Settings** sí se agregó como ítem + ruta (`features/settings`,
  placeholder igual que el resto de páginas) aunque todavía no se
  definió qué configuración necesita Goods — existe porque su posición
  fija abajo es parte del patrón de layout de Shopify, no porque el
  contenido ya esté decidido.

### Íconos

**Relleno vs. línea (revisado contra la captura 106, zoom a la columna
de íconos):** Shopify no usa el mismo estilo para todos los ítems del
sidebar — Home, Products y Customers usan íconos **sólidos/rellenos**,
mientras que Orders, Settings y el resto de secciones fuera de alcance
(Growth, Discounts, Content, Markets) usan **de línea/outline**.

Primer intento: `@lucide/angular` (misma decisión que el topbar en su
momento) para todo. Al llegar a este detalle se descubrió que Lucide es
una librería puramente de trazo (stroke) — no tiene variante rellena de
sus íconos, y sus paths no son regiones cerradas rellenables (probarlo
con `fill` en vez de `stroke` da un resultado roto). Como parche
temporal se instaló el paquete oficial `heroicons` solo para copiar a
mano el `path` verificado de sus íconos sólidos de Home/Tag/User, sin
quedar como dependencia. Funcionaba, pero dejaba dos familias de
íconos mezcladas en el proyecto (Lucide de trazo + heroicons rellenos
copiados a mano) — al preguntarle a gerencia si convenía mantener el
híbrido o resolverlo de raíz, se decidió **migrar todo el proyecto de
`@lucide/angular` a `@tabler/icons-angular`** (paquete oficial de
Tabler, no un wrapper de comunidad): mismo lenguaje visual que Lucide
(trazo 2px, esquinas redondeadas, muy cercano a Feather/Lucide en
espíritu), pero con **outline y relleno de cada ícono en la misma
librería** — sin mezclar dos sets ni copiar paths a mano. `heroicons`
ya no es necesario y se desinstaló.

Mapeo final (todos de `@tabler/icons-angular`):

- **Dashboard** → `IconHome2Filled`, **Products** → `IconTagFilled`,
  **Customers** → `IconUserFilled` (rellenos).
- **Orders** → `IconInbox`, **Settings** → `IconSettings2` (de línea).
- Topbar (sin cambios de estilo, solo de librería): `IconSearch`,
  `IconRobot` (antes `LucideBot`), `IconBell` — los tres de línea.

**Ajuste "más curvo" (pedido de gerencia, después de explorar Streamline
Flex Remix — ver más abajo por qué se descartó):** Tabler es una
librería de un solo estilo geométrico consistente — no tiene una
familia alternativa "curva" completa como Streamline. Sí tiene, para
algunos conceptos, un segundo ícono con silueta más suave sin cambiar
el significado:

- **Settings**: `IconSettings` (engranaje clásico de 8 dientes,
  anguloso) → **`IconSettings2`** (insignia hexagonal de esquinas
  suaves) — el cambio más notorio de los dos.
- **Dashboard**: `IconHomeFilled` (ventana rectangular recta) →
  **`IconHome2Filled`** (ventana con esquinas redondeadas) — cambio
  sutil.

Se revisaron alternativas para Products, Customers, Orders, Search,
Bell y el asistente (Robot) y ninguna es notablemente más curva sin
cambiar el ícono a otro concepto — se dejaron como estaban.

**Por qué no se usó Streamline (Flex "Remix" / "Plump"):** gerencia
vio en la propia página de Tabler una promoción de Streamline
(250,000+ íconos) y le gustó el estilo curvo/fluido de su set "Flex",
variante "Remix" (también existe "Plump", más bulboso — familia
aparte). Investigado: son gratis pero bajo licencia **CC BY 4.0**, que
exige atribución visible a Streamline en el producto (a diferencia de
Tabler/Lucide, que son MIT y no la exigen). Existe soporte técnico real
para usarlo (`iconify-icon`, MIT, + `@iconify-json/streamline-flex` o
`@iconify-json/streamline-plump`, datos offline sin depender de un CDN
en producción) — no era una limitación técnica. La decisión fue de
licenciamiento: gerencia prefirió no mostrar atribución de terceros en
el admin, y la única forma de usar Streamline sin atribución es pagar
su suscripción (desde $19-29/mes) — se descartó por el costo recurrente
frente a un ajuste puramente estético, y se optó por quedarse en
Tabler (MIT, sin atribución, sin costo) con los dos swaps de arriba.

### Implementación técnica

El item activo se resuelve con `routerLinkActive` (ya existía). A
diferencia de Lucide (cada ícono era su propio componente standalone,
sin forma de pasarlo como dato — obligaba a un `@switch` sobre
`icon: 'house' | 'inbox' | 'tag' | 'user'`), `@tabler/icons-angular`
expone un único componente genérico `<tabler-icon>` que acepta el
nombre del ícono **por string** (`icon="home-2-filled"`) cuando ese
nombre se registra antes con `provideTablerIcons({ IconHome2Filled, ... })`.
Eso permitió simplificar el sidebar: `NavItem.icon` ahora es
simplemente el string del ícono de Tabler (`'home-2-filled'`, `'inbox'`,
`'tag-filled'`, `'user-filled'`, y `'settings-2'` para el link fijo de
Settings), usado directo como `<tabler-icon [icon]="item.icon" />`
dentro del `@for` — ya no hace falta el `@switch`. Los íconos se
registran con `provideTablerIcons` en `app.config.ts` (no en el propio
componente: esa función devuelve `EnvironmentProviders`, que Angular no
permite en el `providers` de un componente, solo a nivel de app o de
ruta).

### Medidas (corregidas contra la captura, no a ojo)

Primer intento (ancho `w-56`/224px, `gap-1` entre items, `py-2.5`) se
veía más angosto y con más aire entre items que la referencia. Se
volvió a medir con precisión sobre la captura 106:

- **Ancho del sidebar**: se buscó en qué columna termina el gris del
  sidebar (`#ebebeb`) y empieza el del canvas (`#f1f1f1`) — el borde
  cae en x≈478px de la captura. Dividido por el factor de escala de la
  captura (1.512) da ≈316px CSS → se usó `w-80` (320px) de Tailwind en
  vez de `w-56` (224px).
- **Separación entre items**: se aprovechó que el pill activo de
  "Orders" tiene un color distinguible (`#fafafa` vs `#ebebeb` del
  sidebar) para medir su alto exacto con precisión de píxel: 56px de
  captura, de borde a borde, **sin ningún hueco** antes de que empiece
  la fila siguiente — el pill ocupa toda la fila, no hay `gap` entre
  items. 56px ÷ 1.512 ≈ 37px CSS por fila. Se quitó el `gap-1` entre
  items y se bajó el padding vertical de cada item de `py-2.5` a `py-2`
  (con el ícono de 20px, `py-2` dos veces + ícono ≈ 36px, calza con la
  medición).

### Ajuste post-medición: micro-gap entre items (`gap-0.5`)

El cero-gap de arriba se verificó contra una captura **estática** de
Shopify, que nunca muestra dos pills superpuestas (activo + hover al
mismo tiempo) — solo una activa a la vez. En uso real sí pasa: al pasar
el mouse de un módulo activo al siguiente, las dos pills (la de
`routerLinkActive` y la de `:hover`) quedan exactamente pegadas, y como
ambas tienen las 4 esquinas redondeadas, la unión sin espacio se ve
como un "pellizco" — un recorte raro justo donde se tocan, en vez de
dos pills separadas. Se agregó `gap-0.5` (2px) al contenedor `<nav>`
para separar visualmente las pills sin perder la sensación "apretada"
de la referencia — 2px es imperceptible comparado con la fila de 37px,
pero alcanza para que las esquinas redondeadas no se toquen. Es una
excepción deliberada a la medición de arriba, documentada acá porque
contradice el "sin gap" — se prioriza que la interacción se vea bien
sobre el calco exacto de un estado que la captura de referencia nunca
mostró.

De paso se alargó la transición de color al pasar el mouse
(`transition-colors` → `duration-200 ease-out`, antes sin duración
explícita — usaba el default de Tailwind de 150ms) para que el cambio
de fondo entre módulos se sienta más suave, a pedido de gerencia.

### Indicador deslizante (reemplaza el fondo por item)

El ajuste de arriba (micro-gap + transición de color más lenta) no
resolvía el pedido real de gerencia: quería que la selección se sienta
como que **se desplaza** de un módulo a otro, no que cada item
prenda/apague su propio color (que sigue siendo un aparecer/desaparecer,
por más lento que sea). La causa de fondo: cada `<a>` tenía su propio
fondo independiente (`routerLinkActive="bg-nav-active"` +
`hover:bg-nav-active`), así que nunca había *una* forma moviéndose,
había dos formas alternándose.

Se reemplazó por un **indicador único**: una sola `<div>` absolutamente
posicionada (el `<nav>` pasó a `relative`) que se desliza entre items
animando `top`/`height` con `transition-all duration-200 ease-out`, en
vez de que cada item controle su propio fondo:

- Cada `<a>` del `@for` tiene una referencia de plantilla `#link`
  (`ElementRef`), leída desde el componente con `viewChildren<ElementRef>('link')`
  (API de queries por signal de Angular 21).
- `hoveredIndex` (signal) guarda qué item está bajo el mouse — se
  actualiza con `(mouseenter)` por item y se limpia con `(mouseleave)`
  en el propio `<nav>`.
- `activeIndex` (signal) guarda el item de la ruta activa — se
  actualiza desde `(isActiveChange)` de cada `routerLinkActive` (no se
  reimplementa el matching de ruta a mano, se deja que el propio
  directive decida y solo se escucha su evento).
- Un `computed` elige el elemento objetivo (`hoveredIndex` si hay
  hover, si no `activeIndex`), y de ahí salen `indicatorTop` /
  `indicatorHeight` (`offsetTop` / `offsetHeight` del elemento) y
  `indicatorVisible`, todos leídos directo del DOM real — no hay
  alturas ni posiciones hardcodeadas, así que si el padding cambia en
  el futuro el indicador se sigue ajustando solo.
- Cada `<a>` dejó de tener su propio `bg-nav-active`/`hover:bg-nav-active`
  — ahora solo cambia el color de texto/ícono
  (`[class.text-gray-900]="rla.isActive"`, vía `#rla="routerLinkActive"`
  sin lista de clases propia) y queda por encima del indicador
  (`relative z-10`, indicador en `z-0` y `pointer-events-none`).
- **Settings queda afuera de este sistema** — está separado del grupo
  (empujado al fondo con `mt-auto`, sin vecino inmediato debajo), así
  que no había problema de "pellizco" ni necesidad real de que el
  indicador viaje hasta ahí; se dejó con el fondo propio + fade simple
  de antes.

Con esto, el "pellizco" del micro-gap (arriba) ya no puede pasar —
nunca hay dos pills visibles al mismo tiempo, solo una que se mueve —
pero se dejó el `gap-0.5` igual, no molesta en nada.

## Pendiente de revisar

(Todos los módulos priorizados ya fueron revisados: Dashboard/Analítica,
Pedidos/Órdenes, Productos/Inventario, Clientes/Usuarios. El Topbar ya
está completo en sus tres partes — izquierda, centro y derecha — todas
sin lógica real conectada todavía, solo estructura y estilo calcados de
Shopify.)

## Decisión: stack de UI para el admin

**Gerencia discutió y aprobó PrimeNG** como librería de componentes del
admin — esto reemplaza la opción "Tailwind puro + Angular CDK" que se
había explorado primero. Al ir a instalarlo apareció un tema serio de
licenciamiento (ver abajo) que cambió la versión final a usar, y luego
se armó y verificó el proyecto real (no solo en teoría). Queda todo el
razonamiento registrado porque explica qué vigilar al construir.

### Aviso de licenciamiento que hizo cambiar la versión

PrimeTek (los creadores de PrimeNG) anunciaron un cambio de
licenciamiento que arranca **justo en la versión 22** (igual para
PrimeReact 11 y PrimeVue 5): todo lo anterior queda MIT para siempre
(no retroactivo), pero de la v22 en adelante hay un modelo nuevo
("PrimeUI licensing") con una Community License gratuita (para equipos
chicos, con registro/confirmación anual) o una Commercial Suite de pago.
**Decisión tomada: quedarse en PrimeNG 21.x (última versión MIT, sin
condiciones)** para no depender de ningún registro ni licencia — la
`v21-stable` (21.1.10) es la que PrimeTek mismo etiquetó como la pareja
estable de esa última versión libre.

### Angular 21 (LTS), no Angular 22

Al revisar el `package.json` publicado de `primeng@21.1.10`, su
`peerDependencies` exige `@angular/core: ^21.0.7` y
`@angular/cdk: ^21.0.0` — no soporta oficialmente Angular 22 (la versión
más reciente, liberada en junio 2026). Para no combinar dos piezas que
ninguno de los dos proyectos probó together, **el workspace quedó en
Angular 21**, que sigue en soporte LTS activo hasta 2027 (no es una
versión vieja, solo no es la última).

### Fidelidad visual sigue siendo el requisito — y así se logra en la práctica

El factor que no cambió es el del cliente: fidelidad casi de calco a
Polaris, no "inspirado en". La razón por la que esto es viable con
PrimeNG (y no lo era con sus versiones viejas, de temas SCSS pesados y
opinionados) es que desde la reescritura de su sistema de theming
(v18+) expone una API de **Pass Through (`pt`)** en cada componente,
que permite inyectar clases (Tailwind incluido) sobre cualquier nodo
interno del DOM que renderiza el componente — el lema del proyecto es
explícito al respecto: *"Your Components, Not Ours"*.

**Corrección importante tras probarlo de verdad:** el tipo de
`providePrimeNG` expone una opción `unstyled: true`, pero en la versión
instalada (21.1.10) está marcada en el propio `.d.ts` como
`@experimental` — *"not yet implemented"*. **No usar esa opción todavía.**
El mecanismo real y funcional para arrancar sin ningún CSS de tema
puesto es pasar **`theme: 'none'`** en `providePrimeNG` (confirmado
compilando el proyecto real, con Tailwind generando clases sobre un
`p-button` sin ningún estilo de PrimeNG de por medio). Es exactamente
el punto de partida que queríamos, solo que con la API que sí funciona.

**Recomendación concreta para no terminar peleando con la estética:**

1. Seguir en `theme: 'none'` (ya configurado así en el proyecto
   entregado) en vez de partir de un preset ya vestido (Aura) — sacarle
   clases a algo ya estilizado es más trabajo que vestir algo en blanco.
2. Configurar **CSS Layers** entre PrimeNG y Tailwind cuando se empiece
   a construir UI real — evita forzar cada clase con `!important`.
3. Auditar primero los componentes de mayor riesgo visual/estructural,
   en este orden: **DataTable** (selección múltiple + bulk actions, el
   patrón que más se repite en las capturas de Shopify), **Popover**
   (para el popover de ajuste de inventario), **DatePicker** (para el
   date-range picker con comparación de períodos del dashboard),
   **Tag** (el mapeo de estado → color).
4. Como ya hay experiencia previa con PrimeNG (Bankú lo usa), vale la
   pena traer de ahí las convenciones que ya funcionaron — configuración
   de `pt`, manejo de CSS Layers, wrappers ya resueltos — en vez de
   redescubrirlas desde cero en este proyecto.
5. `@angular/animations` (que PrimeNG usa para las transiciones de
   overlays) aparece marcado como deprecado por Angular a favor de
   `animate.enter`/`animate.leave` — no hay nada que hacer al respecto
   todavía, es PrimeNG quien tendría que migrar; solo queda pendiente de
   vigilar en futuras actualizaciones.

### El workspace ya está creado y verificado

`m_za_v01/frontend` — workspace Angular 21 con la app `admin` (Tailwind
v4 + PrimeNG 21.1.10, sin librería compartida todavía: se agrega cuando
se empiece `tienda`). Se verificó con un build real (`ng build`, con un
`p-button` de prueba después removido) que Angular + Tailwind + PrimeNG
compilan juntos sin conflictos antes de entregarlo. Falta correr
`npm install --legacy-peer-deps` en la máquina real (necesario por un
bug de npm al resolver peers de vitest, no por PrimeNG) — el `--legacy-
peer-deps` hay que repetirlo en instalaciones futuras de paquetes en
este proyecto, ya que no se dejó un `.npmrc` (bloqueado por el puente
remoto para escribir).

### Qué construir como librería propia (esto no cambia con PrimeNG)

La mayoría de los 7 componentes identificados abajo **no son primitivas
de PrimeNG** — son composites de dominio propio (construidos combinando
primitivas de PrimeNG + Tailwind para layout), así que se construyen
igual sin importar la librería de base:

Ya identificamos varios componentes que se repiten entre módulos — estos
son los primeros candidatos de la librería interna, en orden de
reutilización (de más a menos usada):

1. **Tarjeta de KPI** (número + sparkline + slot expandible) — usada en
   Dashboard, Pedidos y Clientes.
2. **Fila/línea de ítem de pedido** (producto + cantidad + precio, con
   modo solo-lectura / modo cantidad-editable) — usada en detalle,
   hold parcial, refund y edición de orden. **✅ Construido** — ver
   "Estado de la librería interna" más abajo.
3. **Popover de ajuste rápido** (Set to/Add/Subtract + motivo) — usado en
   inventario, y estructuralmente parecido al ajuste de store credit.
   **✅ Construido** — ver "Estado de la librería interna" más abajo.
4. **Campo de "motivo + visibilidad solo-staff"** — hold reason, refund
   reason, reason for edit.
5. **Timeline de eventos** (lista cronológica con iconos/acciones) — usado
   en pedido y cliente.
6. **Tabla con selección múltiple + barra de bulk actions** — patrón
   base de casi todos los listados. **✅ Construido** — ver "Estado de
   la librería interna" más abajo.
7. **Badge de estado** (mapeo de estado → color: verde/ámbar/rojo/gris) —
   transversal a todo el admin. **✅ Construido** — ver más abajo.

### Estado de la librería interna (qué ya existe en `frontend/`)

- **`StatusBadgeComponent`** (`shared/ui/status-badge/`) — envuelve
  `p-tag` vía `pt`, con inputs `label`/`tone` (success/warning/neutral/
  critical, sobre los tokens de color)/`dot` (none/filled/ring, para el
  patrón "punto relleno = estado de pago, anillo = estado de
  cumplimiento" visto en las capturas). Verificado contra las capturas
  106 y 336 con un build real + captura de navegador.
- **`DataTableComponent` + `dataTablePt()` + `SelectionCheckboxComponent`**
  (`shared/ui/data-table/`) — el "shell" de tabla con selección múltiple
  y barra de bulk actions. Verificado contra la captura 61 (listado de
  Orders), incluyendo la fila tachada de una orden reembolsada.

  **Dos hallazgos técnicos importantes de cómo quedó armado**, para no
  repetir el mismo camino la próxima vez que se toque esto:

  1. **`DataTableComponent` NO envuelve `<p-table>`.** La primera versión
     lo hacía (el wrapper tenía `<p-table>` en su propio template, y el
     consumidor pasaba `<ng-template pTemplate="header">`/`body` como
     contenido proyectado). Compilaba sin errores pero **no renderizaba
     nada** — se armó un caso mínimo de prueba y se confirmó que
     `p-table` no detecta esos `pTemplate` cuando llegan a través de un
     `<ng-content>` intermedio (su `@ContentChildren(PrimeTemplate)` no
     atraviesa ese segundo nivel de proyección). La solución: el
     consumidor usa `<p-table>` tal cual, con su API nativa completa
     intacta (sorting, paginación, filtros — nada de eso hay que
     re-exponer a mano), y `DataTableComponent` solo aporta el "shell"
     visual alrededor (tarjeta + barra de selección) proyectando el
     `<p-table>` ya armado como una unidad. El preset de estilo
     (`dataTablePt()`) se pasa aparte, directo al `[pt]` del `p-table`
     del consumidor.
  2. **El checkbox de selección no usa `p-tableCheckbox`/
     `p-tableHeaderCheckbox`.** Son los componentes "esperables" de
     PrimeNG para esto, pero no exponen `pt` ni heredan el
     `pt.pcCheckbox`/`pt.headerCheckbox` configurado en el `p-table`
     padre — se confirmó inspeccionando el DOM real, llegan sin ninguna
     clase propia (con `theme: 'none'` eso significa invisibles). En vez
     de pelear con esa limitación, `SelectionCheckboxComponent` es un
     checkbox propio y simple: un `<input type="checkbox">` real
     (accesible) vuelto transparente y superpuesto a una caja + ícono de
     check dibujados a mano en Tailwind, con soporte de estado
     indeterminado (para "seleccionar todo" cuando hay selección
     parcial). Se conecta a mano al estado de selección del consumidor
     (no depende de `[(selection)]` de `p-table` en absoluto).

  Moraleja general para el resto de los composites que faltan: cuando
  algo de PrimeNG "debería" encajar pero no se deja estilizar por `pt`,
  conviene verificar con un build real + inspección del DOM antes de
  asumir que el problema es de sintaxis — puede ser una limitación real
  del componente en esta versión, y la salida más simple suele ser
  construir esa pieza puntual a mano en vez de insistir.

- **`QuickAdjustPopoverComponent`** (`shared/ui/quick-adjust-popover/`)
  — el popover "Set to / Add / Subtract" + cantidad + motivo + confirmar.
  Calcado pixel a pixel de la captura 304 (ficha de producto > Inventory)
  y verificado con un build real: abrir el popover, cambiar a "Add 25 —
  Restock" y confirmar efectivamente actualiza "Available"/"On hand" en
  la tabla de la izquierda.

  A diferencia de `DataTableComponent`, acá **sí** fue seguro que el
  componente envuelva su overlay de PrimeNG (`<p-popover>`) directo en su
  propio template — la razón es que `p-popover` NO depende del mecanismo
  de `pTemplate`/`ContentChildren(PrimeTemplate)` que falló con
  `p-table`: acepta contenido simple vía `<ng-content>` normal, que sí
  atraviesa un nivel de wrapper sin problema. Por eso `p-table` necesitó
  quedar "desenvuelto" en cada pantalla y `p-popover` no.

  Dicho eso, después de la sorpresa de `p-tableCheckbox`, el contenido
  *interno* del popover (los dos dropdowns y el input de cantidad) se
  hizo con `<select>`/`<input>` nativos + Tailwind en vez de `p-select`
  — son controles simples que no necesitan lo que PrimeNG resuelve bien
  (overlays con posicionamiento), así que no valía la pena arriesgarse a
  otra limitación de `pt` sin haberla probado primero. PrimeNG se usa acá
  solo para lo difícil de reimplementar: el anclaje del popover al botón
  "Adjust", el cierre al hacer click afuera, y el foco.

  El modal "Adjust store credit" (Clientes/Usuarios) resuelve una
  interacción parecida (monto + motivo + confirmar) pero es un **modal**,
  no un popover — no reusa este componente tal cual, aunque si el día de
  mañana se construye un composite de modal equivalente, tiene sentido
  que copie la misma forma de inputs/output (`reasons`, evento
  `confirmed` con `{ mode, quantity/amount, reason }`).

- **`OrderLineItemComponent`** (`shared/ui/order-line-item/`) — la fila
  de producto (imagen + título + variante/SKU + precio × cantidad +
  total) que se repite en detalle de orden, hold, refund y edit order.
  Calcada de las capturas 106/130 (detalle de orden, grupos "Unfulfilled"
  y "Removed") y 133 (Edit order) — verificada con un build real:
  cambiar la cantidad recalcula el total, sacar una línea la quita de la
  lista, y en el modo con checkbox tildar una fila y escribir una
  cantidad mayor al máximo la deja clampeada en el máximo.

  Son dos modos (`mode: 'readonly' | 'editable'`), no tres, como dice el
  ítem de la lista de arriba:
  - `readonly`: precio y cantidad son texto plano, la cantidad va dentro
    de una píldora ("$10.00 × 10") — así se ve en el detalle de la orden.
  - `editable`: el precio se resalta en el color de acento (igual que
    Shopify) y la cantidad es un `<input>` real. Dentro de este modo hay
    dos variantes de *formato*, no dos modos nuevos: sin `maxQuantity` es
    un input simple (pantalla "Edit order", captura 133); con
    `maxQuantity` seteado pasa a formato "X of Y" / "X / Y"
    (`partialSeparator`), que es lo que se necesita para hold y refund
    parcial — ahí la cantidad editable es "cuántos de los Y originales"
    entran en la acción. **No hay captura de esos modales en el
    muestreo** (el flujo está descrito en texto en "Pedidos / Órdenes" >
    "Flujo 'Mark as on hold'" y "Flujo de reembolso" más arriba en este
    documento) — el formato "X of Y" del componente sigue esa
    descripción textual, así que conviene confirmarlo contra una captura
    real de Shopify el día que aparezca una.

  `selectable` (reutiliza `SelectionCheckboxComponent` del composite de
  tabla) agrega el checkbox de la izquierda para cuando primero hay que
  elegir qué líneas participan (hold, refund) antes de tocar la
  cantidad. `removable` agrega el botón "X" de sacar la línea — solo
  tiene sentido en "Edit order", por eso es opt-in y no parte del modo
  `editable` en sí.

### Estructura de carpetas de `admin/src/app/`

A partir de acá `admin` deja de ser un único `app.html` con todo
apilado y pasa a tener rutas y páginas reales:

```
app/
├── core/                # servicios singleton de toda la app (auth/http/layout state)
├── layout/               # el shell real: shell/ (topbar+sidebar+router-outlet), sidebar/, topbar/
├── features/             # una carpeta por área de negocio, 1:1 con las secciones de este documento
│   ├── dashboard/
│   ├── orders/           # pages/ (list/detail/edit/refund) + components/ + services/ + models/
│   ├── products/         # pages/ (list/detail) + components/ + services/ + models/
│   ├── customers/        # pages/ (list/create/detail) + components/ + services/ + models/
│   └── dev-showcase/      # página /dev de validación visual — ver más abajo
├── shared/                # ya existía — cross-feature
│   ├── ui/                 # los composites: status-badge, data-table, order-line-item, quick-adjust-popover
│   ├── utils/               # funciones puras cross-feature (ej. formatMoney)
│   └── models/               # tipos genéricos cross-feature (vacío por ahora)
├── app.routes.ts           # solo hace lazy-load de cada features/*/*.routes.ts, bajo ShellComponent
└── app.ts / app.html        # reducido a `<router-outlet />` — el shell vive en layout/shell
```

Dos decisiones tomadas al armar esto:

1. **Nombres de `features/` en inglés** (`orders`, `products`,
   `customers`, `dashboard`) aunque el backend use español (`pedido`,
   `producto`, `usuario`). Motivo: el copy de la UI y las rutas/URLs ya
   están calcadas literal de Shopify en inglés — meter español ahí
   generaría una mezcla constante entre "lo que dice la pantalla" y
   "cómo se llama la carpeta". El mapeo español↔inglés queda contenido
   en la capa `services/` de cada feature (el único lugar que habla con
   `/pedido`, `/producto`, `/usuario` del backend) — una sola costura de
   traducción, no una filtración por todos lados.
2. **`shared/ui` se queda dentro de `admin/`, no se extrae a librería
   Angular todavía.** Extraer con `ng generate library` es mecánico y de
   bajo riesgo el día que la app `tienda` exista de verdad; hacerlo antes
   sería diseñar una API pública de librería (segunda entrada de build,
   versionado, qué es "genérico" vs "específico de admin") a ciegas, sin
   un segundo consumidor real que confirme qué es realmente compartido.

Dentro de cada feature, `pages/` son componentes atados a una ruta
(`*.routes.ts` los referencia directo); `components/` son piezas
propias de esa feature reusadas entre varias de sus páginas pero sin
alcance cross-feature (si empiezan a hacer falta en otra feature, ahí
sí pasan a `shared/ui`). Por ahora `components/`, `services/` y
`models/` de cada feature están vacíos (con `.gitkeep`) — se llenan
cuando cada página deja de ser un placeholder.

**`features/dev-showcase`** (ruta `/dev`, fuera del sidebar) es la
continuación del `app.html` original: sigue siendo donde se comparan
componentes de `shared/ui/` contra las capturas de Shopify antes de
darlos por buenos, ahora como una página más del árbol de rutas en vez
de todo el contenido de `App`. Efecto colateral bueno de haberla vuelto
una ruta lazy-loaded: PrimeNG's `TableModule` (pesado) salió del bundle
inicial — bajó de ~926 kB a ~336 kB, bien debajo del budget de 500 kB
que antes tiraba warning.

El shell (`layout/shell` + `sidebar` + `topbar`) es deliberadamente
mínimo por ahora: usa los tokens de color ya extraídos
(`--color-topbar`, `--color-sidebar-bg`, `--color-nav-active`) pero sin
íconos, submenús expandibles, buscador global, ni el resto de lo
descrito en "Lenguaje visual general" — eso es una pieza de diseño
propia, todavía pendiente de especificar a nivel de composite.

### Implicaciones técnicas

- Ya instalado en `frontend/`: `@angular/cdk@21` (peer dependency
  obligatoria de PrimeNG, no la trae sola), `@angular/animations@21`
  (para `provideAnimationsAsync`), `primeng@21.1.10`,
  `@primeuix/themes@2.0.2` (**no** `@primeng/themes` — ese paquete está
  deprecado, el equipo de PrimeTek movió el contenido de los presets a
  `@primeuix/themes`), `tailwindcss@4` + `@tailwindcss/postcss`.
- `providePrimeNG({ theme: 'none' })` ya configurado en
  `app.config.ts` de `admin`, junto con `provideAnimationsAsync()`.
- Definir los **design tokens** (colores de estado, escala tipográfica,
  radios de borde, sombras) calcados de la sección "Lenguaje visual
  general" de este documento — como variables/config de Tailwind, ya
  que no se está usando el sistema de preset de PrimeNG — antes de
  construir el primer componente, para no rehacer trabajo.
- La librería de componentes compartida (`shared-ui` o similar) se
  agrega con `ng generate library` cuando se empiece `tienda` — por
  ahora los 7 composites listados arriba viven directo en `admin`, ya
  que no hay un segundo consumidor todavía.
- Empezar por el componente más simple y más reutilizado (Badge de
  estado, sobre `p-tag`) para validar el patrón de `pt` antes de
  meterse con el `p-table` (el más riesgoso visualmente) o el popover de
  posicionamiento.
