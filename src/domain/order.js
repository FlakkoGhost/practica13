'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── Máquina de estados de la orden ──────────────────────────────────────────
// Define las transiciones válidas. Intentar una transición no permitida
// lanza una excepción inmediatamente — no hay estados "intermedios" silenciosos.

const VALID_TRANSITIONS = {
  CREADA:    ['VALIDADA'],
  VALIDADA:  ['APROBADA', 'RECHAZADA'],
  APROBADA:  [],
  RECHAZADA: [],
};

// ─── Error de dominio (no tiene ninguna dependencia de gRPC ni HTTP) ──────────
class BusinessError extends Error {
  constructor(code, message) {
    super(message);
    this.code    = code;   // e.g. 'STOCK_INSUFICIENTE', 'PRODUCTO_NO_ENCONTRADO'
    this.name    = 'BusinessError';
  }
}

// ─── Entidad Orden ────────────────────────────────────────────────────────────
class Order {
  constructor({ clientId, productId, quantity, unitPrice }) {
    this.id         = uuidv4();
    this.clientId   = clientId;
    this.productId  = productId;
    this.quantity   = quantity;
    this.unitPrice  = unitPrice;
    this.status     = 'CREADA';
    this.createdAt  = new Date();
  }

  // Regla 3: Transición de estados estricta
  transitionTo(newStatus) {
    const allowed = VALID_TRANSITIONS[this.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BusinessError(
        'TRANSICION_INVALIDA',
        `Transición no permitida: ${this.status} → ${newStatus}`
      );
    }
    this.status = newStatus;
  }
}

module.exports = { Order, BusinessError };
