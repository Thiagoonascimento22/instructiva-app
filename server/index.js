import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Armazenamento em arquivo JSON (JavaScript puro — sem compilação nativa).
// No Railway, monte um volume e aponte DB_PATH para dentro dele
// (ex.: DB_PATH=/data/instructiva.json) para os dados persistirem.
// ---------------------------------------------------------------------------
let DB_PATH = process.env.DB_PATH || join(ROOT, "instructiva.json");
// se vier com extensão .db (config antiga), troca para .json
if (DB_PATH.endsWith(".db")) DB_PATH = DB_PATH.replace(/\.db$/, ".json");

const DB_DIR = dirname(DB_PATH);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Espera o volume montar. No Railway o volume pode montar alguns segundos
// DEPOIS do servidor iniciar; se gravarmos antes, o mount "cobre" os dados.
async function aguardarVolume(maxTentativas = 30) {
  for (let i = 0; i < maxTentativas; i++) {
    try {
      if (!fs.existsSync(DB_DIR)) {
        try { fs.mkdirSync(DB_DIR, { recursive: true }); } catch {}
      }
      const testFile = join(DB_DIR, ".write-test");
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
      return true;
    } catch (e) {
      await sleep(1000);
    }
  }
  console.warn("⚠ Volume não confirmado após espera; seguindo mesmo assim.");
  return false;
}

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const d = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      // garante que todos os campos existam (migração de bancos antigos)
      if (!d.users) d.users = [];
      if (!d.records) d.records = [];
      if (!d.tasks) d.tasks = [];
      if (!d.sessions) d.sessions = {};
      if (!d.waChats) d.waChats = {};       // conversas do WhatsApp por número
      if (!d.waConfig) d.waConfig = {};      // config da conexão (url, key, instâncias)
      return d;
    }
  } catch (e) { console.error("Erro ao ler banco:", e.message); }
  return { users: [], records: [], tasks: [], sessions: {}, waChats: {}, waConfig: {} };
}
function saveDB(database) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2)); }
  catch (e) { console.error("Erro ao salvar banco:", e.message); }
}

let db = { users: [], records: [], tasks: [], sessions: {}, waChats: {}, waConfig: {} };

