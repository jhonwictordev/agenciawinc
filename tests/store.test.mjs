import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("catalog has four active configurable products", async () => {
  const products = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url)));
  assert.equal(products.length, 4);
  for (const product of products) {
    assert.ok(product.id && product.name && product.price > 0 && product.stock >= 0);
    assert.ok(Object.keys(product.options).length > 0);
  }
});

test("store page exposes cart, filters and checkout", async () => {
  const html = await readFile(new URL("../personalizacao.html", import.meta.url), "utf8");
  for (const marker of ["product-grid", "cart-drawer", "checkout-form", "max-price"]) assert.match(html, new RegExp(marker));
});

test("backend does not contain production credentials", async () => {
  const source = await readFile(new URL("../netlify/functions/store.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /APP_USR-|TEST-[0-9]/);
  assert.match(source, /MERCADO_PAGO_ACCESS_TOKEN/);
});

test("checkout refuses to run without server credential", async () => {
  const { default: handler } = await import("../netlify/functions/store.mjs");
  const response = await handler(new Request("https://example.test/.netlify/functions/store/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ productId: "camiseta-personalizada", quantity: 1 }] }) }));
  assert.equal(response.status, 503);
});

test("admin and webhook reject unauthenticated requests", async () => {
  const { default: handler } = await import("../netlify/functions/store.mjs");
  const admin = await handler(new Request("https://example.test/.netlify/functions/store/admin/products"));
  const webhook = await handler(new Request("https://example.test/.netlify/functions/store/webhook", { method: "POST", body: "{}" }));
  assert.equal(admin.status, 401);
  assert.equal(webhook.status, 401);
});
