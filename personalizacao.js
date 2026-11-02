const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const CART_KEY = "winc-personalizacao-cart-v1";
let products = [];
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const saveCart = () => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); renderCart(); };
const notify = (message) => { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2200); };

async function loadProducts() {
  try {
    const response = await fetch("/.netlify/functions/store/products");
    if (!response.ok) throw new Error();
    products = await response.json();
  } catch {
    products = await fetch("/data/products.json").then((r) => r.json());
  }
  renderProducts(); renderCart();
}

function filteredProducts() {
  const term = $("#search").value.trim().toLowerCase();
  const category = $("#category").value;
  const max = Number($("#max-price").value);
  const sorted = products.filter((p) => p.active && p.name.toLowerCase().includes(term) && (!category || p.category === category) && p.price <= max);
  if ($("#sort").value === "asc") sorted.sort((a, b) => a.price - b.price);
  if ($("#sort").value === "desc") sorted.sort((a, b) => b.price - a.price);
  return sorted;
}

function renderProducts() {
  const list = filteredProducts();
  $("#product-grid").innerHTML = list.length ? list.map((p) => `<article class="product-card"><div class="product-media"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy"></div><div class="product-copy"><small>${escapeHtml(p.category)}</small><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-price"><strong>${money.format(p.price)}</strong><span>a partir de</span></div><div class="product-actions"><button type="button" data-customize="${p.id}">Personalizar</button><button type="button" class="add" data-add="${p.id}">Adicionar</button></div></div></article>`).join("") : `<p class="cart-empty">Nenhum produto encontrado.</p>`;
}

function optionFields(product) {
  const selects = Object.entries(product.options || {}).map(([name, values]) => `<label>${escapeHtml(name)}<select name="option:${escapeHtml(name)}" required>${values.map((v) => `<option>${escapeHtml(v)}</option>`).join("")}</select></label>`).join("");
  const fields = (product.fields || []).map((name) => `<label class="${name === "Observações" ? "wide" : ""}">${escapeHtml(name)}<${name === "Observações" ? "textarea" : "input"} name="field:${escapeHtml(name)}" ${name === "Observações" ? "></textarea>" : ">"}</label>`).join("");
  return selects + fields;
}

function openProduct(id) {
  const p = products.find((item) => item.id === id); if (!p) return;
  $("#product-detail").innerHTML = `<div class="detail-grid"><img class="detail-image" src="${p.image}" alt="${escapeHtml(p.name)}"><div class="detail-copy"><span class="section-label">${escapeHtml(p.category)}</span><h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(p.description)}</p><div class="custom-grid">${optionFields(p)}<label>Quantidade<input name="quantity" type="number" min="1" max="${p.stock}" value="1" required></label><label class="wide"><span><input name="artCreationRequested" type="checkbox"> Quero que a Winc crie a arte (+${money.format(p.artCreationFee || 0)})</span></label><label class="wide file-drop">Enviar arte (PNG, JPG, PDF ou SVG — até 4 MB)<input name="art" type="file" accept=".png,.jpg,.jpeg,.pdf,.svg"></label></div><div class="detail-total"><span>Total estimado</span><strong data-total>${money.format(p.price)}</strong></div><button class="button button-primary" type="submit">Adicionar ao carrinho</button><p>Produção estimada: ${p.productionDays} dias úteis após aprovação da arte.</p></div></div>`;
  $("#product-form").dataset.product = id; $("#product-dialog").showModal();
  const updateTotal = () => { const quantity = Math.max(1, Number($("#product-form [name=quantity]").value)); const fee = $("#product-form [name=artCreationRequested]").checked ? Number(p.artCreationFee || 0) : 0; $("[data-total]").textContent = money.format((p.price + fee) * quantity); }; $("#product-form [name=quantity]").addEventListener("input", updateTotal); $("#product-form [name=artCreationRequested]").addEventListener("change", updateTotal);
}