// Inicialização assíncrona: espera o volume, carrega o banco, cria admin,
// e SÓ ENTÃO sobe o servidor.
async function iniciar() {
  console.log("Aguardando volume em:", DB_DIR);
  await aguardarVolume();
  console.log("Volume pronto. Usando banco em:", DB_PATH);

  db = loadDB();

  // cria a conta admin padrão se não existir nenhuma
  if (!db.users.some((u) => u.role === "admin")) {
    db.users.push({
      id: "admin",
      nome: "",
      login: "gerente",
      senha: hash("admin123"),
      role: "admin",
      perms: { ver_todos: true, registrar: true, excluir: true, exportar: true, ia: true, gerir_usuarios: true },
      ativo: true,
    });
    saveDB(db);
    console.log("→ Conta admin criada: login 'gerente' / senha 'admin123'");
  } else {
    console.log("→ Banco já existe. Usuários:", db.users.length, "| Atendimentos:", db.records.length);
  }

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`✓ Servidor rodando na porta ${PORT}`));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hash(senha) {
  return crypto.createHash("sha256").update(senha + "::instructiva-salt").digest("hex");
}
function newToken() { return crypto.randomBytes(24).toString("hex"); }
function publicUser(u) {
  return { id: u.id, nome: u.nome, login: u.login, role: u.role, perms: u.perms, ativo: !!u.ativo };
}
function userFromToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const userId = db.sessions[token];
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}
function requireAuth(req, res, next) {
  const u = userFromToken(req);
  if (!u) return res.status(401).json({ error: "não autenticado" });
  req.user = u;
  req.perms = u.perms || {};
  req.isAdmin = u.role === "admin";
  next();
}
function can(req, perm) { return req.isAdmin || req.perms?.[perm]; }

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
app.post("/api/login", (req, res) => {
  const { login, senha } = req.body;
  const u = db.users.find((x) => x.login.toLowerCase() === String(login || "").trim().toLowerCase() && x.ativo);
  if (!u || u.senha !== hash(senha || "")) return res.status(401).json({ error: "usuário ou senha incorretos" });
  const token = newToken();
  db.sessions[token] = u.id;
  saveDB(db);
  res.json({ token, user: publicUser(u) });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  delete db.sessions[auth];
  saveDB(db);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.put("/api/me", requireAuth, (req, res) => {
  const { nome, login, senha } = req.body;
  const u = req.user;
  const novoNome = (nome ?? u.nome).trim() || u.nome;
  const novoLogin = (login ?? u.login).trim() || u.login;
  if (novoLogin.toLowerCase() !== u.login.toLowerCase()) {
    if (db.users.some((x) => x.login.toLowerCase() === novoLogin.toLowerCase() && x.id !== u.id))
      return res.status(400).json({ error: "esse usuário já existe" });
  }
  u.nome = novoNome;
  u.login = novoLogin;
  if (senha && senha.trim()) u.senha = hash(senha.trim());
  saveDB(db);
  res.json({ user: publicUser(u) });
});

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------
app.get("/api/users", requireAuth, (req, res) => {
  if (!can(req, "gerir_usuarios")) return res.status(403).json({ error: "sem permissão" });
  const sorted = [...db.users].sort((a, b) => (b.role === "admin") - (a.role === "admin") || (a.nome || "").localeCompare(b.nome || ""));
  res.json({ users: sorted.map(publicUser) });
});

app.get("/api/users/names", requireAuth, (req, res) => {
  res.json({ users: db.users.map((u) => ({ id: u.id, nome: u.nome, role: u.role, ativo: !!u.ativo })) });
});

app.post("/api/users", requireAuth, (req, res) => {
  if (!can(req, "gerir_usuarios")) return res.status(403).json({ error: "sem permissão" });
  const { nome, login, senha, perms } = req.body;
  if (!nome?.trim() || !login?.trim() || !senha?.trim()) return res.status(400).json({ error: "preencha nome, login e senha" });
  if (db.users.some((u) => u.login.toLowerCase() === login.trim().toLowerCase())) return res.status(400).json({ error: "esse usuário já existe" });
  const defaultPerms = { registrar: true, ver_todos: false, excluir: false, exportar: false, ia: false, gerir_usuarios: false };
  const novo = {
    id: "u" + Date.now() + crypto.randomBytes(2).toString("hex"),
    nome: nome.trim(), login: login.trim(), senha: hash(senha.trim()),
    role: "colaboradora", perms: { ...defaultPerms, ...(perms || {}) }, ativo: true,
  };
  db.users.push(novo);
  saveDB(db);
  res.json({ user: publicUser(novo) });
});

app.put("/api/users/:id", requireAuth, (req, res) => {
  if (!can(req, "gerir_usuarios")) return res.status(403).json({ error: "sem permissão" });
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "não encontrado" });
  if (u.role === "admin") return res.status(400).json({ error: "não é possível editar o admin por aqui" });
  const { perms, ativo, nome, senha } = req.body;
  if (perms) u.perms = perms;
  if (ativo !== undefined) u.ativo = !!ativo;
  if (nome !== undefined) u.nome = nome.trim() || u.nome;
  if (senha && senha.trim()) u.senha = hash(senha.trim());
  saveDB(db);
  res.json({ user: publicUser(u) });
});

