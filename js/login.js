/* ==========================================================
   CUBA BARBEARIA | login.js
   Entra na conta com e-mail e senha (Supabase Auth).
   A sessão fica salva no navegador e é reconhecida pela
   página inicial (sessao.js), que então mostra foto e nome.
   Se a biblioteca do Supabase não estiver ligada no HTML,
   este arquivo tenta carregá-la sozinho.
   ========================================================== */

/* ---------- 1. CONFIGURAÇÃO (edite aqui) ---------- */
const LOGIN_CONFIG = {
  SUPABASE_URL: "https://ororwuqtbehkwjqvlovf.supabase.co",
  SUPABASE_KEY: "sb_publishable_c_g-gaQr8CYTW0Y2OB5Zyw_2YnWof31",        // cole aqui a chave publishable (ou anon) entre aspas
  PAGINA_APOS_LOGIN: "pages/painel.html",       // para onde ir depois de entrar
  BIBLIOTECA: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
};

(() => {
  const $ = (s, r = document) => r.querySelector(s);

  const carregarBiblioteca = () => window.supabase ? Promise.resolve() : new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = LOGIN_CONFIG.BIBLIOTECA; s.onload = ok; s.onerror = falha; document.head.appendChild(s);
  });

  async function init() {
    const form = $("#form-login");
    if (!form) return;
    const C = LOGIN_CONFIG;
    const msg = $("#msg"), btn = $("#btn-enviar");
    const mostrar = (t) => { msg.textContent = t; };

    /* ---------- 2. PREPARA O SUPABASE E DESCOBRE O QUE ESTIVER FALTANDO ---------- */
    let db = null, problema = "";
    const chave = C.SUPABASE_KEY.trim();
    if (chave.includes("SUA_CHAVE") || chave.length < 20) {
      problema = "A chave do Supabase ainda não foi colocada. Abra o arquivo js/login.js e cole sua chave pública em SUPABASE_KEY.";
    } else {
      try {
        await carregarBiblioteca();
        db = window.supabase.createClient(C.SUPABASE_URL.trim(), chave);
      } catch (e) {
        problema = "Não foi possível carregar a biblioteca do Supabase. Verifique sua internet ou bloqueadores de anúncios.";
      }
    }
    if (problema) console.error("login.js:", problema);

    // Quem já está logado vai direto para o site
    db?.auth.getSession().then(({ data }) => { if (data.session) location.replace(C.PAGINA_APOS_LOGIN); });

    /* ---------- 3. INTERFACE ---------- */
    const senha = $("#senha"), ver = $("#ver-senha");
    ver.addEventListener("click", () => {
      const aberto = senha.type === "text";
      senha.type = aberto ? "password" : "text";
      ver.textContent = aberto ? "Mostrar" : "Ocultar";
    });

    const card = $("#card");
    if (matchMedia("(hover: hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.addEventListener("pointermove", (e) => {
        card.style.setProperty("--ry", `${(e.clientX / innerWidth - 0.5) * 6}deg`);
        card.style.setProperty("--rx", `${-(e.clientY / innerHeight - 0.5) * 6}deg`);
      });
    }

    const erro = (campo, texto) => {
      const el = $(`[data-erro="${campo}"]`);
      el.textContent = texto || "";
      el.closest(".field").classList.toggle("is-invalid", !!texto);
    };
    form.addEventListener("input", (e) => erro(e.target.name, ""));

    /* ---------- 4. ENVIO ---------- */
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = form.email.value.trim().toLowerCase(), pass = form.senha.value;
      const e1 = /^\S+@\S+\.\S+$/.test(email) ? "" : "Digite um e-mail válido.";
      const e2 = pass ? "" : "Digite sua senha.";
      erro("email", e1); erro("senha", e2);
      if (e1 || e2) { mostrar("Revise os campos destacados."); return; }
      if (problema) { mostrar(problema); return; }

      btn.disabled = true; mostrar("Entrando...");
      const { error } = await db.auth.signInWithPassword({ email, password: pass });
      if (error) {
        console.error("Erro no login:", error);
        mostrar(
          error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." :
          /not confirmed/i.test(error.message) ? "Confirme seu e-mail antes de entrar." :
          /invalid login/i.test(error.message) ? "E-mail ou senha incorretos." :
          /api key/i.test(error.message) ? "Chave do Supabase inválida. Confira a SUPABASE_KEY em js/login.js." :
          /fetch/i.test(error.message) ? "Sem conexão com o Supabase. Confira a SUPABASE_URL em js/login.js e sua internet." :
          "Não foi possível entrar. Tente novamente."
        );
        btn.disabled = false;
        return;
      }
      mostrar("Tudo certo! Entrando...");
      location.href = C.PAGINA_APOS_LOGIN;
    });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();