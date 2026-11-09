/* ==========================================================
   CUBA BARBEARIA | painel.js  (página "Minha conta")
   Mostra foto, dados e agendamentos de quem está logado.
   Sem login, manda para a página de login.
   Usa as tabelas "perfis" e "agendamentos" do Supabase.
   Se a biblioteca do Supabase não estiver no HTML, carrega sozinho.
   ========================================================== */

/* ---------- 1. CONFIGURAÇÃO (edite aqui) ---------- */
const PAINEL_CONFIG = {
  SUPABASE_URL: "https://ororwuqtbehkwjqvlovf.supabase.co",
  SUPABASE_KEY: "sb_publishable_c_g-gaQr8CYTW0Y2OB5Zyw_2YnWof31",                      // cole a chave publishable (ou anon) entre aspas
  BUCKET_FOTOS: "avatares",
  PAGINA_LOGIN: "login.html",                             // quem não estiver logado vai para cá
  PAGINA_SITE: "../index.html",                           // para onde ir ao sair
  BIBLIOTECA: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
};

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const C = PAINEL_CONFIG;
  const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const ROTULO = { pendente: "Aguardando", confirmado: "Confirmado", cancelado: "Cancelado", concluido: "Concluído" };

  const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
  const iniciais = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const primeiroNome = (n) => (n || "Cliente").trim().split(/\s+/)[0];
  const semana = (data) => { const [y, m, d] = data.split("-"); return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long" }); };
  const formatarTel = (v) => {
    const d = (v || "").replace(/\D/g, "").slice(0, 11);
    return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  };
  const agoraChave = () => { const d = new Date(); return `${d.toLocaleDateString("sv-SE")}T${d.toTimeString().slice(0, 5)}`; };
  const chaveDe = (a) => `${a.data}T${a.horario.slice(0, 5)}`;

  const carregarBiblioteca = () => window.supabase ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement("script"); s.src = C.BIBLIOTECA; s.onload = ok; s.onerror = falha; document.head.appendChild(s);
  });
  const problema = (t) => { const a = $("#aviso"); a.textContent = t; a.hidden = false; console.error("painel.js:", t); };

  async function init() {
    if (C.SUPABASE_KEY.trim().includes("SUA_CHAVE") || C.SUPABASE_KEY.trim().length < 20) { problema("A chave do Supabase ainda não foi colocada. Abra js/painel.js e cole sua chave pública em SUPABASE_KEY."); return; }
    try { await carregarBiblioteca(); } catch { problema("Não foi possível carregar a biblioteca do Supabase. Verifique a internet ou bloqueadores de anúncios."); return; }

    const db = window.supabase.createClient(C.SUPABASE_URL.trim(), C.SUPABASE_KEY.trim());
    const { data: { session } } = await db.auth.getSession();
    if (!session) { location.replace(C.PAGINA_LOGIN); return; }
    const user = session.user;
    db.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") location.replace(C.PAGINA_LOGIN); });

    let perfil = { nome: "", telefone: "", avatar_url: null };

    /* ---------- 2. PERFIL ---------- */
    async function carregarPerfil() {
      let { data, error } = await db.from("perfis").select("nome,telefone,avatar_url").eq("id", user.id).maybeSingle();
      if (error) ({ data } = await db.from("perfis").select("nome,telefone").eq("id", user.id).maybeSingle()); // coluna avatar_url ainda não existe
      const m = user.user_metadata || {};
      perfil = { nome: data?.nome || m.nome || "", telefone: data?.telefone || m.telefone || "", avatar_url: data?.avatar_url || null };
    }
    function desenharPerfil() {
      const av = $("#avatar"), novo = perfil.avatar_url ? Object.assign(el("img", "av"), { src: perfil.avatar_url, alt: "Sua foto de perfil" }) : el("span", "av", iniciais(perfil.nome));
      novo.id = "avatar"; av.replaceWith(novo);
      const h = new Date().getHours();
      $("#saudacao").textContent = `${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"},`;
      $("#nome").textContent = primeiroNome(perfil.nome);
      $("#email").textContent = user.email;
      $("#f-nome").value = perfil.nome; $("#f-tel").value = formatarTel(perfil.telefone);
    }

    /* ---------- 3. AGENDAMENTOS ---------- */
    function itemLista(a, podeCancelar) {
      const li = el("li", "item"); li.dataset.status = a.status;
      const [, m, d] = a.data.split("-");
      const data = el("div", "item__data"); data.append(el("b", "", d), el("span", "", MESES[+m - 1]));
      const corpo = el("div", "item__corpo"); corpo.append(el("strong", "", a.servico), el("span", "", `${a.horario.slice(0, 5)} · ${semana(a.data)}`));
      const chip = el("span", "chip", ROTULO[a.status] || a.status); chip.dataset.status = a.status;
      li.append(data, corpo, chip);
      if (podeCancelar) li.append(botaoCancelar(a, "item__cancelar"));
      return li;
    }
    function botaoCancelar(a, cls) {
      const b = el("button", cls, "Cancelar"); b.type = "button";
      b.addEventListener("click", async () => {
        if (!confirm("Cancelar este agendamento?")) return;
        b.disabled = true;
        const { data, error } = await db.from("agendamentos").update({ status: "cancelado" }).eq("id", a.id).select("id");
        if (error || !data?.length) { console.error(error); alert("Não foi possível cancelar. Tente novamente."); b.disabled = false; return; }
        carregarAgendamentos();
      });
      return b;
    }
    function vazio(ul, texto) { ul.replaceChildren(el("li", "lista__vazio", texto)); }

    async function carregarAgendamentos() {
      const { data, error } = await db.from("agendamentos").select("id,servico,data,horario,status").order("data").order("horario");
      const prox = $("#proximo"), lp = $("#lista-proximos"), lh = $("#lista-historico");
      if (error) {
        console.error(error);
        prox.textContent = "Não foi possível carregar seus agendamentos.";
        vazio(lp, "Sem dados no momento."); vazio(lh, "Sem dados no momento.");
        return;
      }
      const agora = agoraChave();
      const futuros = data.filter((a) => a.status !== "cancelado" && chaveDe(a) >= agora);
      const historico = data.filter((a) => !futuros.includes(a)).reverse();

      $("#st-proximo").textContent = futuros[0] ? `${futuros[0].data.split("-")[2]}/${futuros[0].data.split("-")[1]}` : "-";
      $("#st-total").textContent = data.filter((a) => a.status !== "cancelado").length;
      $("#st-visitas").textContent = historico.filter((a) => a.status !== "cancelado").length;

      // Destaque do próximo horário
      prox.replaceChildren();
      const p = futuros[0];
      if (p) {
        const [, m, d] = p.data.split("-");
        const corpo = el("div", "proximo__corpo"), dia = el("div", "dia"), info = el("div", "proximo__info");
        dia.append(el("b", "", d), el("span", "", MESES[+m - 1]));
        const chip = el("span", "chip", ROTULO[p.status] || p.status); chip.dataset.status = p.status; chip.style.justifySelf = "start";
        info.append(el("strong", "", p.servico), el("span", "", `${semana(p.data)}, às ${p.horario.slice(0, 5)}`), chip);
        corpo.append(dia, info);
        const acoes = el("div", "proximo__acoes"); acoes.append(botaoCancelar(p, "item__cancelar"));
        prox.append(corpo, acoes);
      } else {
        const v = el("div", "vazio"), a = el("a", "btn", "Agendar meu horário"); a.href = $("#novo").getAttribute("href");
        v.append(el("p", "", "Você ainda não tem horário marcado. Que tal reservar o seu corte?"), a);
        prox.append(v);
      }

      lp.replaceChildren(...futuros.slice(1).map((a) => itemLista(a, true)));
      if (futuros.length < 2) vazio(lp, futuros.length ? "Nenhum outro horário marcado." : "Nenhum horário marcado.");
      lh.replaceChildren(...historico.map((a) => itemLista(a, false)));
      if (!historico.length) vazio(lh, "Seu histórico aparece aqui depois do primeiro atendimento.");
    }

    /* ---------- 4. EDITAR DADOS ---------- */
    const tel = $("#f-tel");
    tel.addEventListener("input", () => { tel.value = formatarTel(tel.value); });
    $("#form-dados").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#msg-dados"), btn = $("#btn-salvar"), nome = $("#f-nome").value.trim(), digitos = tel.value.replace(/\D/g, "");
      if (nome.split(/\s+/).length < 2) { msg.textContent = "Digite nome e sobrenome."; return; }
      if (digitos && digitos.length < 10) { msg.textContent = "Digite um telefone válido com DDD."; return; }
      btn.disabled = true; msg.textContent = "Salvando...";
      const { data, error } = await db.from("perfis").update({ nome, telefone: digitos }).eq("id", user.id).select("id");
      btn.disabled = false;
      if (error || !data?.length) { console.error(error); msg.textContent = "Não foi possível salvar. Tente novamente."; return; }
      perfil.nome = nome; perfil.telefone = digitos; desenharPerfil(); msg.textContent = "Dados salvos.";
    });

    /* ---------- 5. TROCAR FOTO ---------- */
    const arquivo = $("#arq-foto"), msgFoto = $("#msg-foto");
    arquivo.addEventListener("change", async () => {
      const f = arquivo.files[0]; arquivo.value = "";
      if (!f) return;
      if (!f.type.startsWith("image/") || f.size > 3 * 1024 * 1024) { msgFoto.textContent = "Escolha uma imagem de até 3 MB."; return; }
      msgFoto.textContent = "Enviando foto...";
      const caminho = `${user.id}/avatar`;
      const up = await db.storage.from(C.BUCKET_FOTOS).upload(caminho, f, { upsert: true, contentType: f.type });
      if (up.error) { console.error(up.error); msgFoto.textContent = "Não foi possível enviar a foto."; return; }
      const url = `${db.storage.from(C.BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`;
      const r = await db.from("perfis").update({ avatar_url: url }).eq("id", user.id);
      if (r.error) { console.error(r.error); msgFoto.textContent = "A foto subiu, mas não foi salva no perfil."; return; }
      perfil.avatar_url = url; desenharPerfil(); msgFoto.textContent = "Foto atualizada.";
    });

    /* ---------- 6. SAIR + INCLINAÇÃO 3D ---------- */
    $("#sair").addEventListener("click", async () => { await db.auth.signOut(); location.replace(C.PAGINA_SITE); });

    const card = $("#bloco-proximo");
    if (matchMedia("(hover: hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`);
        card.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 10}deg`);
      });
      card.addEventListener("pointerleave", () => { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
    }

    await carregarPerfil(); desenharPerfil();
    carregarAgendamentos();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();