app.delete("/api/users/:id", requireAuth, (req, res) => {
  if (!can(req, "gerir_usuarios")) return res.status(403).json({ error: "sem permissão" });
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "não encontrado" });
  if (u.role === "admin") return res.status(400).json({ error: "não é possível remover o admin" });
  db.users = db.users.filter((x) => x.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// RECORDS
// ---------------------------------------------------------------------------
app.get("/api/records", requireAuth, (req, res) => {
  let rows = can(req, "ver_todos") ? db.records : db.records.filter((r) => r.colaboradoraId === req.user.id);
  rows = [...rows].sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  res.json({ records: rows });
});

app.post("/api/records", requireAuth, (req, res) => {
  if (!can(req, "registrar")) return res.status(403).json({ error: "sem permissão para registrar" });
  const b = req.body;
  if (!b.aluno?.trim() || !b.assunto?.trim()) return res.status(400).json({ error: "aluno e assunto são obrigatórios" });
  const colabId = req.isAdmin && b.colaboradoraId ? b.colaboradoraId : req.user.id;
  const rec = {
    id: Date.now() + "-" + crypto.randomBytes(3).toString("hex"),
    data: b.data || new Date().toISOString().slice(0, 10),
    colaboradoraId: colabId,
    aluno: b.aluno?.trim() || "", email: b.email?.trim() || "", telefone: b.telefone?.trim() || "",
    assunto: b.assunto?.trim() || "", solucao: b.solucao?.trim() || "", status: b.status || "resolvido",
    obs: b.obs?.trim() || "", criadoEm: new Date().toISOString(),
  };
  db.records.unshift(rec);
  saveDB(db);
  res.json({ record: rec });
});

app.delete("/api/records/:id", requireAuth, (req, res) => {
  const rec = db.records.find((r) => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: "não encontrado" });
  if (!can(req, "excluir")) return res.status(403).json({ error: "sem permissão para excluir" });
  db.records = db.records.filter((r) => r.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// TASKS (tarefas com prazo) — a gerente atribui, a colaboradora vê as dela
// ---------------------------------------------------------------------------
app.get("/api/tasks", requireAuth, (req, res) => {
  // admin/quem vê todos: todas as tarefas; colaboradora: só as atribuídas a ela
  let rows = can(req, "ver_todos") ? db.tasks : db.tasks.filter((t) => t.responsavelId === req.user.id);
  rows = [...rows].sort((a, b) => {
    // não concluídas primeiro, depois por prazo
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    return (a.prazo || "9999").localeCompare(b.prazo || "9999");
  });
  res.json({ tasks: rows });
});

app.post("/api/tasks", requireAuth, (req, res) => {
  // só admin (ou quem gerencia usuários) pode criar/atribuir tarefas
  if (!req.isAdmin && !can(req, "gerir_usuarios")) return res.status(403).json({ error: "sem permissão para atribuir tarefas" });
  const b = req.body;
  if (!b.titulo?.trim() || !b.responsavelId) return res.status(400).json({ error: "título e responsável são obrigatórios" });
  const task = {
    id: "t" + Date.now() + crypto.randomBytes(2).toString("hex"),
    titulo: b.titulo.trim(),
    descricao: b.descricao?.trim() || "",
    responsavelId: b.responsavelId,
    prazo: b.prazo || "",
    prioridade: b.prioridade || "media", // baixa | media | alta
    concluida: false,
    criadaPor: req.user.id,
    criadaEm: new Date().toISOString(),
    concluidaEm: null,
  };
  db.tasks.unshift(task);
  saveDB(db);
  res.json({ task });
});

app.put("/api/tasks/:id", requireAuth, (req, res) => {
  const t = db.tasks.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "não encontrada" });
  const b = req.body;
  const ehDono = req.isAdmin || can(req, "gerir_usuarios");
  const ehResponsavel = t.responsavelId === req.user.id;
  // a colaboradora responsável pode marcar concluída/desmarcar; o dono pode editar tudo
  if (b.concluida !== undefined && (ehResponsavel || ehDono)) {
    t.concluida = !!b.concluida;
    t.concluidaEm = b.concluida ? new Date().toISOString() : null;
  }
  if (ehDono) {
    if (b.titulo !== undefined) t.titulo = b.titulo.trim() || t.titulo;
    if (b.descricao !== undefined) t.descricao = b.descricao.trim();
    if (b.responsavelId !== undefined) t.responsavelId = b.responsavelId;
    if (b.prazo !== undefined) t.prazo = b.prazo;
    if (b.prioridade !== undefined) t.prioridade = b.prioridade;
  }
  if (!ehResponsavel && !ehDono) return res.status(403).json({ error: "sem permissão" });
  saveDB(db);
  res.json({ task: t });
});

app.delete("/api/tasks/:id", requireAuth, (req, res) => {
  if (!req.isAdmin && !can(req, "gerir_usuarios")) return res.status(403).json({ error: "sem permissão" });
  const t = db.tasks.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "não encontrada" });
  db.tasks = db.tasks.filter((x) => x.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// IA — análise de desempenho (chave protegida no servidor)
// ---------------------------------------------------------------------------
app.post("/api/analise", requireAuth, async (req, res) => {
  if (!can(req, "ia")) return res.status(403).json({ error: "sem permissão" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "IA não configurada (defina ANTHROPIC_API_KEY no Railway)" });

  const users = db.users.filter((u) => u.ativo);
  const records = db.records;
  const colaboradoraId = req.body?.colaboradoraId || null;

  let prompt;
  if (colaboradoraId) {
    // ---- ANÁLISE INDIVIDUAL ----
    const alvo = db.users.find((u) => u.id === colaboradoraId);
    if (!alvo) return res.status(404).json({ error: "colaboradora não encontrada" });
    const resumoInd = buildIndividualPayload(records, db.tasks, alvo);
    prompt = `Você é um especialista em gestão de equipes de atendimento ao cliente / suporte ao aluno. Analise o desempenho INDIVIDUAL da colaboradora abaixo e produza um parecer em português do Brasil.

DADOS DA COLABORADORA:
${resumoInd}

Retorne SOMENTE um JSON válido (sem markdown, sem crases) com esta estrutura exata:
{
  "individual": true,
  "nome": "nome exato da colaboradora",
  "avaliacao": "Excelente" | "Bom" | "Regular" | "Precisa atenção",
  "resumo": "2-3 frases sobre o desempenho geral dela, baseado nos números",
  "pontos_fortes": ["ponto forte 1", "ponto forte 2"],
  "pontos_melhoria": ["ponto a melhorar 1", "ponto a melhorar 2"],
  "sugestoes": ["sugestão prática e acionável 1", "sugestão 2", "sugestão 3"],
  "feedback_sugerido": "um parágrafo curto de feedback que a gerente poderia dar diretamente a ela, em tom construtivo"
}
Seja específico usando os números reais. Tom profissional, construtivo e acionável.`;
  } else {
    // ---- ANÁLISE DA EQUIPE (padrão) ----
    const resumo = buildAIPayload(records, users);
    prompt = `Você é um especialista em gestão de equipes de atendimento ao cliente / suporte ao aluno. Analise os dados de desempenho da equipe abaixo e produza um relatório gerencial em português do Brasil.

DADOS DA EQUIPE (período completo registrado):
${resumo}

Retorne SOMENTE um JSON válido (sem markdown, sem crases) com esta estrutura exata:
{
  "panorama": "2-3 frases sobre a situação geral do setor",
  "destaque": "nome da colaboradora com melhor desempenho e por quê (1 frase)",
  "atencao": "nome da colaboradora que precisa de mais apoio e por quê, de forma construtiva (1 frase), ou null se todas vão bem",
  "colaboradoras": [
    { "nome": "nome exato", "avaliacao": "Excelente" | "Bom" | "Regular" | "Precisa atenção", "leitura": "1-2 frases sobre como ela está, baseado nos números", "sugestoes": ["sugestão prática 1", "sugestão prática 2"] }
  ],
  "acoes_setor": ["ação recomendada para o setor 1", "ação 2", "ação 3"]
}
Seja específico usando os números reais. Tom profissional, construtivo e acionável.`;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message || "erro na IA" });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    res.json({ result: JSON.parse(clean) });
  } catch (e) {
    console.error("Erro IA:", e);
    res.status(502).json({ error: "não foi possível gerar a análise agora" });
  }
});

