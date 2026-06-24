const BRIEFING_CONFIG = {
  landing_pages: {
    prefix: "LP",
    tag: "#BriefingLPWinc",
    title: "Landing Pages e Funis",
    formName: "briefing-landing-pages",
    companyField: "empresa_nome",
    contactField: "telefone_whatsapp",
  },
  identidade_visual: {
    prefix: "ID",
    tag: "#BriefingMarcaWinc",
    title: "Posicionamento e Identidade Visual",
    formName: "briefing-identidade-visual",
    companyField: "empresa_nome",
    contactField: "instagram_site",
  },
  trafego_pago: {
    prefix: "TG",
    tag: "#BriefingTrafegoWinc",
    title: "Gestao de Trafego Pago",
    formName: "briefing-trafego-pago",
    companyField: "empresa_nome",
    contactField: "telefone_whatsapp_responsavel",
  },
  social_media: {
    prefix: "SM",
    tag: "#BriefingSocialWinc",
    title: "Conteudo e Social Media",
    formName: "briefing-social-media",
    companyField: "empresa_nome",
    contactField: "telefone_whatsapp_responsavel",
  },
  automacao_whatsapp: {
    prefix: "AW",
    tag: "#BriefingWhatsAppWinc",
    title: "Automacao no WhatsApp",
    formName: "briefing-automacao-whatsapp",
    companyField: "empresa_nome",
    contactField: "telefone_whatsapp_responsavel",
  },
  criacao_saas: {
    prefix: "SA",
    tag: "#BriefingSaaSWinc",
    title: "Criacao de SaaS",
    formName: "briefing-criacao-saas",
    companyField: "nome_projeto",
    contactField: "telefone_whatsapp_responsavel",
  },
  audiovisual_imagens_aereas: {
    prefix: "AV",
    tag: "#BriefingAudiovisualWinc",
    title: "Producao Audiovisual e Imagens Aereas",
    formName: "briefing-audiovisual-imagens-aereas",
    companyField: "empresa_nome",
    contactField: "telefone_whatsapp_responsavel",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-briefing-form]").forEach(initBriefingForm);
});

function initBriefingForm(form) {
  const type = form.dataset.briefingForm;
  const config = BRIEFING_CONFIG[type];

  if (!config) {
    return;
  }

  const statusBox = form.querySelector(".briefing-status");
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === "true" || !form.reportValidity()) {
      return;
    }

    const protocol = createProtocol(config.prefix);
    const receivedAt = formatTimestamp(new Date());

    setFieldValue(form, "form-name", config.formName);
    setFieldValue(form, "briefing_protocolo", protocol);
    setFieldValue(form, "briefing_tag", config.tag);
    setFieldValue(form, "briefing_titulo", config.title);
    setFieldValue(form, "briefing_recebido_em", receivedAt);
    setFieldValue(form, "briefing_origem", window.location.href);

    const whatsappUrl = buildWhatsAppUrl(form, config, protocol);

    setSubmittingState(form, submitButton, true);
    showPendingStatus(statusBox);

    try {
      const formData = new FormData(form);
      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(formData).toString(),
      });

      if (!response.ok) {
        throw new Error(`Netlify Forms respondeu com status ${response.status}`);
      }

      form.reset();
      clearRuntimeFields(form);
      showSuccessStatus(statusBox, protocol, whatsappUrl, config.tag);
      openWhatsApp(whatsappUrl);
    } catch (error) {
      console.error(error);
      showErrorStatus(statusBox);
    } finally {
      setSubmittingState(form, submitButton, false);
    }
  });
}

