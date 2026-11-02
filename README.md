# Winc Agency

> See [portfolio quality notes](docs/portfolio-quality.md) for the business goal, demonstrative targets and accessibility checklist.

Institutional website for Winc Agency, built as a static marketing site with portfolio pages, service briefings, and Netlify-ready deployment.

## Live Site

https://agenciawinc.netlify.app

## Overview

- Home page focused on positioning, growth, and digital performance
- Portfolio and service presentation for agency offerings
- Dedicated briefing pages for landing pages, branding, paid media, WhatsApp automation, SaaS creation, and audiovisual production
- Static SEO structure with canonical tags, structured data, robots.txt, and sitemap support

## Stack

- HTML
- CSS
- JavaScript
- Netlify configuration and security headers

## Key Files

- `index.html`
- `portfolio.html`
- `briefing-landing-pages.html`
- `briefing-identidade-visual.html`
- `briefing-trafego-pago.html`
- `briefing-social-media.html`
- `briefing-automacao-whatsapp.html`
- `briefing-criacao-saas.html`
- `briefing-audiovisual-imagens-aereas.html`
- `styles.css`
- `briefings.js`
- `netlify.toml`

## Deployment

This project is configured for static deployment on Netlify.

## Loja Personalização

- Loja: `/personalizacao`
- Acompanhamento: `/pedido?order=WINC-...`
- Administração: `/admin/personalizacao`
- API: `/.netlify/functions/store/*`

### Variáveis obrigatórias no Netlify

- `MERCADO_PAGO_ACCESS_TOKEN`: credencial de teste ou produção do Checkout Pro.
- `MERCADO_PAGO_WEBHOOK_SECRET`: assinatura secreta configurada em Webhooks.
- `ADMIN_TOKEN`: senha longa e exclusiva para o painel administrativo.
- `DELIVERY_FLAT_RATE` (opcional): valor fixo de entrega; sem ele, apenas retirada é aceita.

Configure as variáveis no painel do Netlify com escopo de Functions. Nunca as grave no repositório. O catálogo e os pedidos usam Netlify Blobs, persistentes entre deploys.

### Webhook Mercado Pago

Configure o evento **Pagamentos** para `https://agenciawinc.netlify.app/.netlify/functions/store/webhook`.

Use credenciais de teste antes de ativar produção. O backend recalcula preços pelo catálogo, usa idempotência na preferência, valida a assinatura do webhook e consulta o pagamento na API antes de atualizar o pedido.