function buildAIPayload(records, users) {
  const lines = users.map((u) => {
    const rs = records.filter((r) => r.colaboradoraId === u.id);
    if (rs.length === 0) return `- ${u.nome || u.login}: nenhum atendimento registrado`;
    const resolv = rs.filter((r) => r.status === "resolvido").length;
    const and = rs.filter((r) => r.status === "andamento").length;
    const pen = rs.filter((r) => r.status === "pendente").length;
    const taxa = Math.round((resolv / rs.length) * 100);
    const assuntos = {};
    rs.forEach((r) => { const k = r.assunto || "outros"; assuntos[k] = (assuntos[k] || 0) + 1; });
    const topA = Object.entries(assuntos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, n]) => `${a} (${n})`).join(", ");
    return `- ${u.nome || u.login}: ${rs.length} atendimentos | ${resolv} resolvidos, ${and} em andamento, ${pen} pendentes | taxa de resolução ${taxa}% | principais assuntos: ${topA}`;
  });
  const total = records.length;
  const totalRes = records.filter((r) => r.status === "resolvido").length;
  return `Total geral: ${total} atendimentos | Taxa de resolução do setor: ${total ? Math.round((totalRes / total) * 100) : 0}%\n\nPor colaboradora:\n${lines.join("\n")}`;
}

