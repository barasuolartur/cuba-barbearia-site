/* ==========================================================
   CUBA BARBEARIA | sessao.js
   Tudo da conta do cliente DENTRO da página inicial (sem outra página):
   1 Login pelo modal "Entrar" (Supabase) e abertura automática do painel
   2 Painel "Minha conta": foto, dados, próximo horário, listas e histórico
   3 Botão da conta (foto + nome) no topo e no menu do celular
   4 Agendamento rápido: preenche nome e telefone e salva em "agendamentos"
   Se a biblioteca do Supabase não estiver no HTML, carrega sozinho.
   ========================================================== */
const SESSAO_CONFIG = {
  SUPABASE_URL: "https://ororwuqtbehkwjqvlovf.supabase.co",
  SUPABASE_KEY: "sb_publishable_c_g-gaQr8CYTW0Y2OB5Zyw_2YnWof31",       // cole a chave publishable (ou anon) entre aspas
  BUCKET_FOTOS: "avatares",
   PAGINA_PAINEL: "pages/painel.html",
  HORARIOS: { inicio: 9, fim: 20 },        // atendimento das 9h às 20h, de 30 em 30 minutos
  BIBLIOTECA: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
};

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const C = SESSAO_CONFIG;
  const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const ROTULO = { pendente: "Aguardando", confirmado: "Confirmado", cancelado: "Cancelado", concluido: "Concluído" };

  /* ---------- utilidades ---------- */
  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no horário local
  const agoraChave = () => `${hoje()}T${new Date().toTimeString().slice(0, 5)}`;
  const chaveDe = (a) => `${a.data}T${a.horario.slice(0, 5)}`;
  const primeiroNome = (n) => (n || "Cliente").trim().split(/\s+/)[0];
  const iniciais = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const semana = (data) => { const [y, m, d] = data.split("-"); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" }); };
  const formatarTel = (v) => {
    const d = (v || "").replace(/\D/g, "").slice(0, 11);
    return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  };
  const aviso = (sel, texto) => setTimeout(() => { const e = $(sel); if (e) e.textContent = texto; }, 0); // depois do texto padrão do main.js
  const carregarBiblioteca = () => window.supabase ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement("script"); s.src = C.BIBLIOTECA; s.onload = ok; s.onerror = falha; document.head.appendChild(s);
  });
  const fecharModal = (m) => { m?.classList.remove("is-open"); m?.setAttribute("aria-hidden", "true"); };

  function avatar(p, extra = "") {
    if (p?.avatar_url) return Object.assign(el("img", `av ${extra}`), { src: p.avatar_url, alt: "" });
    return el("span", `av ${extra}`, iniciais(p?.nome));
  }

  async function init() {
    if (C.SUPABASE_KEY.trim().includes("SUA_CHAVE") || C.SUPABASE_KEY.trim().length < 20) {
      console.error("sessao.js: a chave do Supabase ainda não foi colocada. Cole sua chave pública em SESSAO_CONFIG.SUPABASE_KEY (js/sessao.js)."); return;
    }
    try { await carregarBiblioteca(); } catch { console.error("sessao.js: não foi possível carregar a biblioteca do Supabase (internet ou bloqueador de anúncios)."); return; }

    // Abre o painel sozinho quando a pessoa acabou de entrar (login em outra página ou link do e-mail)
    let abrirAoEntrar = location.hash === "#conta" || location.hash.includes("access_token");
    const db = window.supabase.createClient(C.SUPABASE_URL.trim(), C.SUPABASE_KEY.trim());
    let user = null, perfil = null, ultimoId = null;

    /* ==========================================================
       PAINEL "MINHA CONTA"
       ========================================================== */
    const painel = el("div", "cp"); painel.id = "cp"; painel.setAttribute("aria-hidden", "true");
    painel.innerHTML = `
      <aside class="cp__box" role="dialog" aria-modal="true" aria-label="Minha conta">
        <button class="cp__fechar" type="button" data-fechar aria-label="Fechar">&times;</button>
        <header class="cp__perfil">
          <label class="cp__foto" title="Trocar foto">
            <span class="cp__anel"><span id="cp-avatar"></span></span>
            <input id="cp-arq" type="file" accept="image/*" hidden>
            <em>Trocar foto</em>
          </label>
          <div><p id="cp-saudacao"></p><h2 id="cp-nome"></h2><p class="cp__email" id="cp-email"></p></div>
          <p class="cp__msg" id="cp-msg-foto" role="status"></p>
        </header>
        <div class="cp__stats">
          <div><b id="cp-st-proximo">-</b><span>Próximo</span></div>
          <div><b id="cp-st-total">-</b><span>Agendamentos</span></div>
          <div><b id="cp-st-visitas">-</b><span>Visitas</span></div>
        </div>
        <section class="cp__proximo"><p class="cp__rotulo">Seu próximo horário</p><div id="cp-proximo">Carregando...</div></section>
        <a class="btn" href="#agendamento" data-fechar>Novo agendamento</a>
        <section><h3 class="cp__titulo">Próximos agendamentos</h3><ul class="cp__lista" id="cp-proximos"></ul></section>
        <section><h3 class="cp__titulo">Histórico</h3><ul class="cp__lista" id="cp-historico"></ul></section>
        <section>
          <h3 class="cp__titulo">Meus dados</h3>
          <form id="cp-form" novalidate>
            <label>Nome completo<input id="cp-f-nome" type="text" autocomplete="name" required></label>
            <label>WhatsApp<input id="cp-f-tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(61) 99999-9999"></label>
            <button class="btn btn--ghost" type="submit" id="cp-salvar">Salvar dados</button>
            <p class="cp__msg" id="cp-msg-dados" role="status"></p>
          </form>
        </section>
        <button class="btn btn--ghost" type="button" data-sair>Sair da conta</button>
      </aside>`;
    document.body.appendChild(painel);

    const abrirPainel = () => {
       if (C.PAGINA_PAINEL) { location.href = C.PAGINA_PAINEL; return; }
      desenharPainel(); carregarAgendamentos();
      painel.classList.add("is-open"); painel.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("cp-aberto");
    };
    const fecharPainel = () => {
      painel.classList.remove("is-open"); painel.setAttribute("aria-hidden", "true"); document.documentElement.classList.remove("cp-aberto");
    };
    painel.addEventListener("click", (e) => { if (e.target === painel || e.target.closest("[data-fechar]")) fecharPainel(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPainel(); });
    $("[data-sair]", painel).addEventListener("click", async () => { await db.auth.signOut(); });

    function desenharPainel() {
      $("#cp-avatar").replaceChildren(avatar(perfil, "cp__av"));
      const h = new Date().getHours();
      $("#cp-saudacao").textContent = `${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"},`;
      $("#cp-nome").textContent = primeiroNome(perfil.nome);
      $("#cp-email").textContent = user.email;
      $("#cp-f-nome").value = perfil.nome; $("#cp-f-tel").value = formatarTel(perfil.telefone);
    }

    /* ---------- agendamentos do cliente ---------- */
    function botaoCancelar(a) {
      const b = el("button", "cp__cancelar", "Cancelar"); b.type = "button";
      b.addEventListener("click", async () => {
        if (!confirm("Cancelar este agendamento?")) return;
        b.disabled = true;
        const { data, error } = await db.from("agendamentos").update({ status: "cancelado" }).eq("id", a.id).select("id");
        if (error || !data?.length) { console.error(error); alert("Não foi possível cancelar. Tente novamente."); b.disabled = false; return; }
        carregarAgendamentos();
      });
      return b;
    }
    function itemLista(a, podeCancelar) {
      const li = el("li", "cp__item"); li.dataset.status = a.status;
      const [, m, d] = a.data.split("-");
      const data = el("div", "cp__data"); data.append(el("b", "", d), el("span", "", MESES[+m - 1]));
      const corpo = el("div", "cp__corpo"); corpo.append(el("strong", "", a.servico), el("span", "", `${a.horario.slice(0, 5)} · ${semana(a.data)}`));
      const chip = el("span", "chip", ROTULO[a.status] || a.status); chip.dataset.status = a.status;
      li.append(data, corpo, chip);
      if (podeCancelar) li.append(botaoCancelar(a));
      return li;
    }
    const vazio = (ul, texto) => ul.replaceChildren(el("li", "cp__vazio", texto));

    async function carregarAgendamentos() {
      const { data, error } = await db.from("agendamentos").select("id,servico,data,horario,status").order("data").order("horario");
      const prox = $("#cp-proximo"), lp = $("#cp-proximos"), lh = $("#cp-historico");
      if (error) {
        console.error(error);
        prox.textContent = "Não foi possível carregar seus agendamentos.";
        vazio(lp, "Sem dados no momento."); vazio(lh, "Sem dados no momento."); return;
      }
      const agora = agoraChave();
      const futuros = data.filter((a) => a.status !== "cancelado" && chaveDe(a) >= agora);
      const historico = data.filter((a) => !futuros.includes(a)).reverse();

      $("#cp-st-proximo").textContent = futuros[0] ? futuros[0].data.split("-").reverse().slice(0, 2).join("/") : "-";
      $("#cp-st-total").textContent = data.filter((a) => a.status !== "cancelado").length;
      $("#cp-st-visitas").textContent = historico.filter((a) => a.status !== "cancelado").length;

      prox.replaceChildren();
      const p = futuros[0];
      if (p) {
        const [, m, d] = p.data.split("-");
        const corpo = el("div", "cp__proxcorpo"), dia = el("div", "cp__dia"), info = el("div", "cp__proxinfo");
        dia.append(el("b", "", d), el("span", "", MESES[+m - 1]));
        const chip = el("span", "chip", ROTULO[p.status] || p.status); chip.dataset.status = p.status;
        info.append(el("strong", "", p.servico), el("span", "", `${semana(p.data)}, às ${p.horario.slice(0, 5)}`), chip);
        corpo.append(dia, info); prox.append(corpo, botaoCancelar(p));
      } else {
        prox.append(el("p", "cp__vazio", "Você ainda não tem horário marcado. Que tal reservar o seu corte?"));
      }
      lp.replaceChildren(...futuros.slice(1).map((a) => itemLista(a, true)));
      if (futuros.length < 2) vazio(lp, futuros.length ? "Nenhum outro horário marcado." : "Nenhum horário marcado.");
      lh.replaceChildren(...historico.map((a) => itemLista(a, false)));
      if (!historico.length) vazio(lh, "Seu histórico aparece aqui depois do primeiro atendimento.");
    }

    /* ---------- editar dados ---------- */
    const tel = $("#cp-f-tel");
    tel.addEventListener("input", () => { tel.value = formatarTel(tel.value); });
    $("#cp-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#cp-msg-dados"), btn = $("#cp-salvar"), nome = $("#cp-f-nome").value.trim(), digitos = tel.value.replace(/\D/g, "");
      if (nome.split(/\s+/).length < 2) { msg.textContent = "Digite nome e sobrenome."; return; }
      if (digitos && digitos.length < 10) { msg.textContent = "Digite um telefone válido com DDD."; return; }
      btn.disabled = true; msg.textContent = "Salvando...";
      const { data, error } = await db.from("perfis").update({ nome, telefone: digitos }).eq("id", user.id).select("id");
      btn.disabled = false;
      if (error || !data?.length) { console.error(error); msg.textContent = "Não foi possível salvar. Tente novamente."; return; }
      perfil.nome = nome; perfil.telefone = digitos; msg.textContent = "Dados salvos.";
      desenharPainel(); desenharConta(); prepararForm(true);
    });

    /* ---------- trocar foto ---------- */
    const arquivo = $("#cp-arq"), msgFoto = $("#cp-msg-foto");
    arquivo.addEventListener("change", async () => {
      const f = arquivo.files[0]; arquivo.value = "";
      if (!f || !user) return;
      if (!f.type.startsWith("image/") || f.size > 3 * 1024 * 1024) { msgFoto.textContent = "Escolha uma imagem de até 3 MB."; return; }
      msgFoto.textContent = "Enviando foto...";
      const caminho = `${user.id}/avatar`;
      const up = await db.storage.from(C.BUCKET_FOTOS).upload(caminho, f, { upsert: true, contentType: f.type });
      if (up.error) { console.error(up.error); msgFoto.textContent = "Não foi possível enviar a foto."; return; }
      const url = `${db.storage.from(C.BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`;
      const r = await db.from("perfis").update({ avatar_url: url }).eq("id", user.id);
      if (r.error) { console.error(r.error); msgFoto.textContent = "A foto subiu, mas não foi salva no perfil."; return; }
      perfil.avatar_url = url; msgFoto.textContent = "Foto atualizada."; desenharPainel(); desenharConta();
    });

    /* ==========================================================
       BOTÕES DO SITE (visitante x logado)
       ========================================================== */
    const ESCONDER = 'a[href$="cadastro.html"], .hero__login, .cta, [data-open="modal-conta"]';

    function desenharConta() {
      $$(".conta-chip, .conta-dock").forEach((e) => e.remove());
      const nav = $(".nav");
      if (nav) {
        const b = el("button", "conta-chip"); b.type = "button";
        b.append(avatar(perfil), el("span", "", primeiroNome(perfil.nome))); b.addEventListener("click", abrirPainel); nav.append(b);
      }
      const dock = $("#dock");
      if (dock) {
        const b = el("button", "conta-dock"); b.type = "button"; b.setAttribute("aria-label", "Minha conta");
        b.append(avatar(perfil), document.createTextNode("Conta")); b.addEventListener("click", abrirPainel); dock.append(b);
      }
    }
    function limpar() {
      $$("[data-sessao]").forEach((e) => { e.hidden = false; delete e.dataset.sessao; });
      $$(".conta-chip, .conta-dock, .agenda__ola").forEach((e) => e.remove());
      fecharPainel();
    }

    /* ==========================================================
       AGENDAMENTO RÁPIDO
       ========================================================== */
    function prepararForm(logado) {
      const form = $("#form-agendamento");
      if (!form) return;
      if (!form.horario) { // campo de horário (criado aqui para você não precisar mexer no HTML)
        const l = el("label"), s = el("select");
        l.append("Horário"); s.name = "horario"; s.required = true; s.add(new Option("Escolha um horário", ""));
        for (let m = C.HORARIOS.inicio * 60; m < C.HORARIOS.fim * 60; m += 30) {
          const h = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          s.add(new Option(h, h));
        }
        l.append(s); form.insertBefore(l, $("button[type=submit]", form));
        form.addEventListener("reset", () => setTimeout(() => prepararForm(!!user), 0)); // refaz o preenchimento após enviar
      }
      form.data.min = hoje();
      $(".agenda__ola", form)?.remove();
      ["nome", "telefone"].forEach((n) => {
        const valor = logado ? (perfil[n] || "") : "";
        if (logado) form[n].value = valor;
        form[n].closest("label").hidden = logado && !!valor; // esconde só se já temos o dado
      });
      if (logado) {
        const p = el("p", "agenda__ola"); p.append("Agendando como ", el("strong", "", perfil.nome || user.email)); form.prepend(p);
      }
    }

    /* ==========================================================
       SESSÃO
       ========================================================== */
    async function carregarPerfil() {
      let { data, error } = await db.from("perfis").select("nome,telefone,avatar_url").eq("id", user.id).maybeSingle();
      if (error) ({ data } = await db.from("perfis").select("nome,telefone").eq("id", user.id).maybeSingle()); // coluna avatar_url ainda não existe
      const m = user.user_metadata || {};
      return { nome: data?.nome || m.nome || "", telefone: data?.telefone || m.telefone || "", avatar_url: data?.avatar_url || null };
    }
    async function atualizar() {
      limpar();
      if (!user) { prepararForm(false); return; }
      perfil = await carregarPerfil();
      $$(ESCONDER).forEach((e) => { e.hidden = true; e.dataset.sessao = "1"; });
      desenharConta(); prepararForm(true);
      if (abrirAoEntrar) { abrirAoEntrar = false; history.replaceState(null, "", location.pathname + location.search); abrirPainel(); }
    }
    db.auth.onAuthStateChange((_evento, sessao) => {
      const id = sessao?.user?.id || null;
      if (id === ultimoId) return; // ignora renovações de token e foco da aba
      ultimoId = id; user = sessao?.user || null; setTimeout(atualizar, 0);
    });

    /* ==========================================================
       LOGIN E AGENDAMENTO DE VERDADE (substituem os de teste do script.js)
       ========================================================== */
    window.CubaAPI = Object.assign(window.CubaAPI || {}, {
      async login(d) {
        const { error } = await db.auth.signInWithPassword({ email: String(d.email || "").trim().toLowerCase(), password: d.senha });
        if (error) {
          console.error(error);
          aviso("#conta-msg",
            error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." :
            /not confirmed/i.test(error.message) ? "Confirme seu e-mail antes de entrar." :
            "E-mail ou senha incorretos.");
          return { ok: false };
        }
        abrirAoEntrar = true; // o painel abre assim que o perfil carregar
        fecharModal($("#modal-conta"));
        return { ok: true };
      },

      async createBooking(d) {
        if (!user) {
          aviso("#form-msg", "Entre na sua conta para agendar.");
          $('[data-open="modal-conta"]')?.click();
          return { ok: false };
        }
        const { error } = await db.from("agendamentos").insert({
          user_id: user.id, nome: d.nome, telefone: d.telefone, servico: d.servico, data: d.data, horario: d.horario,
        });
        if (error) {
          console.error(error);
          aviso("#form-msg", error.code === "23505" ? "Esse horário já foi reservado. Escolha outro." : "Não foi possível agendar. Tente novamente.");
          return { ok: false };
        }
        aviso("#form-msg", "Agendamento enviado! Veja os detalhes em Minha conta (clique na sua foto).");
        return { ok: true };
      },
    });

    console.info("sessao.js: ativo.");
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();