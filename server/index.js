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

// garante que a pasta do arquivo existe (ex.: /data)
try {
  const dir = dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
} catch (e) { console.error("Não consegui criar a pasta do banco:", e.message); }

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch (e) { console.error("Erro ao ler banco:", e.message); }
  return { users: [], records: [], sessions: {} };
}
function saveDB(db) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
  catch (e) { console.error("Erro ao salvar banco:", e.message); }
}

let db = loadDB();

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
// IA — análise de desempenho (chave protegida no servidor)
// ---------------------------------------------------------------------------
app.post("/api/analise", requireAuth, async (req, res) => {
  if (!can(req, "ia")) return res.status(403).json({ error: "sem permissão" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "IA não configurada (defina ANTHROPIC_API_KEY no Railway)" });

  const users = db.users.filter((u) => u.ativo);
  const records = db.records;
  const resumo = buildAIPayload(records, users);

  const prompt = `Você é um especialista em gestão de equipes de atendimento ao cliente / suporte ao aluno. Analise os dados de desempenho da equipe abaixo e produza um relatório gerencial em português do Brasil.

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✓ Servidor rodando na porta ${PORT}`));
