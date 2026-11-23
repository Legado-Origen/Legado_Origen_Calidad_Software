## Descripción

Closes #<!-- número del issue -->

**Requisitos asociados:** <!-- por ejemplo: RF-011, RNF-007 -->

**Qué implementa:**
<!-- Resumen del cambio -->

**Artefactos de diseño que sigue:**
<!-- Endpoints, esquema de base de datos o diagramas de secuencia. Escriba "No aplica" si no corresponde -->

## Pruebas

| Prueba | Tipo | Comportamiento que verifica | Resultado |
|---|---|---|---|
| <!-- nombre del archivo o del caso --> | <!-- unitaria / integración / E2E --> | <!-- qué comprueba --> | <!-- pasa / falla --> |

---

## Checklist de revisión de código
<!-- Para PR de código. Lo marca el revisor, que debe ser distinto del autor. Borre esta sección si es un PR de diseño -->

- [ ] **Implementa el requisito y el diseño:** cumple los criterios de aceptación del issue enlazado y respeta los artefactos de diseño (endpoints, esquema de base de datos y diagramas de secuencia).
- [ ] **Cumple las reglas de negocio:** respeta las reglas de los requisitos, y las reglas sensibles (comisión, IVA) se obtienen de la configuración, no de valores fijos.
- [ ] **Valida las entradas:** los datos del cliente se validan en el backend y las consultas a la base de datos son parametrizadas (RNF-003).
- [ ] **Maneja los errores:** los errores se responden mediante el middleware centralizado con mensajes genéricos (RNF-005), y se contemplan los casos de error del diseño (pago rechazado, pieza ya vendida).
- [ ] **Controla transacciones y concurrencia:** cuando aplica, las órdenes y los pagos se ejecutan en transacciones atómicas (RNF-006) y con control de concurrencia sobre piezas únicas (RNF-007).
- [ ] **Protege los datos sensibles:** no almacena ni registra contraseñas en texto plano, números de tarjeta ni CVC (RNF-001, RNF-002), y las credenciales se obtienen de variables de entorno.
- [ ] **Incluye pruebas:** incluye pruebas que cubren el comportamiento nuevo, incluidos sus casos de error.
- [ ] **Reutiliza la lógica existente:** no duplica funcionalidad ya implementada.

## Checklist de revisión de diseño
<!-- Para PR de artefactos de diseño (ramas docs/). Borre esta sección si es un PR de código -->

- [ ] **Satisface los requisitos:** el artefacto implementa por completo cada requisito indicado.
- [ ] **Cumple las reglas de negocio y restricciones:** por ejemplo, la comisión solo se calcula para vendedores externos (RF-015) y no se almacena el número completo de la tarjeta ni el CVC (RNF-002).
- [ ] **Contempla los casos de error:** define qué ocurre si el pago es rechazado, si la pieza ya fue vendida o si la pasarela no responde.
- [ ] **Flujo de datos correcto:** cada componente recibe los datos que necesita, y el formato coincide entre quien los envía y quien los recibe.
- [ ] **Interfaces completas:** cada interfaz indica su propósito, parámetros, formato de entrada y salida, y respuestas de error.
- [ ] **Conforme a la arquitectura:** respeta la separación en capas de RNF-013 (por ejemplo, la presentación no accede directamente a la base de datos).