function buildWhatsAppUrl(form, config, protocol) {
  const company = getFirstFieldValue(form, config.companyField) || "Nao informado";
  const phone = form.dataset.whatsapp || "558291875154";
  const lines = [
    "*Novo briefing recebido*",
    `Tag: ${config.tag}`,
    `Servico: ${config.title}`,
    `Protocolo: ${protocol}`,
    `Empresa: ${company}`,
  ];

  if (config.contactField) {
    const contact = getFirstFieldValue(form, config.contactField);
    if (contact) {
      lines.push(`Contato-base: ${contact}`);
    }
  }

  lines.push(
    "",
    "O conteudo completo foi salvo com seguranca no painel de formularios da Agencia Winc.",
  );

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function getFirstFieldValue(form, name) {
  const fields = Array.from(form.querySelectorAll(`[name="${name}"]`));

  if (!fields.length) {
    return "";
  }

  const first = fields[0];

  if (first.type === "radio") {
    return fields.find((field) => field.checked)?.value.trim() || "";
  }

  if (first.type === "checkbox") {
    return fields
      .filter((field) => field.checked)
      .map((field) => field.value.trim())
      .join(", ");
  }

  return first.value.trim();
}

function setFieldValue(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);

  if (field) {
    field.value = value;
  }
}

function clearRuntimeFields(form) {
  ["briefing_protocolo", "briefing_tag", "briefing_titulo", "briefing_recebido_em", "briefing_origem"].forEach((name) => {
    setFieldValue(form, name, "");
  });
}

function setSubmittingState(form, submitButton, isSubmitting) {
  form.dataset.submitting = isSubmitting ? "true" : "false";

  if (!submitButton) {
    return;
  }

  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Enviando com seguranca..." : "Enviar briefing e abrir WhatsApp";
}

function showPendingStatus(statusBox) {
  if (!statusBox) {
    return;
  }

  renderStatus(statusBox, "pending", [
    { tag: "strong", text: "Enviando briefing com seguranca..." },
    {
      tag: "p",
      text: "Estamos registrando os dados no Netlify Forms antes de abrir o WhatsApp com um resumo curto.",
    },
  ]);
}

function showSuccessStatus(statusBox, protocol, whatsappUrl, tag) {
  if (!statusBox) {
    return;
  }

  renderStatus(statusBox, "success", [
    { tag: "strong", text: "Briefing enviado com seguranca." },
    {
      tag: "p",
      text: `Protocolo gerado: ${protocol}. O envio completo foi salvo no painel do Netlify Forms e o WhatsApp foi aberto apenas com um resumo de atendimento (${tag}).`,
    },
    {
      tag: "div",
      className: "briefing-status-actions",
      children: [
        {
          tag: "a",
          text: "Abrir WhatsApp novamente",
          attrs: {
            href: whatsappUrl,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
      ],
    },
  ]);
}

function showErrorStatus(statusBox) {
  if (!statusBox) {
    return;
  }

  renderStatus(statusBox, "error", [
    { tag: "strong", text: "Nao foi possivel concluir o envio." },
    {
      tag: "p",
      text: "Tente novamente em alguns segundos. O WhatsApp so sera aberto depois que o briefing for salvo com sucesso.",
    },
  ]);
}

function renderStatus(statusBox, state, nodes) {
  statusBox.replaceChildren();
  statusBox.classList.add("is-visible");
  statusBox.classList.remove("is-pending", "is-success", "is-error");
  statusBox.classList.add(`is-${state}`);

  nodes.forEach((definition) => {
    const element = document.createElement(definition.tag);

    if (definition.className) {
      element.className = definition.className;
    }

    if (definition.text) {
      element.textContent = definition.text;
    }

    if (definition.attrs) {
      Object.entries(definition.attrs).forEach(([name, value]) => {
        element.setAttribute(name, value);
      });
    }

    if (definition.children) {
      definition.children.forEach((childDefinition) => {
        const child = document.createElement(childDefinition.tag);
        child.textContent = childDefinition.text || "";

        if (childDefinition.attrs) {
          Object.entries(childDefinition.attrs).forEach(([name, value]) => {
            child.setAttribute(name, value);
          });
        }

        element.appendChild(child);
      });
    }

    statusBox.appendChild(element);
  });

  statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function openWhatsApp(whatsappUrl) {
  const popup = window.open(whatsappUrl, "_blank", "noopener");

  if (!popup) {
    window.location.href = whatsappUrl;
  }
}

function createProtocol(prefix) {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ];

  return `${prefix}-${parts.join("")}`;
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function pad(value) {
  return String(value).padStart(2, "0");
}
