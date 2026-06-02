// Camada de comunicação com o backend.
// Guarda o token em memória + localStorage para manter login entre recarregamentos.

let token = localStorage.getItem("instructiva_token") || null;

function setToken(t) {
  token = t;
  if (t) localStorage.setItem("instructiva_token", t);
  else localStorage.removeItem("instructiva_token");
}

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch("/api" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || "erro na requisição");
  return data;
}

export const api = {
  get token() { return token; },
  setToken,
  // auth
  login: (login, senha) => req("POST", "/login", { login, senha }),
  logout: () => req("POST", "/logout"),
  me: () => req("GET", "/me"),
  updateMe: (payload) => req("PUT", "/me", payload),
  // users
  listUsers: () => req("GET", "/users"),
  listUserNames: () => req("GET", "/users/names"),
  createUser: (payload) => req("POST", "/users", payload),
  updateUser: (id, payload) => req("PUT", "/users/" + id, payload),
  deleteUser: (id) => req("DELETE", "/users/" + id),
  // records
  listRecords: () => req("GET", "/records"),
  createRecord: (payload) => req("POST", "/records", payload),
  deleteRecord: (id) => req("DELETE", "/records/" + id),
  // tasks
  listTasks: () => req("GET", "/tasks"),
  createTask: (payload) => req("POST", "/tasks", payload),
  updateTask: (id, payload) => req("PUT", "/tasks/" + id, payload),
  deleteTask: (id) => req("DELETE", "/tasks/" + id),
  // ia
  analise: (colaboradoraId) => req("POST", "/analise", colaboradoraId ? { colaboradoraId } : {}),
  // whatsapp
  waGetConfig: () => req("GET", "/wa/config"),
  waSetConfig: (payload) => req("PUT", "/wa/config", payload),
  waListChats: (instance) => req("GET", "/wa/chats" + (instance ? "?instance=" + encodeURIComponent(instance) : "")),
  waGetChat: (id) => req("GET", "/wa/chats/" + encodeURIComponent(id)),
  waSend: (id, texto) => req("POST", "/wa/send", { id, texto }),
  waSendMedia: (payload) => req("POST", "/wa/send-media", payload),
  waSendAudio: (id, base64) => req("POST", "/wa/send-audio", { id, base64 }),
  waConnectInstance: (instance) => req("POST", "/wa/instance/connect", { instance }),
  waInstanceStatus: (nome) => req("GET", "/wa/instance/status/" + encodeURIComponent(nome)),
  waMinhaInstancia: () => req("GET", "/wa/minha-instancia"),
  waLogoutInstance: (nome) => req("POST", "/wa/instance/logout/" + encodeURIComponent(nome)),
  waDeleteInstance: (nome) => req("DELETE", "/wa/instance/" + encodeURIComponent(nome)),
  waLimparFantasmas: () => req("POST", "/wa/limpar-fantasmas"),
};
