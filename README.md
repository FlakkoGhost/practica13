# Práctica 13 — Implementación de la Capa de Negocios en un Ambiente Distribuido

Sistema de Gestión de Inventario y Pedidos implementado con **gRPC + Node.js**, demostrando la separación estricta entre la capa de negocio y la capa de transporte middleware.

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Lenguaje | Node.js 18+ |
| Middleware de comunicación | gRPC (`@grpc/grpc-js`) |
| Contrato de interfaz | Protocol Buffers 3 (`proto/orders.proto`) |
| Persistencia | Repositorio en memoria (`src/domain/inventory.js`) |

## Estructura del Proyecto

```
practica13/
├── proto/
│   └── orders.proto              # Contrato gRPC (IDL)
├── src/
│   ├── domain/                   # CAPA DE NEGOCIO PURA (sin dependencias de red)
│   │   ├── inventory.js          # Repositorio de inventario en memoria
│   │   ├── order.js              # Entidad Order + máquina de estados + BusinessError
│   │   └── orderService.js       # Reglas de negocio: validación, cálculos, transiciones
│   ├── middleware/
│   │   └── grpcServer.js         # CAPA DE TRANSPORTE: servidor gRPC (solo serialización y routing)
│   └── client/
│       └── testClient.js         # Script de pruebas de integración (4 escenarios)
├── package.json
└── README.md
```

## Instalación

```bash
cd practica13
npm install
```

> Requiere Node.js 18 o superior. Verificar con `node --version`.

## Ejecución

### 1. Iniciar el servidor gRPC

Abrir una terminal y ejecutar:

```bash
npm run server
```

Output esperado:
```
╔══════════════════════════════════════════════╗
║   gRPC Order Service — Puerto 50051          ║
║   Práctica 13 · Sistemas Distribuidos        ║
╚══════════════════════════════════════════════╝

✅ Servidor escuchando en 0.0.0.0:50051
   Esperando peticiones...
```

### 2. Ejecutar los casos de prueba

Abrir **otra terminal** (el servidor debe seguir corriendo) y ejecutar:

```bash
npm test
```

## Reglas de Negocio Implementadas

### Regla 1 — Validación de Stock
Si la cantidad solicitada supera el stock disponible, la orden pasa a estado `RECHAZADA` con el motivo detallado.

### Regla 2 — Cálculo de Impuestos y Descuentos
| Condición | Cálculo |
|---|---|
| Subtotal ≤ $1,000 | Total = subtotal + (subtotal × 16%) |
| Subtotal > $1,000 | Total = (subtotal − 10%) + ((subtotal − 10%) × 16%) |

### Regla 3 — Máquina de Estados
```
CREADA → VALIDADA → APROBADA
                  ↘ RECHAZADA
```
Cualquier transición fuera de este flujo lanza una `BusinessError` con código `TRANSICION_INVALIDA`.

## Casos de Prueba

| # | Escenario | Resultado Esperado |
|---|---|---|
| 1 | PROD-001 × 2 uds @ $600 | `APROBADA`, descuento 10%, IVA 16%, total $1,252.80 |
| 2 | PROD-002 × 50 uds (stock: 5) | `RECHAZADA`, motivo: stock insuficiente |
| 3 | PROD-INVALID-XYZ × 1 ud | Error gRPC `NOT_FOUND` capturado por el middleware |
| 4 | client_id vacío, quantity negativa | Error gRPC `INVALID_ARGUMENT` |

## Separación de Capas

El principio central de la práctica se refleja en que **`orderService.js` no tiene ningún `require` de gRPC**. 
El servidor (`grpcServer.js`) actúa únicamente como adaptador: deserializa la petición, invoca la lógica de negocio, y serializa la respuesta o el error de vuelta al protocolo de red.

```
[Cliente gRPC] ──protobuf──▶ [grpcServer.js]  ──POJO──▶ [orderService.js]
               ◀──protobuf── [grpcServer.js]  ◀──POJO── [orderService.js]
```
