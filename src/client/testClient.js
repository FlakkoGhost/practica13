'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CLIENTE DE PRUEBAS gRPC — Simula un productor distribuido
//
//  Ejecuta los 3 escenarios requeridos por la práctica y muestra los resultados
//  con formato detallado para evidenciar el correcto funcionamiento del sistema.
// ─────────────────────────────────────────────────────────────────────────────

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '../../proto/orders.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const ordersProto = grpc.loadPackageDefinition(packageDef).orders;

const client = new ordersProto.OrderService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// ── Utilidades de presentación ────────────────────────────────────────────────

function line(char = '─', len = 60) {
  return char.repeat(len);
}

function printResult(testName, request, response, error) {
  console.log(`\n${line('═')}`);
  console.log(` CASO: ${testName}`);
  console.log(line('─'));
  console.log(` REQUEST enviado:`);
  console.log(`   client_id  : ${request.client_id}`);
  console.log(`   product_id : ${request.product_id}`);
  console.log(`   quantity   : ${request.quantity}`);
  console.log(`   unit_price : $${request.unit_price}`);
  console.log(line('─'));

  if (error) {
    console.log(` ❌ ERROR gRPC capturado por el middleware:`);
    console.log(`   Código  : ${error.code} (${grpcCodeName(error.code)})`);
    console.log(`   Mensaje : ${error.details}`);
  } else {
    const icon   = response.status === 'APROBADA' ? '✅' : '🚫';
    const subtot = response.subtotal.toFixed(2);
    const disc   = response.discount.toFixed(2);
    const iva    = response.iva.toFixed(2);
    const total  = response.total.toFixed(2);

    console.log(` ${icon} RESPUESTA:`);
    console.log(`   order_id  : ${response.order_id}`);
    console.log(`   estado    : ${response.status}`);

    if (response.status === 'APROBADA') {
      console.log(`   subtotal  : $${subtot}`);
      console.log(`   descuento : $${disc}${response.discount > 0 ? '  ← 10% aplicado (compra > $1,000)' : ''}`);
      console.log(`   IVA 16%   : $${iva}`);
      console.log(`   TOTAL     : $${total}`);
    }

    if (response.error_message) {
      console.log(`   motivo    : ${response.error_message}`);
    }
  }
  console.log(line('═'));
}

function grpcCodeName(code) {
  const names = {
    0: 'OK', 1: 'CANCELLED', 2: 'UNKNOWN', 3: 'INVALID_ARGUMENT',
    4: 'DEADLINE_EXCEEDED', 5: 'NOT_FOUND', 6: 'ALREADY_EXISTS',
    7: 'PERMISSION_DENIED', 9: 'FAILED_PRECONDITION', 12: 'UNIMPLEMENTED',
    13: 'INTERNAL',
  };
  return names[code] ?? `CODE_${code}`;
}

// ── Wrapper promisificado del cliente gRPC ────────────────────────────────────

function sendOrder(request) {
  return new Promise((resolve, reject) => {
    client.ProcessOrder(request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// ── Suite de pruebas ──────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     PRUEBAS DE INTEGRACIÓN — gRPC Order Service          ║');
  console.log('║     Práctica 13 · Sistemas Distribuidos                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── CASO 1: Orden válida con descuento aplicado ──────────────────────────
  // PROD-001 tiene 10 unidades. Compramos 2 a $600 c/u → subtotal $1,200 > $1,000
  // Se aplica 10% de descuento y 16% IVA sobre el precio descontado.
  {
    const req = { client_id: 'CLI-001', product_id: 'PROD-001', quantity: 2, unit_price: 600.00 };
    try {
      const res = await sendOrder(req);
      printResult('Orden válida — descuento + IVA aplicados', req, res, null);
    } catch (err) {
      printResult('Orden válida — descuento + IVA aplicados', req, null, err);
    }
  }

  // ── CASO 2: Sobregiro de stock ───────────────────────────────────────────
  // PROD-002 tiene 5 unidades. Solicitamos 50 → debe retornar RECHAZADA.
  {
    const req = { client_id: 'CLI-002', product_id: 'PROD-002', quantity: 50, unit_price: 350.00 };
    try {
      const res = await sendOrder(req);
      printResult('Sobregiro de stock — RECHAZADA', req, res, null);
    } catch (err) {
      printResult('Sobregiro de stock — RECHAZADA', req, null, err);
    }
  }

  // ── CASO 3: Producto inexistente — excepción controlada por el middleware ─
  // El middleware captura el BusinessError(PRODUCTO_NO_ENCONTRADO) y lo traduce
  // a gRPC status NOT_FOUND antes de propagarlo al cliente.
  {
    const req = { client_id: 'CLI-003', product_id: 'PROD-INVALID-XYZ', quantity: 1, unit_price: 100.00 };
    try {
      const res = await sendOrder(req);
      printResult('Producto inexistente — excepción controlada', req, res, null);
    } catch (err) {
      printResult('Producto inexistente — excepción controlada', req, null, err);
    }
  }

  // ── CASO BONUS: Datos corruptos (quantity negativa) ─────────────────────
  {
    const req = { client_id: '', product_id: 'PROD-001', quantity: -5, unit_price: 0 };
    try {
      const res = await sendOrder(req);
      printResult('BONUS: Datos corruptos — INVALID_ARGUMENT', req, res, null);
    } catch (err) {
      printResult('BONUS: Datos corruptos — INVALID_ARGUMENT', req, null, err);
    }
  }

  console.log('\n✔  Suite de pruebas completada.\n');
  process.exit(0);
}

runTests();
