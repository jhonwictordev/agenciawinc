import { getStore } from "@netlify/blobs";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { WebhookSignatureValidator } from "mercadopago";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const parseBody = async (req) => { try { return await req.json(); } catch { return {}; } };
const productsStore = () => getStore("winc-products");
const ordersStore = () => getStore("winc-orders");
const eventsStore = () => getStore("winc-payment-events");
const uploadsStore = () => getStore("winc-private-uploads");
const safeEqual = (a = "", b = "") => { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); };
const isAdmin = (req) => process.env.ADMIN_TOKEN && safeEqual(req.headers.get("authorization") || "", `Bearer ${process.env.ADMIN_TOKEN}`);
const seedProducts = async () => JSON.parse(await readFile(new URL("../../data/products.json", import.meta.url), "utf8"));

async function getProducts() {
  const store = productsStore(); const saved = await store.get("catalog", { type: "json" });
  return Array.isArray(saved) ? saved : seedProducts();
}

async function createCheckout(req) {
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) return json({ error: "Checkout aguardando configuração das credenciais do Mercado Pago." }, 503);
  const body = await parseBody(req); const catalog = await getProducts(); const incoming = Array.isArray(body.items) ? body.items : [];
  if (!incoming.length) return json({ error: "Carrinho vazio." }, 400);
  const items = []; const orderItems = [];
  for (const entry of incoming) {
    const product = catalog.find((p) => p.id === entry.productId && p.active); const quantity = Math.max(1, Math.floor(Number(entry.quantity || 1)));
    if (!product || quantity > product.stock) return json({ error: "Produto indisponível ou quantidade inválida." }, 409);
    const artFee = entry.fields?.artCreationRequested ? Number(product.artCreationFee || 0) : 0; const unitPrice = Number(product.price) + artFee;
    items.push({ id: product.id, title: product.name, quantity, currency_id: "BRL", unit_price: unitPrice });
    orderItems.push({ productId: product.id, name: product.name, quantity, unitPrice, options: entry.options || {}, fields: entry.fields || {} });
  }
  if (body.customer?.delivery === "delivery") { const freight = Number(process.env.DELIVERY_FLAT_RATE); if (!Number.isFinite(freight) || freight <= 0) return json({ error: "Entrega ainda não está configurada. Selecione retirada." }, 409); items.push({ id: "freight", title: "Frete", quantity: 1, currency_id: "BRL", unit_price: freight }); }
  const orderId = `WINC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 10).toUpperCase()}`;
  const orderToken = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
  const orderTokenHash = createHash("sha256").update(orderToken).digest("hex");
  const baseUrl = process.env.URL || new URL(req.url).origin;
  const trackingUrl = `${baseUrl}/pedido?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(orderToken)}`;
  const preferenceBody = { items, external_reference: orderId, payer: { name: body.customer?.name, email: body.customer?.email }, back_urls: { success: trackingUrl, pending: trackingUrl, failure: `${baseUrl}/personalizacao?pagamento=falhou` }, auto_return: "approved", notification_url: `${baseUrl}/.netlify/functions/store/webhook`, metadata: { order_id: orderId } };
  const idempotencyKey = randomUUID();
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`, "content-type": "application/json", "x-idempotency-key": idempotencyKey }, body: JSON.stringify(preferenceBody) });
  const preference = await response.json(); if (!response.ok) return json({ error: "Mercado Pago recusou a criação do checkout." }, 502);
  await ordersStore().setJSON(orderId, { id: orderId, accessTokenHash: orderTokenHash, createdAt: new Date().toISOString(), customer: body.customer, items: orderItems, total: items.reduce((s, i) => s + i.quantity * i.unit_price, 0), financialStatus: "awaiting_payment", productionStatus: "awaiting_art", preferenceId: preference.id, delivery: body.customer?.delivery || "pickup" });
  return json({ orderId, initPoint: preference.init_point });
}

async function upload(req) {
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) return json({ error: "Arquivo inválido ou maior que 4 MB." }, 400);
  const allowed = new Map([["image/png", [0x89, 0x50, 0x4e, 0x47]], ["image/jpeg", [0xff, 0xd8, 0xff]], ["application/pdf", [0x25, 0x50, 0x44, 0x46]], ["image/svg+xml", null]]);
  if (!allowed.has(file.type)) return json({ error: "Formato não permitido." }, 415);
  const bytes = new Uint8Array(await file.arrayBuffer()); const magic = allowed.get(file.type);
  if (magic && !magic.every((byte, index) => bytes[index] === byte)) return json({ error: "Conteúdo do arquivo não corresponde ao formato informado." }, 415);
  if (file.type === "image/svg+xml") { const source = new TextDecoder().decode(bytes); if (!/^\s*<svg\b/i.test(source) || /<script|on\w+\s*=|javascript:|https?:\/\//i.test(source)) return json({ error: "SVG contém conteúdo não permitido." }, 415); }
  const uploadId = randomUUID(); await uploadsStore().set(uploadId, bytes, { metadata: { originalName: file.name.slice(0, 120), contentType: file.type, uploadedAt: new Date().toISOString() } }); return json({ uploadId, fileName: file.name });
}

async function webhook(req) {
  const url = new URL(req.url); const dataId = url.searchParams.get("data.id") || (await parseBody(req)).data?.id; const signature = req.headers.get("x-signature"); const requestId = req.headers.get("x-request-id");
  if (!dataId || !process.env.MERCADO_PAGO_WEBHOOK_SECRET || !signature || !requestId) return json({ error: "Notificação incompleta." }, 401);
  try { WebhookSignatureValidator.validate({ xSignature: signature, xRequestId: requestId, dataId: String(dataId), secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET }); } catch { return json({ error: "Assinatura inválida." }, 401); }
  const eventKey = `payment-${dataId}`; if (await eventsStore().get(eventKey)) return json({ ok: true, duplicate: true });
  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` } });
  if (!paymentResponse.ok) return json({ error: "Falha ao confirmar pagamento." }, 502); const payment = await paymentResponse.json();
  const orderId = payment.external_reference || payment.metadata?.order_id; const order = orderId && await ordersStore().get(orderId, { type: "json" }); if (!order) return json({ error: "Pedido não localizado." }, 404);
  const map = { approved: "approved", pending: "in_review", in_process: "in_review", rejected: "rejected", cancelled: "cancelled", refunded: "refunded" };
  order.financialStatus = map[payment.status] || "in_review"; order.paymentId = String(payment.id); order.updatedAt = new Date().toISOString(); await ordersStore().setJSON(orderId, order); await eventsStore().setJSON(eventKey, { receivedAt: new Date().toISOString(), status: payment.status, orderId }); return json({ ok: true });
}