function buildIndividualPayload(records, tasks, alvo) {
  const rs = records.filter((r) => r.colaboradoraId === alvo.id);
  const resolv = rs.filter((r) => r.status === "resolvido").length;
  const and = rs.filter((r) => r.status === "andamento").length;
  const pen = rs.filter((r) => r.status === "pendente").length;
  const taxa = rs.length ? Math.round((resolv / rs.length) * 100) : 0;
  const assuntos = {};
  rs.forEach((r) => { const k = r.assunto || "outros"; assuntos[k] = (assuntos[k] || 0) + 1; });
  const topA = Object.entries(assuntos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a, n]) => `${a} (${n})`).join(", ") || "nenhum";

  // tarefas atribuídas a ela
  const ts = (tasks || []).filter((t) => t.responsavelId === alvo.id);
  const tConcl = ts.filter((t) => t.concluida).length;
  const hoje = new Date().toISOString().slice(0, 10);
  const tAtrasadas = ts.filter((t) => !t.concluida && t.prazo && t.prazo < hoje).length;

  // média geral do setor para comparação
  const totalSetor = records.length;
  const resSetor = records.filter((r) => r.status === "resolvido").length;
  const taxaSetor = totalSetor ? Math.round((resSetor / totalSetor) * 100) : 0;

  return `Nome: ${alvo.nome || alvo.login}
Atendimentos: ${rs.length} no total
- Resolvidos: ${resolv}
- Em andamento: ${and}
- Pendentes: ${pen}
- Taxa de resolução individual: ${taxa}%
Principais assuntos que ela atende: ${topA}

Tarefas atribuídas: ${ts.length} (${tConcl} concluídas, ${tAtrasadas} atrasadas)

Comparação com o setor: a taxa de resolução média do setor é ${taxaSetor}%. A dela é ${taxa}%.`;
}

// ---------------------------------------------------------------------------
// WHATSAPP (integração com Evolution API)
// ---------------------------------------------------------------------------

// helper: normaliza um número de telefone (tira sufixos do whatsapp)
function normalizeJid(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0];
}

