'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CAPA DE TRANSPORTE — gRPC Server
//
//  Responsabilidad única: recibir peticiones de la red, delegarlas a la capa
//  de negocio, y traducir el resultado (o los errores) al protocolo gRPC.
//  No contiene ninguna lógica de negocio. Si mañana se cambia gRPC por REST,
//  solo cambia este archivo — orderService.js queda intacto.
// ─────────────────────────────────────────────────────────────────────────────

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const orderService = require('../domain/orderService');
const { BusinessError } = require('../domain/order');

// ── Cargar contrato .proto ────────────────────────────────────────────────────
const PROTO_PATH = path.join(__dirname, '../../proto/orders.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase:  true,
  longs:     String,
  enums:     String,
  defaults:  true,
  oneofs:    true,
});
const ordersProto = grpc.loadPackageDefinition(packageDef).orders;

// ── Mapeo de errores de dominio → códigos gRPC ────────────────────────────────
const BUSINESS_ERROR_TO_GRPC = {
  DATOS_INVALIDOS:       grpc.status.INVALID_ARGUMENT,
  PRODUCTO_NO_ENCONTRADO: grpc.status.NOT_FOUND,
  STOCK_INSUFICIENTE:    grpc.status.FAILED_PRECONDITION,
  TRANSICION_INVALIDA:   grpc.status.INTERNAL,
};

// ── Handler: ProcessOrder ─────────────────────────────────────────────────────
function processOrder(call, callback) {
  const req = call.request;

  console.log(`\n[gRPC] ▶ ProcessOrder recibido:`, JSON.stringify(req));

  try {
    const result = orderService.processOrder({
      clientId:  req.client_id,
      productId: req.product_id,
      quantity:  req.quantity,
      unitPrice: req.unit_price,
    });

    console.log(`[gRPC] ✔ Resultado: ${result.status} | Total: $${result.total}`);

    callback(null, {
      order_id:      result.orderId,
      status:        result.status,
      subtotal:      result.subtotal,
      discount:      result.discount,
      iva:           result.iva,
      total:         result.total,
      error_message: result.errorMessage,
    });

  } catch (err) {
    if (err instanceof BusinessError) {
      // Error de negocio conocido → respuesta gRPC con código semántico
      const grpcCode = BUSINESS_ERROR_TO_GRPC[err.code] ?? grpc.status.INTERNAL;
      console.error(`[gRPC] ✖ BusinessError [${err.code}]: ${err.message}`);
      callback({ code: grpcCode, message: err.message });
    } else {
      // Error inesperado → INTERNAL para no exponer detalles internos
      console.error(`[gRPC] ✖ Error inesperado:`, err);
      callback({ code: grpc.status.INTERNAL, message: 'Error interno del servidor' });
    }
  }
}

// ── Handler: GetOrderStatus ───────────────────────────────────────────────────
function getOrderStatus(call, callback) {
  // Stub simple — en producción consultaría una BD de órdenes
  callback({
    code:    grpc.status.UNIMPLEMENTED,
    message: 'GetOrderStatus no implementado en esta versión',
  });
}

// ── Iniciar servidor ──────────────────────────────────────────────────────────
function startServer(port = 50051) {
  const server = new grpc.Server();

  server.addService(ordersProto.OrderService.service, {
    ProcessOrder:   processOrder,
    GetOrderStatus: getOrderStatus,
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[gRPC] Error al iniciar servidor:', err.message);
        process.exit(1);
      }
      console.log(`\n╔══════════════════════════════════════════════╗`);
      console.log(`║   gRPC Order Service — Puerto ${boundPort}          ║`);
      console.log(`║   Práctica 13 · Sistemas Distribuidos        ║`);
      console.log(`╚══════════════════════════════════════════════╝`);
      console.log(`\n✅ Servidor escuchando en 0.0.0.0:${boundPort}`);
      console.log(`   Esperando peticiones...\n`);
    }
  );

  return server;
}

startServer();
