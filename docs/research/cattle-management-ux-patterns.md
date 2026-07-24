# Investigación UX: organización de una app de gestión ganadera

Fecha: 2026-07-24  
Base revisada de REJO: `f00bf82`  
Alcance: arquitectura de información, navegación y divulgación progresiva. No propone cambiar reglas de dominio, datos ni el comportamiento local-first.

## Método y cómo leer este documento

Se revisó la interfaz actual de REJO en el código y se contrastó con documentación oficial de productos de gestión ganadera. Las afirmaciones marcadas como **Evidencia** describen lo que publica el producto fuente o lo que existe hoy en REJO. Las marcadas como **Inferencia para REJO** son decisiones de diseño recomendadas; no se atribuyen a los productos investigados.

Las capturas bancarias aportadas por el usuario sirven como referencia del patrón de accesos claros, no como modelo visual o funcional que deba copiarse. Una finca tiene prioridades, riesgos y flujos distintos de una billetera.

## Auditoría de la interfaz actual de REJO

| Área | Lo que hoy contiene | Riesgo de comprensión |
| --- | --- | --- |
| **Inicio** | Medida del tanque, promedio de siete días, acceso a potreros, alertas y tendencia. | Mezcla rutina diaria, consulta de indicadores y navegación hacia otro módulo en una sola columna. |
| **Mis vacas** | Grupos del rejo, lista de animales, ficha individual, alta guiada y acceso pequeño a control lechero. | La lista ya es compacta, pero reproducción, sanidad y control lechero no tienen una entrada global visible y consistente. |
| **Ficha de animal** | General, reproducción y sanidad en pestañas. | Es una buena ubicación para el historial individual; no debe convertirse en el único lugar para encontrar pendientes de reproducción o sanidad del rejo. |
| **Control lechero** | Resumen del último control, indicadores reproductivos/sanitarios y formulario de nuevo control. | Une revisión de resultados y captura extensa en la misma primera vista; además solo se descubre desde Mis vacas. |
| **Potreros y rotación** | Estado de cada potrero, movimiento de lote y alta de potrero/lote. | Es un módulo operativo propio, pero hoy se llega solamente desde Inicio. El estado, el formulario y la configuración aparecen seguidos. |
| **Finanzas** | Nueva liquidación, historial, costo por litro, movimiento rápido y formularios de activo/trabajo. | Es el caso más cargado: conciliación, historial, flujo de caja y costos estructurales compiten por atención en el mismo scroll. |
| **Ajustes** | Datos permanentes de finca, comprador, tabla de aforo y plan sanitario/tareas. | Combina configuración poco frecuente con trabajo operativo sanitario que debe ser visible cuando toca hacerlo. |

**Evidencia de REJO.** Esta lectura procede de `src/app/app.tsx`, `src/features/animals/animals-browser-page.tsx`, `src/features/economics/settlements-page.tsx`, `src/features/economics/cost-tracker-section.tsx`, `src/features/paddocks/paddocks-page.tsx`, `src/features/milk-control/milk-control-page.tsx` y `src/features/settings/settings-page.tsx`.

## Patrones verificados en productos ganaderos

### 1. El inicio es un tablero breve, no una página de formularios