// ---- WEBHOOK: a Evolution chama aqui quando chega/sai mensagem ----
// Não exige login (é a Evolution chamando), mas valida um token simples na URL.
app.post("/api/wa/webhook/:token", (req, res) => {
  // valida o token configurado (evita qualquer um chamar)
  const expected = db.waConfig?.webhookToken;
  if (expected && req.params.token !== expected) {
    return res.status(403).json({ error: "token inválido" });
  }

  try {
    const body = req.body || {};
    const event = body.event || body.type || "";
    const instance = body.instance || body.instanceName || "";

    // a Evolution manda eventos de mensagem como "messages.upsert"
    if (event === "messages.upsert" || event === "messages.update" || body.data?.message) {
      const data = body.data || {};
      const key = data.key || {};
      const remoteJid = key.remoteJid || "";
      const numero = normalizeJid(remoteJid);
      if (numero && !remoteJid.includes("@g.us")) {  // ignora grupos por enquanto
        const fromMe = !!key.fromMe;
        // extrai o texto da mensagem (vários formatos possíveis)
        const msg = data.message || {};
        const texto =
          msg.conversation ||
          msg.extendedTextMessage?.text ||
          msg.imageMessage?.caption ||
          msg.videoMessage?.caption ||
          (msg.audioMessage ? "[áudio]" : "") ||
          (msg.imageMessage ? "[imagem]" : "") ||
          (msg.documentMessage ? "[documento]" : "") ||
          "";
        const pushName = data.pushName || "";
        const ts = (data.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now());

        if (!db.waChats[numero]) {
          db.waChats[numero] = { numero, nome: pushName || numero, instance, mensagens: [], atualizadoEm: ts, naoLidas: 0 };
        }
        const chat = db.waChats[numero];
        if (pushName && !fromMe) chat.nome = pushName;
        chat.instance = instance || chat.instance;
        chat.mensagens.push({ id: key.id || (Date.now() + "-" + Math.random()), fromMe, texto, ts });
        // mantém só as últimas 200 mensagens por conversa (evita crescer demais)
        if (chat.mensagens.length > 200) chat.mensagens = chat.mensagens.slice(-200);
        chat.atualizadoEm = ts;
        if (!fromMe) chat.naoLidas = (chat.naoLidas || 0) + 1;
        saveDB(db);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro no webhook WA:", e.message);
    res.json({ ok: true }); // sempre 200 pra Evolution não ficar reenviando
  }
});

// ---- CONFIG: salvar dados da conexão (admin) ----
app.get("/api/wa/config", requireAuth, (req, res) => {
  if (!req.isAdmin && !can(req, "gerir_whatsapp")) return res.status(403).json({ error: "sem permissão" });
  const c = db.waConfig || {};
  res.json({ config: {
    url: c.url || "",
    webhookToken: c.webhookToken || "",
    temApiKey: !!c.apiKey,
    conectado: !!c.url,
    instancias: c.instancias || [],   // [{ instance, colaboradoraId, colaboradoraNome }]
  } });
});

app.put("/api/wa/config", requireAuth, (req, res) => {
  if (!req.isAdmin && !can(req, "gerir_whatsapp")) return res.status(403).json({ error: "sem permissão" });
  const { url, apiKey, instancias } = req.body;
  db.waConfig = db.waConfig || {};
  if (url !== undefined) db.waConfig.url = String(url).trim().replace(/\/$/, "");
  if (apiKey !== undefined && apiKey) db.waConfig.apiKey = String(apiKey).trim();
  if (Array.isArray(instancias)) {
    // limpa e normaliza a lista de instâncias
    db.waConfig.instancias = instancias
      .filter((i) => i && i.instance && String(i.instance).trim())
      .map((i) => ({
        instance: String(i.instance).trim(),
        colaboradoraId: i.colaboradoraId || "",
        colaboradoraNome: i.colaboradoraNome || "",
      }));
  }
  // gera um token de webhook se ainda não tiver
  if (!db.waConfig.webhookToken) db.waConfig.webhookToken = crypto.randomBytes(12).toString("hex");
  // guarda a URL pública do próprio sistema (para montar o webhook automaticamente)
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) db.waConfig.publicUrl = `${proto}://${host}`;
  saveDB(db);
  res.json({ ok: true, webhookToken: db.waConfig.webhookToken });
});

// helper: quais instâncias o usuário logado pode ver
// - admin (gerente) ou quem gerencia whatsapp: vê todas
// - colaboradora comum: só as instâncias vinculadas a ela
function instanciasVisiveis(req) {
  const todas = db.waConfig?.instancias || [];
  if (req.isAdmin || can(req, "gerir_whatsapp")) return null; // null = todas
  return todas.filter((i) => String(i.colaboradoraId) === String(req.user.id)).map((i) => i.instance);
}

// ---- listar conversas (com filtro opcional por instância) ----
app.get("/api/wa/chats", requireAuth, (req, res) => {
  const filtroInstance = req.query.instance || "";   // filtra por atendente
  const permitidas = instanciasVisiveis(req);          // null = todas
  const instMap = {};
  (db.waConfig?.instancias || []).forEach((i) => { instMap[i.instance] = i.colaboradoraNome || i.instance; });
  let chats = Object.values(db.waChats || {})
    .map((c) => ({
      numero: c.numero,
      nome: c.nome,
      instance: c.instance,
      atendente: instMap[c.instance] || c.instance || "",   // nome da colaboradora
      atualizadoEm: c.atualizadoEm,
      naoLidas: c.naoLidas || 0,
      ultima: c.mensagens?.[c.mensagens.length - 1]?.texto || "",
    }))
    .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
  // PRIVACIDADE: colaboradora só vê conversas das instâncias dela
  if (permitidas !== null) chats = chats.filter((c) => permitidas.includes(c.instance));
  if (filtroInstance) chats = chats.filter((c) => c.instance === filtroInstance);
  // a colaboradora só vê suas instâncias no filtro também
  const instParaFiltro = (permitidas === null)
    ? (db.waConfig?.instancias || [])
    : (db.waConfig?.instancias || []).filter((i) => permitidas.includes(i.instance));
  res.json({ chats, instancias: instParaFiltro });
});

// ---- ver mensagens de uma conversa ----
app.get("/api/wa/chats/:numero", requireAuth, (req, res) => {
  const chat = db.waChats?.[req.params.numero];
  if (!chat) return res.status(404).json({ error: "conversa não encontrada" });
  // PRIVACIDADE: bloqueia abrir conversa de instância que não é da pessoa
  const permitidas = instanciasVisiveis(req);
  if (permitidas !== null && !permitidas.includes(chat.instance)) {
    return res.status(403).json({ error: "sem acesso a esta conversa" });
  }
  // zera não-lidas ao abrir
  chat.naoLidas = 0;
  saveDB(db);
  res.json({ chat });
});

// ---- criar instância + obter QR code (conecta um WhatsApp pelo sistema) ----
app.post("/api/wa/instance/connect", requireAuth, async (req, res) => {
  if (!req.isAdmin && !can(req, "gerir_whatsapp")) return res.status(403).json({ error: "sem permissão" });
  const { instance } = req.body;
  const c = db.waConfig || {};
  if (!c.url || !c.apiKey) return res.status(400).json({ error: "Configure a URL e a chave da Evolution primeiro" });
  if (!instance || !String(instance).trim()) return res.status(400).json({ error: "informe o nome da instância" });
  const nome = String(instance).trim();
  // monta a URL do webhook (pra Evolution já avisar o sistema sozinha)
  const base = c.publicUrl || "";
  const webhookUrl = (base && c.webhookToken) ? `${base}/api/wa/webhook/${c.webhookToken}` : "";

  try {
    // 1) tenta criar a instância (se já existir, a Evolution retorna erro, e a gente segue pro connect)
    const criarPayload = {
      instanceName: nome,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      groupsIgnore: true,
    };
    if (webhookUrl) {
      criarPayload.webhook = { url: webhookUrl, byEvents: false, events: ["MESSAGES_UPSERT"] };
    }
    let createData = null;
    const rc = await fetch(`${c.url}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": c.apiKey },
      body: JSON.stringify(criarPayload),
    });
    createData = await rc.json().catch(() => ({}));
    // se veio o QR já na criação, devolve direto
    const qrFromCreate = createData?.qrcode?.base64 || null;
    if (qrFromCreate) {
      // garante o webhook setado (algumas versões ignoram no create)
      if (webhookUrl) await setWebhook(c, nome, webhookUrl);
      return res.json({ qr: qrFromCreate, status: "connecting" });
    }

    // 2) senão, chama o connect pra pegar o QR
    if (webhookUrl) await setWebhook(c, nome, webhookUrl);
    const rq = await fetch(`${c.url}/instance/connect/${nome}`, {
      method: "GET",
      headers: { "apikey": c.apiKey },
    });
    const qrData = await rq.json().catch(() => ({}));
    const qr = qrData?.base64 || qrData?.qrcode?.base64 || null;
    if (qr) return res.json({ qr, status: "connecting" });

    // já conectado?
    if (qrData?.instance?.state === "open" || createData?.instance?.state === "open") {
      return res.json({ qr: null, status: "open" });
    }
    return res.json({ qr: null, status: "connecting", aviso: "QR não retornado ainda, tente novamente em alguns segundos." });
  } catch (e) {
    console.error("Erro ao conectar instância:", e.message);
    res.status(502).json({ error: "não foi possível falar com a Evolution" });
  }
});

// helper: configura o webhook de uma instância na Evolution
async function setWebhook(c, nome, webhookUrl) {
  try {
    await fetch(`${c.url}/webhook/set/${nome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": c.apiKey },
      body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, events: ["MESSAGES_UPSERT"] } }),
    });
  } catch (e) { /* não bloqueia o fluxo */ }
}

