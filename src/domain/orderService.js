'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CAPA DE NEGOCIO PURA — OrderService
//
//  REGLA DE ORO: Este módulo NO importa nada de gRPC, HTTP, Kafka ni ningún
//  framework de transporte. Solo conoce entidades del dominio y el repositorio.
//  Se puede invocar desde una terminal, desde gRPC, desde un test unitario
//  o desde un consumidor de Kafka sin cambiar una sola línea aquí.
// ─────────────────────────────────────────────────────────────────────────────

const { Order, BusinessError } = require('./order');
const inventory                = require('./inventory');

const DISCOUNT_THRESHOLD = 1000; // MXN: descuento si subtotal supera este monto
const DISCOUNT_RATE      = 0.10; // 10%
const IVA_RATE           = 0.16; // 16%

class OrderService {
  /**
   * Procesa una orden de compra completa.
   *
   * @param {object} params
   * @param {string} params.clientId
   * @param {string} params.productId
   * @param {number} params.quantity
   * @param {number} params.unitPrice
   * @returns {{ orderId, status, subtotal, discount, iva, total, errorMessage }}
   * @throws {BusinessError} para entradas inválidas o producto inexistente
   */
  processOrder({ clientId, productId, quantity, unitPrice }) {
    // ── Validación de entradas (falla rápido) ─────────────────────────────
    this._validateInput({ clientId, productId, quantity, unitPrice });

    // ── Verificar que el producto exista en el catálogo ───────────────────
    const product = inventory.findProduct(productId);
    if (!product) {
      throw new BusinessError(
        'PRODUCTO_NO_ENCONTRADO',
        `El producto con ID "${productId}" no existe en el catálogo`
      );
    }

    // ── Crear la orden en estado inicial CREADA ───────────────────────────
    const order = new Order({ clientId, productId, quantity, unitPrice });

    // ── Regla 1: Validación de stock ──────────────────────────────────────
    order.transitionTo('VALIDADA');

    if (product.stock < quantity) {
      order.transitionTo('RECHAZADA');
      return {
        orderId:      order.id,
        status:       order.status,
        subtotal:     0,
        discount:     0,
        iva:          0,
        total:        0,
        errorMessage: `Stock insuficiente. Disponible: ${product.stock} unidad(es), solicitado: ${quantity}`,
      };
    }

    // ── Regla 2: Cálculo de impuestos y descuentos ────────────────────────
    const subtotal      = round2(quantity * unitPrice);
    const discount      = subtotal > DISCOUNT_THRESHOLD ? round2(subtotal * DISCOUNT_RATE) : 0;
    const afterDiscount = round2(subtotal - discount);
    const iva           = round2(afterDiscount * IVA_RATE);
    const total         = round2(afterDiscount + iva);

    // ── Descontar del inventario y aprobar ────────────────────────────────
    inventory.decreaseStock(productId, quantity);
    order.transitionTo('APROBADA');

    return {
      orderId:      order.id,
      status:       order.status,
      subtotal,
      discount,
      iva,
      total,
      errorMessage: '',
    };
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  _validateInput({ clientId, productId, quantity, unitPrice }) {
    if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
      throw new BusinessError('DATOS_INVALIDOS', 'client_id es requerido y debe ser una cadena no vacía');
    }
    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      throw new BusinessError('DATOS_INVALIDOS', 'product_id es requerido y debe ser una cadena no vacía');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BusinessError('DATOS_INVALIDOS', 'quantity debe ser un entero positivo');
    }
    if (typeof unitPrice !== 'number' || unitPrice <= 0) {
      throw new BusinessError('DATOS_INVALIDOS', 'unit_price debe ser un número positivo');
    }
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = new OrderService();
