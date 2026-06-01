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
};
