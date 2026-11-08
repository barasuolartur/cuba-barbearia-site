/* ==========================================================
   CUBA BARBEARIA | cadastro.js
   Cria a conta no Supabase Auth e guarda nome e telefone nos
   metadados do usuário (o banco copia para a tabela "perfis"
   por um gatilho; veja o passo a passo do SQL).
   Requer a biblioteca @supabase/supabase-js carregada antes.
   ========================================================== */

/* ---------- 1. CONFIGURAÇÃO (edite aqui) ---------- */
const CONFIG = {
  SUPABASE_URL: "https://ororwuqtbehkwjqvlovf.supabase.co",   // Project Settings > API
  SUPABASE_KEY: "sb_publishable_c_g-gaQr8CYTW0Y2OB5Zyw_2YnWof31",                 // chave PUBLISHABLE (ou anon). NUNCA use a secret/service_role aqui
  PAGINA_APOS_CADASTRO: "../index.html",                // para onde ir se o e-mail não precisar de confirmação
  SENHA_MINIMA: 8,
};

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function init() {
    const form = $("#form-cadastro");
    if (!form) return;

    /* ---------- 2. CLIENTE SUPABASE ---------- */
    const configurado = !CONFIG.SUPABASE_URL.includes("SEU-PROJETO") && !CONFIG.SUPABASE_KEY.includes("SUA_CHAVE");
    const db = configurado && window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;
    if (!window.supabase) console.error("A biblioteca do Supabase NÃO carregou. Confira o <script> do jsdelivr no cadastro.html.");
if (!configurado) console.error("A URL ou a chave em CONFIG ainda estão com o texto de exemplo.");

    const msg = $("#msg"), btn = $("#btn-enviar");
    const mostrar = (texto, info = false) => { msg.textContent = texto; msg.classList.toggle("is-info", info); };

    /* ---------- 3. EFEITOS DE INTERFACE ---------- */
    // Máscara de telefone: (61) 99999-9999
    const tel = $("#telefone");
    tel.addEventListener("input", () => {
      const d = tel.value.replace(/\D/g, "").slice(0, 11);
      tel.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`
        : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
    });

    // Mostrar/ocultar senha
    const senha = $("#senha"), ver = $("#ver-senha");
    ver.addEventListener("click", () => {
      const aberto = senha.type === "text";
      senha.type = aberto ? "password" : "text";
      $("#confirmar").type = senha.type;
      ver.textContent = aberto ? "Mostrar" : "Ocultar";
    });

    // Força da senha
    const forca = $("#forca");
    senha.addEventListener("input", () => {
      const v = senha.value;
      const pontos = (v.length >= CONFIG.SENHA_MINIMA) + /[A-Z]/.test(v) + /\d/.test(v) + /[^A-Za-z0-9]/.test(v);
      forca.style.width = `${(pontos / 4) * 100}%`;
      forca.style.background = ["#d8242f", "#d8242f", "#e8a317", "#9ad43b", "#3ddc97"][pontos];
    });

    // Inclinação 3D do cartão (só com mouse)
    const card = $("#card");
    if (matchMedia("(hover: hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.addEventListener("pointermove", (e) => {
        card.style.setProperty("--ry", `${(e.clientX / innerWidth - 0.5) * 6}deg`);
        card.style.setProperty("--rx", `${-(e.clientY / innerHeight - 0.5) * 6}deg`);
      });
    }

    /* ---------- 4. VALIDAÇÃO ---------- */
    const erro = (campo, texto) => {
      const el = $(`[data-erro="${campo}"]`);
      if (el) el.textContent = texto || "";
      el?.closest(".field")?.classList.toggle("is-invalid", !!texto);
      if (campo === "termos" && el) el.textContent = texto || "";
    };
    const validar = (d) => {
      const e = {};
      if (d.nome.trim().split(/\s+/).length < 2) e.nome = "Digite nome e sobrenome.";
      const digitos = d.telefone.replace(/\D/g, "");
      if (digitos.length < 10) e.telefone = "Digite um telefone válido com DDD.";
      if (!/^\S+@\S+\.\S+$/.test(d.email)) e.email = "Digite um e-mail válido.";
      if (d.senha.length < CONFIG.SENHA_MINIMA) e.senha = `A senha precisa ter pelo menos ${CONFIG.SENHA_MINIMA} caracteres.`;
      if (d.confirmar !== d.senha) e.confirmar = "As senhas não são iguais.";
      if (!d.termos) e.termos = "Aceite os termos para continuar.";
      return e;
    };
    $$("input", form).forEach((i) => i.addEventListener("input", () => erro(i.name, "")));

    /* ---------- 5. TRADUÇÃO DOS ERROS DO SUPABASE ---------- */
    const traduzir = (err) => {
      const t = (err.message || "").toLowerCase();
      if (err.status === 429 || t.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
      if (t.includes("already registered")) return "Este e-mail já está cadastrado. Tente entrar.";
      if (t.includes("password")) return "Senha fraca. Use letras, números e símbolos.";
      if (t.includes("invalid") && t.includes("email")) return "E-mail inválido.";
      return "Não foi possível criar a conta. Tente novamente.";
    };

    /* ---------- 6. ENVIO ---------- */
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const d = {
        nome: form.nome.value, telefone: form.telefone.value, email: form.email.value.trim().toLowerCase(),
        senha: form.senha.value, confirmar: form.confirmar.value, termos: form.termos.checked,
      };
      const erros = validar(d);
      ["nome", "telefone", "email", "senha", "confirmar", "termos"].forEach((c) => erro(c, erros[c]));
      if (Object.keys(erros).length) { mostrar("Revise os campos destacados."); return; }

      if (!db) {
        mostrar("Supabase não configurado: confira a URL, a chave e se a biblioteca foi carregada.");
        console.error("Configure CONFIG em cadastro.js e carregue o @supabase/supabase-js antes deste arquivo.");
        return;
      }

      btn.disabled = true; mostrar("Criando sua conta...", true);
      try {
        const { data, error } = await db.auth.signUp({
          email: d.email,
          password: d.senha,
          options: {
            data: { nome: d.nome.trim(), telefone: d.telefone.replace(/\D/g, "") },
            emailRedirectTo: new URL(CONFIG.PAGINA_APOS_CADASTRO, location.href).href,
          },
        });
        if (error) throw error;

        // Com confirmação de e-mail ativa, um e-mail já existente volta "sem identidades"
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          mostrar("Este e-mail já está cadastrado. Tente entrar."); return;
        }
        sucesso(d.email, !!data.session);
      } catch (err) {
        console.error("Erro no cadastro:", err);
        mostrar(traduzir(err));
      } finally {
        btn.disabled = false;
      }
    });

    function sucesso(email, logado) {
      form.hidden = true;
      $("#ok").hidden = false;
      $("#ok-titulo").textContent = logado ? "Conta criada!" : "Confirme seu e-mail";
      $("#ok-texto").textContent = logado
        ? "Tudo certo. Você já pode agendar seu horário."
        : `Enviamos um link de confirmação para ${email}. Clique nele para ativar sua conta.`;
      if (logado) setTimeout(() => { location.href = CONFIG.PAGINA_APOS_CADASTRO; }, 2200);
    }
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();