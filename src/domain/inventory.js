'use strict';

// ─── Repositorio de inventario en memoria ────────────────────────────────────
// Simula la capa de persistencia. En producción se reemplazaría por una BD real
// sin cambiar ningún código de la capa de negocio (principio de inversión).

const catalog = new Map([
  ['PROD-001', { name: 'Laptop Ultrabook',    stock: 10, minPrice: 0 }],
  ['PROD-002', { name: 'Teclado Mecánico',    stock: 5,  minPrice: 0 }],
  ['PROD-003', { name: 'Monitor 4K 27"',      stock: 3,  minPrice: 0 }],
  ['PROD-004', { name: 'Silla Ergonómica',    stock: 0,  minPrice: 0 }], // sin stock
]);

class InventoryRepository {
  findProduct(productId) {
    return catalog.get(productId) ?? null;
  }

  decreaseStock(productId, quantity) {
    const product = catalog.get(productId);
    if (!product) throw new Error(`Producto ${productId} no existe`);
    if (product.stock < quantity) throw new Error('Stock insuficiente al momento de decrementar');
    product.stock -= quantity;
  }

  getStock(productId) {
    return catalog.get(productId)?.stock ?? 0;
  }
}

module.exports = new InventoryRepository();
