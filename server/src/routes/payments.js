'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// --- Product catalog (must match client-side TOWER_DEFS) ---
const PRODUCTS = {
  tesla:   { id: 'tesla',   name: '테슬라 타워', price: 1200, type: 'permanent' },
  frost:   { id: 'frost',   name: '서리 타워',   price: 900,  type: 'permanent' },
  flame:   { id: 'flame',   name: '화염 타워',   price: 900,  type: 'permanent' },
  nuke:    { id: 'nuke',    name: '핵 타워',     price: 2400, type: 'permanent' },
  voidray: { id: 'voidray', name: '공허 타워',   price: 1800, type: 'permanent' },
  god:     { id: 'god',     name: '갓 타워',     price: 1000, type: 'consumable', quantity: 1 },
  nuke_bomb: { id: 'nuke_bomb', name: '핵폭탄 스킬', price: 500, type: 'consumable', quantity: 1 },
};

// --- Toss Payments configuration ---
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || '';
const TOSS_API_URL = 'https://api.tosspayments.com/v1/payments';

function getTossAuthHeader() {
  // Toss Payments uses Basic auth with secretKey:
  const encoded = Buffer.from(TOSS_SECRET_KEY + ':').toString('base64');
  return 'Basic ' + encoded;
}

// GET /api/payments/products - List available products
router.get('/products', (req, res) => {
  const products = Object.values(PRODUCTS).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    type: p.type,
  }));
  res.json({ products });
});

// POST /api/payments/orders - Create a payment order
router.post('/orders', (req, res) => {
  const { product_id, player_name } = req.body;

  if (!product_id || !PRODUCTS[product_id]) {
    return res.status(400).json({ error: 'Invalid product_id' });
  }
  if (!player_name || typeof player_name !== 'string' || player_name.trim().length === 0) {
    return res.status(400).json({ error: 'player_name is required' });
  }

  const product = PRODUCTS[product_id];
  const orderId = 'TD_' + uuidv4().replace(/-/g, '').slice(0, 20);

  db.prepare(`
    INSERT INTO payment_orders (id, order_id, product_id, product_name, amount, player_name, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(uuidv4(), orderId, product_id, product.name, product.price, player_name.trim().slice(0, 32));

  res.status(201).json({
    orderId,
    amount: product.price,
    orderName: product.name,
    productId: product.id,
    productType: product.type,
  });
});

// POST /api/payments/confirm - Confirm payment after Toss Payments redirect
router.post('/confirm', async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;

  if (!paymentKey || !orderId || amount === undefined) {
    return res.status(400).json({ error: 'paymentKey, orderId, and amount are required' });
  }

  // Find the order
  const order = db.prepare('SELECT * FROM payment_orders WHERE order_id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status === 'paid') {
    return res.status(409).json({ error: 'Order already confirmed', productId: order.product_id });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: 'Order is not in pending status' });
  }

  // Verify amount matches
  if (Number(amount) !== order.amount) {
    db.prepare("UPDATE payment_orders SET status = 'failed', updated_at = datetime('now') WHERE order_id = ?")
      .run(orderId);
    return res.status(400).json({ error: 'Amount mismatch' });
  }

  // If no Toss secret key configured, use test mode (auto-approve) — dev only
  if (!TOSS_SECRET_KEY && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ error: 'Payment service not configured' });
  }
  if (!TOSS_SECRET_KEY) {
    // Test mode: approve payment without calling Toss API (non-production only)
    db.prepare(`
      UPDATE payment_orders
      SET status = 'paid', payment_key = ?, updated_at = datetime('now')
      WHERE order_id = ?
    `).run(paymentKey, orderId);

    // Record the purchase
    recordPurchase(order);

    return res.json({
      success: true,
      orderId,
      productId: order.product_id,
      productType: PRODUCTS[order.product_id]?.type || 'permanent',
      testMode: true,
    });
  }

  // Production mode: confirm with Toss Payments API
  try {
    const response = await fetch(TOSS_API_URL + '/confirm', {
      method: 'POST',
      headers: {
        'Authorization': getTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });

    const result = await response.json();

    if (!response.ok) {
      db.prepare("UPDATE payment_orders SET status = 'failed', updated_at = datetime('now') WHERE order_id = ?")
        .run(orderId);
      return res.status(response.status).json({
        error: result.message || 'Payment confirmation failed',
        code: result.code,
      });
    }

    // Payment confirmed by Toss
    db.prepare(`
      UPDATE payment_orders
      SET status = 'paid', payment_key = ?, updated_at = datetime('now')
      WHERE order_id = ?
    `).run(paymentKey, orderId);

    recordPurchase(order);

    return res.json({
      success: true,
      orderId,
      productId: order.product_id,
      productType: PRODUCTS[order.product_id]?.type || 'permanent',
    });

  } catch (err) {
    console.error('Toss Payments confirm error:', err);
    return res.status(500).json({ error: 'Payment service error' });
  }
});

// GET /api/payments/purchases/:playerName - Get a player's purchases
router.get('/purchases/:playerName', (req, res) => {
  const { playerName } = req.params;

  const purchases = db.prepare(`
    SELECT product_id, product_type, quantity, purchased_at
    FROM purchases
    WHERE player_name = ?
    ORDER BY purchased_at DESC
  `).all(playerName);

  // Aggregate: permanent unlocks + consumable counts
  const unlocked = [];
  const consumables = {};

  for (const p of purchases) {
    if (p.product_type === 'permanent') {
      if (!unlocked.includes(p.product_id)) {
        unlocked.push(p.product_id);
      }
    } else if (p.product_type === 'consumable') {
      consumables[p.product_id] = (consumables[p.product_id] || 0) + p.quantity;
    }
  }

  res.json({ unlocked, consumables, purchases });
});

// GET /api/payments/orders/:orderId - Check order status
router.get('/orders/:orderId', (req, res) => {
  const order = db.prepare('SELECT * FROM payment_orders WHERE order_id = ?').get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({
    orderId: order.order_id,
    productId: order.product_id,
    amount: order.amount,
    status: order.status,
    playerName: order.player_name,
  });
});

// --- Internal: record a successful purchase ---
function recordPurchase(order) {
  const product = PRODUCTS[order.product_id];
  if (!product) return;

  db.prepare(`
    INSERT INTO purchases (id, order_id, player_name, product_id, product_type, quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    order.order_id,
    order.player_name,
    order.product_id,
    product.type,
    product.quantity || 1,
  );
}

module.exports = router;