function addDefault(id) { const p = products.find((item) => item.id === id); if (!p) return; addToCart(p, 1, {}, {}, null); }
function addToCart(product, quantity, options, fields, file) {
  const signature = JSON.stringify({ id: product.id, options, fields });
  const existing = cart.find((item) => item.signature === signature);
  if (existing) existing.quantity = Math.min(product.stock, existing.quantity + quantity);
  else cart.push({ key: crypto.randomUUID(), signature, productId: product.id, name: product.name, image: product.image, unitPrice: product.price, quantity, options, fields, fileName: file?.name || null });
  saveCart(); notify("Produto adicionado ao carrinho");
}

function renderCart() {
  $("#cart-count").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  $("#cart-items").innerHTML = cart.length ? cart.map((item) => `<article class="cart-item"><img src="${item.image}" alt=""><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(Object.values(item.options).join(" · "))}${item.fileName ? ` · ${escapeHtml(item.fileName)}` : ""}</p><input type="number" min="1" value="${item.quantity}" data-quantity="${item.key}" aria-label="Quantidade"></div><button type="button" data-remove="${item.key}" aria-label="Remover">Remover</button></article>`).join("") : `<p class="cart-empty">Seu carrinho está vazio.</p>`;
  $("#cart-subtotal").textContent = money.format(cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
}

function toggleCart(open) { $("#cart-drawer").classList.toggle("open", open); $("#drawer-backdrop").classList.toggle("open", open); $("#cart-drawer").setAttribute("aria-hidden", String(!open)); }

document.addEventListener("click", (event) => {
  const customize = event.target.closest("[data-customize]"); const add = event.target.closest("[data-add]"); const remove = event.target.closest("[data-remove]");
  if (customize) openProduct(customize.dataset.customize); if (add) addDefault(add.dataset.add);
  if (remove) { cart = cart.filter((item) => item.key !== remove.dataset.remove); saveCart(); }
});
$("#filters").addEventListener("input", () => { $("#price-output").textContent = money.format(Number($("#max-price").value)); renderProducts(); });
$("#product-form").addEventListener("submit", async (event) => { event.preventDefault(); const submit = event.submitter; submit.disabled = true; const base = products.find((item) => item.id === event.currentTarget.dataset.product); const data = new FormData(event.currentTarget); const options = {}, fields = { artCreationRequested: data.get("artCreationRequested") === "on" }; for (const [key, value] of data) { if (key.startsWith("option:")) options[key.slice(7)] = value; if (key.startsWith("field:")) fields[key.slice(6)] = value; } const file = data.get("art"); try { if (file?.size) { const uploadData = new FormData(); uploadData.append("file", file); const response = await fetch("/.netlify/functions/store/uploads", { method: "POST", body: uploadData }); const uploaded = await response.json(); if (!response.ok) throw new Error(uploaded.error); fields.uploadId = uploaded.uploadId; } const p = { ...base, price: base.price + (fields.artCreationRequested ? Number(base.artCreationFee || 0) : 0) }; addToCart(p, Number(data.get("quantity")), options, fields, file); $("#product-dialog").close(); toggleCart(true); } catch (error) { notify(error.message || "Não foi possível enviar a arte"); } finally { submit.disabled = false; } });
$("#cart-items").addEventListener("change", (event) => { if (!event.target.matches("[data-quantity]")) return; const item = cart.find((entry) => entry.key === event.target.dataset.quantity); if (item) { item.quantity = Math.max(1, Number(event.target.value)); saveCart(); } });
$("#cart-trigger").onclick = () => toggleCart(true); $("#cart-close").onclick = $("#drawer-backdrop").onclick = () => toggleCart(false);
$("#checkout-trigger").onclick = () => { if (!cart.length) return notify("Adicione um produto primeiro"); toggleCart(false); $("#checkout-dialog").showModal(); };
document.querySelector("[data-close-checkout]").onclick = () => $("#checkout-dialog").close();
$("#checkout-form").addEventListener("submit", async (event) => { event.preventDefault(); const status = $("#checkout-status"); status.textContent = "Validando pedido…"; const customer = Object.fromEntries(new FormData(event.currentTarget)); try { const response = await fetch("/.netlify/functions/store/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer, items: cart.map(({ productId, quantity, options, fields }) => ({ productId, quantity, options, fields })) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível iniciar o pagamento."); if (result.initPoint) { localStorage.removeItem(CART_KEY); location.href = result.initPoint; } } catch (error) { status.textContent = error.message; } });
loadProducts();
