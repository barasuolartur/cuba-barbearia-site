/* ==========================================================
   CUBA BARBEARIA | script.js  (arquivo único)
   PARTE 1: ponto único para o back-end (cadastro, login, agendamento)
   PARTE 2: efeitos visuais e 3D (hero, bolinhas, cards, carrossel)
   PARTE 3: comportamento da página (abertura, rolagem, menu, formulários)
   Cada parte é independente: você pode mover ou apagar uma sem quebrar as outras.
   ========================================================== */

/* ##########################################################
   PARTE 1: API (back-end)
   Hoje as funções só simulam o envio. Quando tiver sua API,
   troque o corpo de cada função por um fetch().
   ########################################################## */
window.CubaAPI = {
  baseUrl: "", // ex.: "https://api.seudominio.com"

  async createBooking(data) {
    // return fetch(`${this.baseUrl}/agendamentos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json());
    console.log("Agendamento (simulado):", data);
    return { ok: true };
  },

  async login(credentials) {
    // return fetch(`${this.baseUrl}/login`, { ... });
    console.log("Login (simulado):", credentials.email);
    return { ok: true };
  },

  async register(data) {
    // Use quando criar o formulário de cadastro.
    console.log("Cadastro (simulado):", data);
    return { ok: true };
  },
};

/* ##########################################################
   PARTE 2: EFEITOS
   1 Movimento 3D do hero · 2 Bolinhas subindo · 3 Inclinação
   dos cards · 4 Carrossel 3D dos serviços (celular)
   ########################################################## */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, m = 1) => Math.max(-m, Math.min(m, v));

  /* 1. MOVIMENTO 3D DO HERO: mouse, giroscópio do celular ou movimento automático */
  function heroMotion() {
    const hero = $(".hero");
    if (!hero || reduce) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, last = 0, onScreen = true, asked = false;
    const aim = (x, y) => { tx = clamp(x); ty = clamp(y); last = performance.now(); };

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      aim(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    });
    hero.addEventListener("pointerleave", () => { last = 0; });
    addEventListener("deviceorientation", (e) => { if (e.gamma != null) aim(e.gamma / 22, (e.beta - 55) / 22); });
    hero.addEventListener("touchend", () => { /* iPhone pede permissão do giroscópio */
      const D = window.DeviceOrientationEvent;
      if (!asked && D && typeof D.requestPermission === "function") { asked = true; D.requestPermission().catch(() => {}); }
    });
    new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; }).observe(hero);

    (function loop(t) {
      if (onScreen) {
        if (t - last > 2500) { tx = Math.sin(t / 2400) * 0.6; ty = Math.cos(t / 3100) * 0.4; } /* vida própria quando ninguém mexe */
        cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
        hero.style.setProperty("--tx", cx.toFixed(3));
        hero.style.setProperty("--ty", cy.toFixed(3));
      }
      requestAnimationFrame(loop);
    })(0);
  }

  /* 2. BOLINHAS SUBINDO em volta da foto (vermelho, branco e azul) */
  function bubbles() {
    const c = $("#bubbles");
    if (!c || reduce) return;
    const ctx = c.getContext("2d");
    const colors = ["255,255,255", "216,36,47", "74,102,255"];
    let w, h, list = [], visible = true;

    const spawn = (anywhere) => ({
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 20,
      r: 2 + Math.random() * 6, v: 0.25 + Math.random() * 0.7,
      ph: Math.random() * 6.28, sway: 0.2 + Math.random() * 0.5,
      o: 0.25 + Math.random() * 0.5, c: colors[(Math.random() * 3) | 0],
    });
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight; c.width = w * d; c.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      list = Array.from({ length: w < 600 ? 34 : 60 }, () => spawn(true));
    };
    (function draw(t) {
      if (visible && !document.hidden) {
        ctx.clearRect(0, 0, w, h);
        list.forEach((p, i) => {
          p.y -= p.v;
          p.x += Math.sin(t / 900 + p.ph) * p.sway;
          if (p.y < -20) list[i] = spawn(false);
          const fade = Math.min(1, Math.max(0, p.y / (h * 0.25))); /* somem perto do topo */
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, 6.283); ctx.fillStyle = `rgba(${p.c},${(p.o * 0.18 * fade).toFixed(3)})`; ctx.fill();
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = `rgba(${p.c},${(p.o * fade).toFixed(3)})`; ctx.fill();
        });
      }
      requestAnimationFrame(draw);
    })(0);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(c);
    addEventListener("resize", resize);
    resize();
  }

  /* 3. INCLINAÇÃO 3D DOS CARDS (computador) */
  function cardTilt() {
    if (reduce || !matchMedia("(hover: hover)").matches) return;
    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
        el.style.setProperty("--rx", `${-(y - 0.5) * 16}deg`);
        el.style.setProperty("--gx", `${x * 100}%`);
        el.style.setProperty("--gy", `${y * 100}%`);
      });
      el.addEventListener("pointerleave", () => ["--rx", "--ry"].forEach((v) => el.style.setProperty(v, "0deg")));
    });
  }

  /* 4. CARROSSEL 3D DOS SERVIÇOS (celular): o card do centro fica de frente, os lados giram */
  function carousel() {
    const box = $(".cards");
    if (!box) return;
    const mobile = matchMedia("(max-width: 899px)");
    const update = () => {
      const mid = box.scrollLeft + box.clientWidth / 2;
      $$(".card", box).forEach((c) => {
        if (!mobile.matches) { c.style.removeProperty("--r"); c.style.removeProperty("--s"); return; }
        const k = clamp((c.offsetLeft + c.offsetWidth / 2 - mid) / c.offsetWidth, 1.4);
        c.style.setProperty("--r", `${-k * 38}deg`);
        c.style.setProperty("--s", (1 - Math.min(Math.abs(k), 1) * 0.14).toFixed(3));
      });
    };
    box.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    addEventListener("resize", update);
    update();
  }

  const init = () => { heroMotion(); bubbles(); cardTilt(); carousel(); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();

/* ##########################################################
   PARTE 3: COMPORTAMENTO DA PÁGINA
   1 Abertura · 2 Rolagem · 3 Aparecer ao rolar · 4 Formulários
   5 Modal · 6 Menu inferior
   ########################################################## */
document.documentElement.classList.add("js");

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function init() {
    /* 1. ABERTURA: some depois de carregar tudo (mínimo 1,7 s) */
    const finish = () => { document.body.classList.add("is-ready"); $("#intro")?.classList.add("is-done"); };
    const go = () => setTimeout(finish, Math.max(0, 1700 - performance.now()));
    document.readyState === "complete" ? go() : addEventListener("load", go);
    setTimeout(finish, 4500); /* segurança */

    /* 2. ROLAGEM: topo sólido, barra de progresso e parallax da cena */
    const header = $("#header"), scene = $("[data-parallax]"), root = document.documentElement;
    const onScroll = () => {
      const y = scrollY;
      header?.classList.toggle("is-solid", y > 40);
      root.style.setProperty("--scroll", (y / Math.max(1, root.scrollHeight - innerHeight)).toFixed(4));
      if (scene && !reduce && y < innerHeight) scene.style.transform = `translateY(${y * 0.18}px)`;
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* 3. APARECER AO ROLAR + CONTADORES */
    const countUp = (el) => {
      const target = +el.dataset.count, t0 = performance.now();
      const step = (now) => {
        const p = Math.min((now - t0) / 1600, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        const n = $("[data-count]", en.target);
        if (n) countUp(n);
        seen.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    $$("[data-reveal]").forEach((el, i) => { el.style.setProperty("--delay", `${(i % 3) * 0.12}s`); seen.observe(el); });

    /* 4. FORMULÁRIOS (usam a PARTE 1, se existir) */
    const api = () => window.CubaAPI || { createBooking: async () => ({ ok: true }), login: async () => ({ ok: true }) };
    const select = $("#campo-servico");
    if (select) select.innerHTML = '<option value="">Escolha um serviço</option>' + $$("#servicos-lista h3").map((h) => `<option>${h.textContent}</option>`).join("");

    const handleForm = (form, msg, action, ok) => form && form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { msg.textContent = "Preencha todos os campos para continuar."; return; }
      msg.textContent = "Enviando...";
      try {
        const res = await action(Object.fromEntries(new FormData(form)));
        msg.textContent = res.ok ? ok : "Não foi possível concluir. Tente novamente.";
        if (res.ok) form.reset();
      } catch { msg.textContent = "Sem conexão. Tente novamente em instantes."; }
    });
    handleForm($("#form-agendamento"), $("#form-msg"), (d) => api().createBooking(d), "Agendamento enviado. Entraremos em contato para confirmar.");
    handleForm($("#form-conta"), $("#conta-msg"), (d) => api().login(d), "Login realizado.");

    /* 5. MODAL */
    const closeModal = (m) => { m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); };
    $$("[data-open]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      const m = $("#" + b.dataset.open);
      if (!m) return;
      m.classList.add("is-open"); m.setAttribute("aria-hidden", "false"); setTimeout(() => $("input", m)?.focus(), 300);
    }));
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m || e.target.hasAttribute("data-close")) closeModal(m); }));
    addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".modal.is-open").forEach(closeModal); });

    /* 6. MENU INFERIOR: marca a seção que está na tela */
    const links = $$("#dock a[href^='#']");
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id && !a.classList.contains("dock__main")));
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    ["inicio", "servicos", "sobre", "agendamento"].forEach((id) => { const s = $("#" + id); if (s) spy.observe(s); });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();