async function admin(req, path) {
  if (!isAdmin(req)) return json({ error: "Não autorizado." }, 401);
  if (path === "/admin/products" && req.method === "GET") return json(await getProducts());
  if (path === "/admin/products" && req.method === "PUT") { const body = await parseBody(req); if (!Array.isArray(body.products)) return json({ error: "Catálogo inválido." }, 400); await productsStore().setJSON("catalog", body.products); return json({ ok: true }); }
  if (path === "/admin/orders" && req.method === "GET") { const { blobs } = await ordersStore().list(); const rows = await Promise.all(blobs.slice(-100).reverse().map((b) => ordersStore().get(b.key, { type: "json" }))); return json(rows); }
  if (path.startsWith("/admin/orders/") && req.method === "PATCH") { const id = decodeURIComponent(path.split("/").pop()); const order = await ordersStore().get(id, { type: "json" }); if (!order) return json({ error: "Pedido não localizado." }, 404); const body = await parseBody(req); if (body.productionStatus) order.productionStatus = body.productionStatus; order.updatedAt = new Date().toISOString(); await ordersStore().setJSON(id, order); return json(order); }
  return json({ error: "Rota administrativa inválida." }, 404);
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace("/.netlify/functions/store", "") || "/";
  try {
    if (path === "/products" && req.method === "GET") return json((await getProducts()).filter((p) => p.active));
    if (path === "/uploads" && req.method === "POST") return upload(req);
    if (path === "/checkout" && req.method === "POST") return createCheckout(req);
    if (path === "/webhook" && req.method === "POST") return webhook(req);
    if (path.startsWith("/admin/")) return admin(req, path);
    if (path.startsWith("/orders/") && req.method === "GET") { const id = decodeURIComponent(path.split("/").pop()); const order = await ordersStore().get(id, { type: "json" }); const provided = new URL(req.url).searchParams.get("token") || ""; const providedHash = createHash("sha256").update(provided).digest("hex"); if (!order || !safeEqual(providedHash, order.accessTokenHash)) return json({ error: "Pedido não localizado ou link inválido." }, 404); return json({ id: order.id, items: order.items, total: order.total, financialStatus: order.financialStatus, productionStatus: order.productionStatus, createdAt: order.createdAt }); }
    return json({ error: "Rota não encontrada." }, 404);
  } catch (error) { console.error("store-function", error?.message); return json({ error: "Erro interno da loja." }, 500); }
};