**Evidencia.** CattleMax describe su Dashboard como el punto de partida con recordatorios, inventario, accesos a producción/sanidad, tareas y búsqueda; sus áreas principales permanecen separadas en la navegación. [CattleMax: Getting Around](https://help.cattlemax.com/article/705-getting-around-cattlemax). AgriWebb documenta un dashboard de visión rápida de potreros, ganado, tareas, lluvia y carga animal; la captura de datos pertenece a sus módulos. [AgriWebb: Navigating the Dashboard](https://help.agriwebb.com/en/articles/3288572-navigating-the-dashboard).

**Inferencia para REJO.** Inicio debe llamarse y comportarse como **Hoy**: una acción primaria (anotar la leche), un resumen de atención y entre cuatro y seis accesos claros. No debe contener formularios de liquidación, costos, potreros o control lechero. Un grid de accesos es adecuado si cada tarjeta solo explica a dónde lleva y qué requiere atención.

### 2. Los grupos organizan la lista; la ficha concentra la historia individual

**Evidencia.** CattleMax diferencia grupos manuales/inteligentes para organizar el inventario de la ficha individual, que concentra acciones e historial cronológico. [CattleMax: Cattle Inventory Records](https://www.cattlemax.com/cattle-inventory-records). Herdwatch publica manejo individual y por grupos, con historial sanitario y reproductivo del animal. [Herdwatch: Cattle](https://herdwatch.com/solutions/cattle/). AgriWebb separa Livestock, movimientos y tareas en sus áreas de navegación. [AgriWebb: Navigating the Web App](https://help.agriwebb.com/en/articles/1928117-navigating-the-web-app).

**Inferencia para REJO.** Mantener la lista por **grupos del rejo** y la ficha a pantalla completa es correcto. Sobre la lista debe existir un hub **Rejo** con cuatro destinos inequívocos: **Animales**, **Reproducción**, **Sanidad** y **Control lechero**. Los pendientes globales se consultan en Reproducción/Sanidad; la ficha responde “qué ha pasado con esta vaca”.

### 3. Potreros, rotación y tareas forman un contexto operativo propio

**Evidencia.** AgriWebb separa Map, Paddocks, Movements y Tasks; su ficha de potrero distingue detalles de pastoreo y su mapa permite reducir ruido con filtros o vistas guardadas. [AgriWebb: navegación móvil](https://help.agriwebb.com/en/articles/3401187-navigating-the-mobile-app), [resumen de potrero y ganado](https://help.agriwebb.com/en/articles/8849880-paddock-and-livestock-summary), [filtros de mapa](https://help.agriwebb.com/en/articles/10567902-farm-map-filters-and-views-web-app). CattleMax trata Pastures como área principal con inventario, movimientos y actividades. [CattleMax: Pasture Management](https://www.cattlemax.com/pasture-management). Herdwatch también presenta Pasture como solución diferenciada y conserva movimientos e historial de pastoreo. [Herdwatch: Livestock Apps](https://herdwatch.com/solutions/livestock-apps/).

**Inferencia para REJO.** **Potreros** debe ser un destino propio y descubrible, no una tarjeta perdida dentro de Inicio. Su primera vista muestra “dónde está el rejo” y qué potrero está listo; registrar un movimiento y administrar potreros/lotes se abren como acciones separadas. La configuración de descanso no se muestra hasta que el usuario elige crear o editar un potrero.

### 4. Finanzas separa resumen, registros y análisis

**Evidencia.** CattleMax documenta un resumen financiero por período y destinos separados para ingresos, gastos, ventas y organización anual. [CattleMax: Ranch Financial Records](https://help.cattlemax.com/article/525-ranch-related-financial-record-keeping). AgriWebb ofrece costos de producción y margen como reportes con indicadores, mientras que compras se consultan en un reporte de compras separado. [AgriWebb: Cost of Production and Gross Margin](https://help.agriwebb.com/en/articles/3288458-livestock-cost-of-production-and-gross-margin-mob), [AgriWebb: Purchase Report](https://help.agriwebb.com/en/articles/3777114-purchase-report).

**Inferencia para REJO.** Finanzas necesita una pantalla inicial **Resumen** y subsecciones: **Liquidaciones**, **Movimientos** y **Costos**. Los formularios “Registrar liquidación”, “Nuevo ingreso/egreso”, “Activo” y “Trabajo familiar” se abren solo al iniciar esa acción, idealmente a pantalla completa. Historiales y las tres variantes de costo por litro se consultan sin tener un formulario debajo.

### 5. Capturar en campo y analizar no son la misma tarea

**Evidencia.** AgriWebb diferencia la app móvil —donde se crean registros incluso offline— de la web —donde se revisan informes, se planifican ciclos y se analizan datos—, aunque ambas usan los mismos hechos. [AgriWebb: Mobile App and Web App](https://help.agriwebb.com/en/articles/3173701-agriwebb-mobile-app-and-web-app). Herdwatch también declara captura offline y sincronización al recuperar señal. [Herdwatch: plataforma](https://herdwatch.com/).

**Inferencia para REJO.** En un teléfono de la finca, la ruta predeterminada debe favorecer registrar un hecho rápido y revisar solo lo indispensable. Los análisis detallados siguen disponibles, pero detrás de “Ver resumen”, pestañas o rutas secundarias. Esto conserva la promesa local-first: ningún flujo operativo espera red ni necesita navegar por informes para guardar.

## Arquitectura de información recomendada para REJO

### Navegación persistente

Mantener cuatro destinos en la barra inferior evita sobrecarga:

1. **Inicio** — hoy, alertas y accesos.
2. **Rejo** — animales, reproducción, sanidad y control lechero.
3. **Finanzas** — resumen económico y registros.
4. **Más** — Potreros, configuración de finca y, cuando exista, calendario/tareas.

Potreros también aparece como acceso destacado en Inicio mientras sea una tarea frecuente. Esta duplicación es intencional: el acceso directo responde a la rutina diaria y **Más** conserva una ubicación estable para volver a encontrarlo.

### Inicio: “Hoy”

Orden propuesto:

1. Estado de respaldo discreto en el encabezado.
2. Tarjeta primaria de **Anotar la leche**.
3. Bloque **Atención hoy**, limitado a las dos alertas más importantes y un enlace “Ver todas”.
4. **Accesos de la finca** en grid: Rejo, Potreros, Finanzas y pendientes del rejo. La cuarta tarjeta puede variar entre Sanidad o Reproducción según la prioridad del día.
5. Una tarjeta breve de producción/tendencia con enlace a detalle, en vez de una gráfica grande antes de las acciones.

### Rejo

La primera pantalla no debe ser una lista larga. Debe ofrecer tarjetas o pestañas para:

| Sección | Primera información | Acción primaria |
| --- | --- | --- |
| **Animales** | Total y grupos del rejo | Ver lista / Agregar animal |
| **Reproducción** | Celos, servicios, parece preñada, partos próximos y repetidoras | Registrar evento |
| **Sanidad** | No se puede entregar su leche y tareas pendientes | Registrar atención / resolver tarea |
| **Control lechero** | Fecha y promedio del último control; es opcional | Hacer control |

Dentro de **Animales**, la implementación ya va en buena dirección: chips de grupos, filas compactas y ficha individual. La administración de grupos se mantiene fuera del flujo diario. La ficha conserva sus pestañas General, Reproducción y Sanidad.

### Finanzas

| Sub-sección | Muestra primero | Acción secundaria o de captura |
| --- | --- | --- |
| **Resumen** | Última liquidación, diferencia frente al precio justo, flujo reciente y costo por litro disponible | Ver el detalle pertinente |
| **Liquidaciones** | Historial por período y resultado de conciliación | Registrar liquidación |
| **Movimientos** | Ingresos/egresos recientes y filtros simples | Registrar ingreso o egreso |
| **Costos** | Caja, con depreciación y con trabajo familiar, con estado de datos faltantes | Agregar activo o trabajo familiar |

Ningún formulario aparece dentro de Resumen. Cada CTA abre su propia pantalla/modal de captura, con campos frecuentes primero y **Más detalles** para los opcionales.

### Más y configuración

**Más** contiene Potreros y Configuración. **Configuración** queda limitada a datos que cambian poco: finca, comprador, tabla de aforo, cuenta/respaldo. El plan sanitario y sus acciones dejan de competir con esos ajustes: los pendientes se ven en **Rejo > Sanidad**; su plantilla o reglas editables pueden residir en una subsección de Sanidad o en configuración avanzada.

## Reglas de diseño para el refactor

1. **Una intención principal por pantalla.** Consultar, registrar y configurar no comparten la primera vista.
2. **Resumen antes de profundidad.** La portada de cada módulo da estado y destinos; el historial se abre bajo demanda.
3. **Divulgación progresiva.** Mostrar lo indispensable; opciones de calidad, depreciación, notas y atributos raros viven tras “Más detalles”. Este patrón coincide con los modos básico/avanzado de registros de AgriWebb. [Tratamientos IAM](https://help.agriwebb.com/en/articles/3765769-treatment-records-iam), [pregnancy scanning IAM](https://help.agriwebb.com/en/articles/3638358-pregnancy-scanning-record-iam).
4. **Contexto correcto.** Un evento individual se inicia desde la ficha; un evento de varios animales, desde la vista global de Reproducción o Sanidad. CattleMax también usa filtros y actualización de grupos para estas tareas. [CattleMax: Herd Health](https://help.cattlemax.com/article/546-herd-health-preset-treatments-booster-and-withdrawal).
5. **No ocultar lo crítico.** “No se puede entregar su leche”, alertas de parto/servicio y tareas sanitarias permanecen visibles en Inicio y en su módulo, sin depender de una configuración.
6. **Preservar offline.** El refactor solo reorganiza rutas y componentes: cada mutación sigue escribiendo localmente y encolando sincronización conforme a ADR 0001.

## Orden de implementación sugerido

1. Crear la carcasa de navegación y las rutas de hub sin mover aún formularios ni datos.
2. Convertir Inicio en “Hoy” y añadir el grid de accesos, conservando la captura de leche como CTA principal.
3. Crear el hub Rejo y mover allí los accesos globales a Reproducción, Sanidad y Control lechero; mantener la ficha individual intacta.
4. Separar Finanzas en Resumen, Liquidaciones, Movimientos y Costos; extraer cada formulario a su flujo propio.
5. Hacer Potreros un destino estable y separar estado, movimiento y configuración.
6. Limpiar Ajustes y reubicar el plan sanitario según su intención operativa.
7. Validar en teléfono Android con recorridos de: leche diaria, nuevo animal, tratamiento, movimiento de lote, liquidación y egreso.

## Límites deliberados

No se recomienda copiar funcionalidades empresariales que hoy no aportan valor a una finca lechera pequeña del Carchi: mapas satelitales, EID, importaciones masivas, reportes extensos, inventario agrícola completo ni integración de equipos. El patrón útil es la organización por intención, no el volumen de funciones de CattleMax, AgriWebb, Herdwatch o HerdBoss.