// ---- checar status de conexão de uma instância ----
app.get("/api/wa/instance/status/:nome", requireAuth, async (req, res) => {
  const c = db.waConfig || {};
  if (!c.url || !c.apiKey) return res.status(400).json({ error: "não configurado" });
  try {
    const r = await fetch(`${c.url}/instance/connectionState/${req.params.nome}`, {
      method: "GET", headers: { "apikey": c.apiKey },
    });
    const data = await r.json().catch(() => ({}));
    const state = data?.instance?.state || data?.state || "unknown";
    res.json({ state });   // "open" = conectado, "connecting", "close"
  } catch (e) {
    res.json({ state: "unknown" });
  }
});

// ---- enviar mensagem (pela Evolution) ----
app.post("/api/wa/send", requireAuth, async (req, res) => {
  const { numero, texto } = req.body;
  const c = db.waConfig || {};
  if (!c.url || !c.apiKey) return res.status(400).json({ error: "WhatsApp não configurado" });
  if (!numero || !texto?.trim()) return res.status(400).json({ error: "número e texto obrigatórios" });
  // descobre a instância: a da própria conversa, ou a primeira configurada
  const chatExistente = db.waChats?.[numero];
  const instance = chatExistente?.instance || (c.instancias?.[0]?.instance) || "";
  if (!instance) return res.status(400).json({ error: "nenhuma instância configurada" });
  // PRIVACIDADE: colaboradora só pode enviar por instância dela
  const permitidas = instanciasVisiveis(req);
  if (permitidas !== null && !permitidas.includes(instance)) {
    return res.status(403).json({ error: "sem acesso a esta conversa" });
  }
  try {
    const r = await fetch(`${c.url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": c.apiKey },
      body: JSON.stringify({ number: numero, text: texto.trim() }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.message || "falha ao enviar" });
    // registra na conversa
    if (db.waChats[numero]) {
      db.waChats[numero].mensagens.push({ id: Date.now() + "-out", fromMe: true, texto: texto.trim(), ts: Date.now() });
      db.waChats[numero].atualizadoEm = Date.now();
      saveDB(db);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro ao enviar WA:", e.message);
    res.status(502).json({ error: "não foi possível enviar agora" });
  }
});

// ---------------------------------------------------------------------------
// Servir o frontend buildado
// ---------------------------------------------------------------------------
const distPath = join(ROOT, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "rota não encontrada" });
    res.sendFile(join(distPath, "index.html"));
  });
}

// inicia tudo (espera volume → carrega banco → cria admin → sobe servidor)
iniciar();
