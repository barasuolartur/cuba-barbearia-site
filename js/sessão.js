/* ==========================================================
   CUBA BARBEARIA | sessao.js
   Conta do cliente na página inicial:
   1 mostra foto e nome depois do login (com menu da conta)
   2 faz o login do modal "Entrar" de verdade (Supabase)
   3 agendamento rápido: preenche nome e telefone sozinho e
     salva na tabela "agendamentos"
   Precisa da biblioteca @supabase/supabase-js carregada antes.
   ========================================================== */
const SESSAO_CONFIG = {
  SUPABASE_URL: "https://ororwuqtbehkwjqvlovf.supabase.co",
  SUPABASE_KEY: "sb_publishable_c_g-gaQr8CYTW0Y2OB5Zyw_2YnWof31",       // a mesma chave publishable (ou anon) do cadastro.js
  BUCKET_FOTOS: "avatares",
  HORARIOS: { inicio: 9, fim: 20 },        // atendimento das 9h às 20h, de 30 em 30 minutos
  BIBLIOTECA: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
};

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const C = SESSAO_CONFIG;

  // Se a biblioteca do Supabase não estiver ligada no HTML, carrega sozinho
  const carregarBiblioteca = () => window.supabase ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = C.BIBLIOTECA; s.onload = ok; s.onerror = falha; document.head.appendChild(s);
  });

  async function init() {
    if (C.SUPABASE_KEY.trim().includes("SUA_CHAVE") || C.SUPABASE_KEY.trim().length < 20) {
      console.error("sessao.js: a chave do Supabase ainda não foi colocada. Cole sua chave pública em SESSAO_CONFIG.SUPABASE_KEY (js/sessao.js)."); return;
    }
    try { await carregarBiblioteca(); } catch { console.error("sessao.js: não foi possível carregar a biblioteca do Supabase (internet ou bloqueador de anúncios)."); return; }
    console.info("sessao.js: ativo.");

    const db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
    let user = null, perfil = null;

    /* ---------- utilidades ---------- */
    const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no horário local
    const primeiroNome = (n) => (n || "Cliente").trim().split(/\s+/)[0];
    const iniciais = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    const aviso = (sel, texto) => setTimeout(() => { const el = $(sel); if (el) el.textContent = texto; }, 0); // depois do texto padrão do main.js
    const abrir = (m) => { m?.classList.add("is-open"); m?.setAttribute("aria-hidden", "false"); };
    const fechar = (m) => { m?.classList.remove("is-open"); m?.setAttribute("aria-hidden", "true"); };

    function avatar(p, extra = "") {
      if (p?.avatar_url) { const i = document.createElement("img"); i.className = `av ${extra}`; i.src = p.avatar_url; i.alt = ""; return i; }
      const s = document.createElement("span"); s.className = `av ${extra}`; s.textContent = iniciais(p?.nome); return s;
    }

    /* ---------- menu da conta (criado uma vez) ---------- */
    const menu = document.createElement("div");
    menu.className = "modal"; menu.id = "modal-perfil"; menu.setAttribute("aria-hidden", "true");
    menu.innerHTML = `
      <div class="modal__box" role="dialog" aria-modal="true" aria-label="Minha conta">
        <button class="modal__close" data-close aria-label="Fechar">&times;</button>
        <div class="perfil">
          <label class="perfil__foto"><span class="perfil__av"></span><input type="file" accept="image/*" hidden>Trocar foto</label>
          <div><strong class="perfil__nome"></strong><p class="perfil__tel"></p></div>
        </div>
        <p class="perfil__msg" role="status"></p>
        <p class="proximos-titulo" hidden>Seus próximos horários</p>
        <ul class="proximos" hidden></ul>
        <a class="btn" href="#agendamento" data-close>Agendar agora</a>
        <button class="btn btn--ghost" type="button" data-sair>Sair da conta</button>
      </div>`;
    document.body.appendChild(menu);
    menu.addEventListener("click", (e) => { if (e.target === menu || e.target.closest("[data-close]")) fechar(menu); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(menu); });
    $("[data-sair]", menu).addEventListener("click", async () => { await db.auth.signOut(); fechar(menu); });

    // Troca de foto: envia ao Storage e salva o endereço em perfis.avatar_url
    const arquivo = $("input[type=file]", menu), msgMenu = $(".perfil__msg", menu);
    arquivo.addEventListener("change", async () => {
      const f = arquivo.files[0]; arquivo.value = "";
      if (!f || !user) return;
      if (!f.type.startsWith("image/") || f.size > 3 * 1024 * 1024) { msgMenu.textContent = "Escolha uma imagem de até 3 MB."; return; }
      msgMenu.textContent = "Enviando foto...";
      const caminho = `${user.id}/avatar`;
      const up = await db.storage.from(C.BUCKET_FOTOS).upload(caminho, f, { upsert: true, contentType: f.type });
      if (up.error) { console.error(up.error); msgMenu.textContent = "Não foi possível enviar a foto."; return; }
      const url = `${db.storage.from(C.BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`;
      const r = await db.from("perfis").update({ avatar_url: url }).eq("id", user.id);
      if (r.error) { console.error(r.error); msgMenu.textContent = "A foto subiu, mas não foi salva no perfil."; return; }
      perfil.avatar_url = url; msgMenu.textContent = "Foto atualizada."; desenharConta();
    });

    async function proximos() {
      const ul = $(".proximos", menu), t = $(".proximos-titulo", menu);
      ul.replaceChildren();
      const { data, error } = await db.from("agendamentos").select("servico,data,horario,status")
        .gte("data", hoje()).order("data").order("horario").limit(3);
      t.hidden = ul.hidden = !!error || !data?.length;
      (data || []).forEach((a) => {
        const [, m, d] = a.data.split("-"), li = document.createElement("li");
        li.textContent = `${d}/${m} às ${a.horario.slice(0, 5)} · ${a.servico} (${a.status})`;
        ul.appendChild(li);
      });
    }
    function abrirMenu() {
      $(".perfil__nome", menu).textContent = perfil.nome || "Cliente";
      $(".perfil__tel", menu).textContent = user.email;
      $(".perfil__av", menu).replaceChildren(avatar(perfil));
      msgMenu.textContent = ""; proximos(); abrir(menu);
    }

    /* ---------- troca dos botões do site (visitante x logado) ---------- */
    const ESCONDER = 'a[href$="cadastro.html"], .hero__login, .cta, [data-open="modal-conta"]';

    function desenharConta() {
      $$(".conta-chip, .conta-dock").forEach((e) => e.remove());
      const nome = primeiroNome(perfil.nome);
      const nav = $(".nav");
      if (nav) {
        const b = document.createElement("button"); b.type = "button"; b.className = "conta-chip";
        const t = document.createElement("span"); t.textContent = nome;
        b.append(avatar(perfil), t); b.addEventListener("click", abrirMenu); nav.append(b);
      }
      const dock = $("#dock");
      if (dock) {
        const b = document.createElement("button"); b.type = "button"; b.className = "conta-dock"; b.setAttribute("aria-label", "Minha conta");
        b.append(avatar(perfil), document.createTextNode("Conta")); b.addEventListener("click", abrirMenu); dock.append(b);
      }
    }
    function limpar() {
      $$("[data-sessao]").forEach((e) => { e.hidden = false; delete e.dataset.sessao; });
      $$(".conta-chip, .conta-dock, .agenda__ola").forEach((e) => e.remove());
      fechar(menu);
    }

    /* ---------- agendamento rápido ---------- */
    function prepararForm(logado) {
      const form = $("#form-agendamento");
      if (!form) return;
      if (!form.horario) { // campo de horário (criado aqui para você não precisar mexer no HTML)
        const l = document.createElement("label"), s = document.createElement("select");
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
        const p = document.createElement("p"), b = document.createElement("strong");
        p.className = "agenda__ola"; b.textContent = perfil.nome || user.email; p.append("Agendando como ", b); form.prepend(p);
      }
    }

    /* ---------- perfil do usuário logado ---------- */
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
    }
    db.auth.onAuthStateChange((_evento, sessao) => { user = sessao?.user || null; setTimeout(atualizar, 0); });

    /* ---------- login e agendamento de verdade (substituem os de teste do script.js) ---------- */
    window.CubaAPI = Object.assign(window.CubaAPI || {}, {
      async login(d) {
        const { error } = await db.auth.signInWithPassword({ email: String(d.email || "").trim().toLowerCase(), password: d.senha });
        if (error) {
          console.error(error);
          aviso("#conta-msg", /not confirmed/i.test(error.message) ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
          return { ok: false };
        }
        setTimeout(() => fechar($("#modal-conta")), 700);
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
        return { ok: true };
      },
    });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();