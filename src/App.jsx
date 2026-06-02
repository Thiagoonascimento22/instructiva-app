import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, ClipboardList, PlusCircle, Search, Trash2, Download,
  Users, CheckCircle2, Clock, AlertCircle, X, Filter, Sparkles, LogOut,
  Shield, UserPlus, Lock, Eye, EyeOff, Settings, TrendingUp, Award,
  Crown, ChevronRight, Activity, Zap, Target, Brain, Star, AlertTriangle,
  Sun, Moon, ListTodo, CalendarClock, Flag, Circle, ArrowLeft, UserCircle,
  MessageCircle, Send, Link2, RefreshCw, Phone, PlusSquare,
} from "lucide-react";
import { LOGO_FULL, LOGO_CLARO, LOGO_ICONE } from "./logos";
import { api } from "./api";

const STATUS = {
  resolvido: { label: "Resolvido", color: "#12A150", bg: "rgba(18,161,80,0.12)", icon: CheckCircle2 },
  andamento: { label: "Em andamento", color: "#F39200", bg: "rgba(243,146,0,0.14)", icon: Clock },
  pendente: { label: "Pendente", color: "#E5484D", bg: "rgba(229,72,77,0.12)", icon: AlertCircle },
};
// paleta de gráficos derivada da marca (laranja + cinzas + apoios sóbrios)
const PALETTE = ["#F39200", "#6E7073", "#E8A93C", "#9A9CA0", "#C97A1A", "#B5B7BA", "#12A150", "#5B8DB8"];

function emptyForm() {
  return { data: new Date().toISOString().slice(0, 10), aluno: "", email: "", telefone: "", assunto: "", solucao: "", status: "resolvido", obs: "" };
}
const PERM_LABELS = {
  registrar: "Registrar atendimentos",
  ver_todos: "Ver atendimentos de todas",
  excluir: "Excluir registros",
  exportar: "Exportar dados (CSV)",
  ia: "Acessar análise por IA",
  gerir_usuarios: "Gerenciar usuários",
};

// =============================================================================
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState(null);          // usuário logado
  const [users, setUsers] = useState([]);      // lista de nomes (para tabelas) ou completa (admin)
  const [records, setRecords] = useState([]);
  const [view, setView] = useState("dashboard");
  const [waPrefill, setWaPrefill] = useState(null);   // pré-preenche Novo Registro a partir do WhatsApp
  const [theme, setTheme] = useState(() => localStorage.getItem("instructiva_theme") || "light");

  const isAdmin = me?.role === "admin";
  const can = (p) => isAdmin || me?.perms?.[p];

  useEffect(() => { localStorage.setItem("instructiva_theme", theme); }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // ao carregar: se tem token salvo, busca o usuário
  useEffect(() => {
    (async () => {
      if (api.token) {
        try { const { user } = await api.me(); setMe(user); } catch { api.setToken(null); }
      }
      setLoaded(true);
    })();
  }, []);

  // sempre que houver usuário logado, carrega dados (nomes + registros)
  async function refreshData() {
    try {
      const namesResp = await api.listUserNames();
      setUsers(namesResp.users);
    } catch {}
    try {
      const recsResp = await api.listRecords();
      setRecords(recsResp.records);
    } catch {}
  }
  useEffect(() => { if (me) refreshData(); }, [me]);

  const visibleRecords = records; // o backend já filtra por permissão

  async function login(loginStr, senhaStr) {
    try {
      const { token, user } = await api.login(loginStr, senhaStr);
      api.setToken(token);
      setMe(user);
      setView("dashboard");
      return true;
    } catch { return false; }
  }
  async function logout() {
    try { await api.logout(); } catch {}
    api.setToken(null);
    setMe(null);
    setUsers([]); setRecords([]);
  }
  async function setMyName(nome) {
    try { const { user } = await api.updateMe({ nome }); setMe(user); } catch {}
  }

  if (!loaded) return <div style={{ ...SX.app, display: "grid", placeItems: "center" }}><style>{CSS}</style><img src={LOGO_FULL} alt="Instructiva" style={{ width: 200, opacity: 0.5 }} className="pulse" /></div>;
  if (!me) return <Login onLogin={login} />;

  // primeiro acesso da gerente sem nome definido → onboarding
  if (isAdmin && !me.nome) return <Onboarding onSave={setMyName} />;

  const nav = [];
  nav.push(["dashboard", "Dashboard", LayoutDashboard]);
  nav.push(["lista", "Atendimentos", ClipboardList]);
  if (can("registrar")) nav.push(["novo", "Novo Registro", PlusCircle]);
  nav.push(["tarefas", "Tarefas", ListTodo]);
  nav.push(["whatsapp", "WhatsApp", MessageCircle]);
  if (can("ia")) nav.push(["ia", "Análise IA", Sparkles, true]);
  if (can("gerir_usuarios")) nav.push(["equipe", "Equipe & Acessos", Shield]);
  if (isAdmin) nav.push(["config", "Configurações", Settings]);

  return (
    <div style={SX.app} className={`app-root theme-${theme}`}>
      <style>{CSS}</style>
      <div style={SX.bgGlow} className="bg-glow" />

      <aside style={SX.sidebar} className="sidebar">
        <div style={SX.brand}>
          <img src={LOGO_CLARO} alt="Instructiva" style={SX.brandLogo} />
        </div>
        <div style={SX.brandTag}>Suporte ao Aluno</div>

        <nav style={SX.nav}>
          {nav.map(([id, label, Icon, glow]) => (
            <button key={id} onClick={() => setView(id)} className="navbtn"
              style={{ ...SX.navBtn, ...(view === id ? SX.navBtnActive : {}) }}>
              <Icon size={18} strokeWidth={2} />
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {glow && <span className="ai-dot" />}
              {view === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>

        <button onClick={toggleTheme} className="theme-toggle" style={SX.themeToggle} title="Alternar tema">
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === "light" ? "Modo escuro" : "Modo claro"}</span>
        </button>

        <div style={SX.userCard} className="user-card">
          <div style={SX.avatar}>{initials(me.nome)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={SX.userName} className="user-name">{me.nome}</div>
            <div style={SX.userRole}>{isAdmin ? <><Crown size={11} /> Administradora</> : "Colaboradora"}</div>
          </div>
          <button onClick={logout} className="logout-btn" style={SX.logoutBtn} title="Sair"><LogOut size={16} /></button>
        </div>
      </aside>

      <main style={SX.main}>
        <div className="fade-in" key={view}>
          {view === "dashboard" && <Dashboard records={visibleRecords} users={users} me={me} isAdmin={isAdmin} />}
          {view === "lista" && <Lista records={visibleRecords} users={users} can={can} refresh={refreshData} goNew={() => setView("novo")} />}
          {view === "novo" && can("registrar") && <NovoRegistro me={me} isAdmin={isAdmin} users={users} refresh={refreshData} prefill={waPrefill} onDone={() => { setWaPrefill(null); setView("lista"); }} />}
          {view === "tarefas" && <Tarefas me={me} isAdmin={isAdmin} can={can} users={users} />}
          {view === "whatsapp" && <WhatsApp me={me} isAdmin={isAdmin} can={can} goNovo={(pre) => { setWaPrefill(pre); setView("novo"); }} />}
          {view === "ia" && can("ia") && <AnaliseIA records={records} users={users} />}
          {view === "equipe" && can("gerir_usuarios") && <Equipe refresh={refreshData} />}
          {view === "config" && isAdmin && <Config me={me} onUpdated={setMe} />}
        </div>
      </main>
    </div>
  );
}

// ============================================================= ONBOARDING
function Onboarding({ onSave }) {
  const [nome, setNome] = useState("");
  return (
    <div style={SX.loginWrap}>
      <style>{CSS}</style>
      <div style={SX.loginGlow} />
      <div style={SX.loginCard} className="login-rise">
        <img src={LOGO_FULL} alt="Instructiva" style={{ width: 190, display: "block", margin: "0 auto 6px" }} />
        <div style={SX.onbIcon}><Sparkles size={22} color="#F39200" /></div>
        <h2 style={SX.onbTitle}>Bem-vinda! 👋</h2>
        <p style={SX.onbText}>Como você gostaria de ser chamada no sistema? Esse nome vai aparecer no seu painel e nos relatórios.</p>
        <label style={{ ...SX.loginLabel, marginTop: 20 }}>Seu nome</label>
        <div style={SX.loginField}>
          <Users size={17} color="#A0A2A6" />
          <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && nome.trim() && onSave(nome.trim())}
            placeholder="Ex: Maria Silva" style={SX.loginInput} autoFocus />
        </div>
        <button onClick={() => nome.trim() && onSave(nome.trim())} disabled={!nome.trim()} className="login-cta"
          style={{ ...SX.loginBtn, opacity: nome.trim() ? 1 : 0.5, cursor: nome.trim() ? "pointer" : "not-allowed" }}>
          Continuar <ChevronRight size={18} />
        </button>
        <p style={SX.onbHint}>Você pode alterar isso depois em Configurações.</p>
      </div>
    </div>
  );
}

// ============================================================= LOGIN
function Login({ onLogin }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);

  async function submit() { if (!(await onLogin(login, senha))) { setErr(true); setTimeout(() => setErr(false), 2000); } }
  return (
    <div style={SX.loginWrap}>
      <style>{CSS}</style>
      <div style={SX.loginGlow} />
      <div style={SX.loginCard} className="login-rise">
        <img src={LOGO_FULL} alt="Instructiva" style={{ width: 210, display: "block", margin: "0 auto" }} />
        <p style={SX.loginSub}>Sistema de Controle de Atendimento ao Aluno</p>

        <div style={{ marginTop: 26 }}>
          <label style={SX.loginLabel}>Usuário</label>
          <div style={SX.loginField}>
            <Users size={17} color="#A0A2A6" />
            <input value={login} onChange={(e) => setLogin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="seu usuário" style={SX.loginInput} autoFocus />
          </div>
          <label style={{ ...SX.loginLabel, marginTop: 16 }}>Senha</label>
          <div style={SX.loginField}>
            <Lock size={17} color="#A0A2A6" />
            <input type={show ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="sua senha" style={SX.loginInput} />
            <button onClick={() => setShow(!show)} style={SX.eyeBtn}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {err && <div className="shake" style={SX.loginErr}><AlertCircle size={14} /> Usuário ou senha incorretos</div>}
          <button onClick={submit} className="login-cta" style={SX.loginBtn}>Entrar <ChevronRight size={18} /></button>
        </div>

        <div style={SX.loginHint}><strong>Primeiro acesso (gerente):</strong> usuário <code style={SX.code}>gerente</code> · senha <code style={SX.code}>admin123</code></div>
      </div>
      <div style={SX.loginFoot}>Instructiva · Painel de gestão de suporte</div>
    </div>
  );
}

// ============================================================= DASHBOARD
function Dashboard({ records, users, me, isAdmin }) {
  const stats = useMemo(() => buildStats(records, users), [records, users]);
  const hora = new Date().getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = me.nome.split(" ")[0];

  if (records.length === 0) {
    return (<div><Header title={`${saud}, ${primeiroNome} 👋`} subtitle={isAdmin ? "Painel geral do setor de suporte" : "Seus atendimentos"} /><Empty /></div>);
  }
  return (
    <div>
      <Header title={`${saud}, ${primeiroNome} 👋`} subtitle={isAdmin ? "Painel geral do setor de suporte" : "Resumo dos seus atendimentos"} />

      <div style={SX.kpiGrid}>
        <Kpi i={ClipboardList} c="#F39200" v={stats.total} l="Total de atendimentos" d={0} />
        <Kpi i={CheckCircle2} c="#12A150" v={stats.byStatus.resolvido} l="Resolvidos" d={1} />
        <Kpi i={Clock} c="#E8A93C" v={stats.byStatus.andamento} l="Em andamento" d={2} />
        <Kpi i={isAdmin ? Users : Target} c="#6E7073" v={isAdmin ? stats.byColab.length : stats.byStatus.pendente} l={isAdmin ? "Colaboradoras ativas" : "Pendentes"} d={3} />
      </div>

      <div style={SX.taxaCard} className="rise panel">
        <div style={SX.taxaShine} />
        <div style={{ position: "relative" }}>
          <div style={SX.taxaLabel}><Award size={18} /> Taxa de Resolução</div>
          <div style={SX.taxaSub}>{stats.byStatus.resolvido} de {stats.total} atendimentos concluídos</div>
        </div>
        <div style={SX.taxaRight}>
          <div style={SX.taxaTrack}><div style={{ ...SX.taxaFill, width: `${stats.taxa}%` }} /></div>
          <div style={SX.taxaPct} className="taxa-pct">{stats.taxa}<span style={{ fontSize: 18 }}>%</span></div>
        </div>
      </div>

      <div style={SX.chartGrid}>
        {isAdmin && (
          <CardBox title="Atendimentos por colaboradora" sub="volume individual">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.byColab} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A8C90" }} interval={0} angle={-15} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8C90" }} allowDecimals={false} />
                <Tooltip contentStyle={TT} cursor={{ fill: "rgba(243,146,0,0.06)" }} />
                <Bar dataKey="value" name="Atendimentos" radius={[7, 7, 0, 0]} maxBarSize={46}>
                  {stats.byColab.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBox>
        )}

        <CardBox title="Distribuição por status" sub="situação atual">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stats.statusData} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={56} outerRadius={92} paddingAngle={4} cornerRadius={6}>
                {stats.statusData.map((d) => <Cell key={d.key} fill={STATUS[d.key].color} />)}
              </Pie>
              <Tooltip contentStyle={TT} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardBox>

        <CardBox title="Evolução de atendimentos" sub="últimos dias" wide={isAdmin}>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={stats.byDay} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <defs>
                <linearGradient id="ar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F39200" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#F39200" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF0" vertical={false} />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#8A8C90" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8A8C90" }} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="value" name="Atendimentos" stroke="#F39200" strokeWidth={2.5} fill="url(#ar)" dot={{ r: 3, fill: "#F39200" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardBox>

        <CardBox title="Principais assuntos" sub="o que mais aparece" wide={!isAdmin}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={stats.byAssunto} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEEEF0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#8A8C90" }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#8A8C90" }} width={130} />
              <Tooltip contentStyle={TT} cursor={{ fill: "rgba(243,146,0,0.06)" }} />
              <Bar dataKey="value" name="Ocorrências" radius={[0, 7, 7, 0]} maxBarSize={26}>
                {stats.byAssunto.map((_, i) => <Cell key={i} fill={PALETTE[(i + 1) % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardBox>
      </div>
    </div>
  );
}

function Kpi({ i: Icon, c, v, l, d }) {
  return (
    <div style={{ ...SX.kpiCard, animationDelay: `${d * 0.07}s` }} className="kpi card-hover panel">
      <div style={{ ...SX.kpiIcon, background: c + "1c", color: c }}><Icon size={22} strokeWidth={2.2} /></div>
      <div><div style={SX.kpiValue} className="kpi-value">{v}</div><div style={SX.kpiLabel}>{l}</div></div>
    </div>
  );
}

// ============================================================= ANÁLISE IA
function AnaliseIA({ records, users }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState("equipe");        // equipe | individual
  const [colabSel, setColabSel] = useState("");      // id da colaboradora p/ análise individual

  const colabs = users.filter((u) => u.role !== "admin");
  const stats = useMemo(() => buildStats(records, users), [records, users]);

  async function analisar() {
    if (modo === "individual" && !colabSel) { setError("Escolha uma colaboradora para analisar."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const { result } = await api.analise(modo === "individual" ? colabSel : null);
      setResult(result);
    } catch (e) {
      setError(e.message || "Não consegui gerar a análise agora. Tente novamente em instantes.");
    } finally { setLoading(false); }
  }

  // ao trocar de modo, limpa o resultado anterior
  function trocarModo(m) { setModo(m); setResult(null); setError(null); }

  const AVAL = {
    "Excelente": { c: "#12A150", bg: "rgba(18,161,80,0.1)", icon: Star },
    "Bom": { c: "#F39200", bg: "rgba(243,146,0,0.12)", icon: TrendingUp },
    "Regular": { c: "#C97A1A", bg: "rgba(201,122,26,0.1)", icon: Activity },
    "Precisa atenção": { c: "#E5484D", bg: "rgba(229,72,77,0.1)", icon: AlertTriangle },
  };

  return (
    <div>
      <Header title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Brain size={28} color="#F39200" /> Análise Inteligente</span>}
        subtitle="A IA lê o desempenho e sugere melhorias" />

      {/* seletor de modo */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => trocarModo("equipe")} className="filter-chip" style={{ ...SX.filterChip, ...(modo === "equipe" ? SX.filterChipOn : {}) }}><Users size={14} /> Equipe inteira</button>
        <button onClick={() => trocarModo("individual")} className="filter-chip" style={{ ...SX.filterChip, ...(modo === "individual" ? SX.filterChipOn : {}) }}><UserCircle size={14} /> Colaboradora específica</button>
      </div>

      <div style={SX.aiHero} className="rise">
        <div style={SX.aiHeroGlow} />
        <div style={{ position: "relative", flex: 1 }}>
          <div style={SX.aiBadge}><Sparkles size={13} /> Inteligência Artificial</div>
          <h2 style={SX.aiHeroTitle}>{modo === "equipe" ? "Relatório gerencial da equipe" : "Análise individual de desempenho"}</h2>
          <p style={SX.aiHeroText}>
            {modo === "equipe"
              ? "A IA analisa volume, taxa de resolução, pendências e padrões de cada colaboradora, gerando uma leitura geral e recomendações para apresentar à diretoria."
              : "Escolha uma colaboradora e a IA gera um parecer focado: pontos fortes, pontos a melhorar, sugestões práticas e um feedback pronto para você passar a ela."}
          </p>

          {modo === "individual" && (
            <select value={colabSel} onChange={(e) => setColabSel(e.target.value)} style={{ ...SX.input, maxWidth: 320, marginBottom: 16 }}>
              <option value="">Selecione a colaboradora…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.role === "admin" ? " (você)" : ""}</option>)}
            </select>
          )}

          {modo === "equipe" && (
            <div style={SX.aiMeta}>
              <span><strong>{records.length}</strong> atendimentos</span><span style={SX.dot} />
              <span><strong>{colabs.length}</strong> colaboradoras</span><span style={SX.dot} />
              <span><strong>{stats.taxa}%</strong> resolução</span>
            </div>
          )}

          <button onClick={analisar} disabled={loading || records.length === 0} className="ai-cta"
            style={{ ...SX.aiCta, opacity: loading || records.length === 0 ? 0.6 : 1, cursor: loading || records.length === 0 ? "not-allowed" : "pointer" }}>
            {loading ? <><span className="spin"><Activity size={17} /></span> Analisando dados…</> : <><Sparkles size={17} /> {modo === "equipe" ? "Gerar análise da equipe" : "Gerar análise individual"}</>}
          </button>
          {records.length === 0 && <p style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 12 }}>Registre alguns atendimentos primeiro para a IA ter o que analisar.</p>}
        </div>
      </div>

      {error && <div style={SX.aiError}><AlertCircle size={16} /> {error}</div>}
      {loading && <div style={SX.aiLoading}>{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ ...SX.skel, animationDelay: `${i * 0.15}s` }} />)}</div>}

      {/* RESULTADO INDIVIDUAL */}
      {result && result.individual && (
        <div className="fade-in">
          <IndividualResult result={result} AVAL={AVAL} />
        </div>
      )}

      {/* RESULTADO DA EQUIPE */}
      {result && !result.individual && (
        <div className="fade-in">
          <div style={SX.aiPanorama} className="panel">
            <div style={SX.aiPanIcon}><Activity size={20} color="#F39200" /></div>
            <div><div style={SX.aiPanLabel}>Panorama do setor</div><p style={SX.aiPanText}>{result.panorama}</p></div>
          </div>

          <div style={SX.aiHighlights}>
            <div style={{ ...SX.aiHl, borderColor: "rgba(18,161,80,0.3)", background: "rgba(18,161,80,0.05)" }} className="ai-hl">
              <div style={{ ...SX.aiHlIcon, background: "rgba(18,161,80,0.14)", color: "#12A150" }}><Award size={18} /></div>
              <div><div style={SX.aiHlLabel}>Destaque</div><div style={SX.aiHlText}>{result.destaque}</div></div>
            </div>
            {result.atencao && (
              <div style={{ ...SX.aiHl, borderColor: "rgba(243,146,0,0.3)", background: "rgba(243,146,0,0.05)" }} className="ai-hl">
                <div style={{ ...SX.aiHlIcon, background: "rgba(243,146,0,0.14)", color: "#F39200" }}><Target size={18} /></div>
                <div><div style={SX.aiHlLabel}>Ponto de atenção</div><div style={SX.aiHlText}>{result.atencao}</div></div>
              </div>
            )}
          </div>

          <div style={SX.aiSectionTitle}><Users size={17} /> Leitura individual</div>
          <div style={SX.aiColabGrid}>
            {result.colaboradoras?.map((c, idx) => {
              const av = AVAL[c.avaliacao] || AVAL["Regular"]; const AvIcon = av.icon;
              return (
                <div key={idx} style={SX.aiColabCard} className="card-hover rise panel">
                  <div style={SX.aiColabHead}>
                    <div style={SX.aiColabAvatar}>{initials(c.nome)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={SX.aiColabName}>{c.nome}</div>
                      <span style={{ ...SX.aiAval, background: av.bg, color: av.c }}><AvIcon size={12} /> {c.avaliacao}</span>
                    </div>
                  </div>
                  <p style={SX.aiColabLeitura}>{c.leitura}</p>
                  <div style={SX.aiSugLabel}>Sugestões de melhoria</div>
                  <ul style={SX.aiSugList}>
                    {c.sugestoes?.map((s, i) => <li key={i} style={SX.aiSugItem}><Zap size={13} color="#F39200" style={{ flexShrink: 0, marginTop: 3 }} /> {s}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>

          <div style={SX.aiActions} className="ai-actions">
            <div style={SX.aiActionsTitle}><Target size={18} color="#F39200" /> Ações recomendadas para o setor</div>
            <div style={SX.aiActionsList}>
              {result.acoes_setor?.map((a, i) => <div key={i} style={SX.aiActionItem} className="ai-action-item"><span style={SX.aiActionNum}>{i + 1}</span> {a}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// resultado da análise individual
function IndividualResult({ result, AVAL }) {
  const av = AVAL[result.avaliacao] || AVAL["Regular"];
  const AvIcon = av.icon;
  return (
    <div>
      {/* cabeçalho da pessoa */}
      <div style={SX.indHead} className="panel">
        <div style={SX.indAvatar}>{initials(result.nome)}</div>
        <div style={{ flex: 1 }}>
          <div style={SX.indName}>{result.nome}</div>
          <span style={{ ...SX.aiAval, background: av.bg, color: av.c, marginTop: 6 }}><AvIcon size={13} /> {result.avaliacao}</span>
        </div>
      </div>

      {/* resumo */}
      <div style={SX.aiPanorama} className="panel">
        <div style={SX.aiPanIcon}><Activity size={20} color="#F39200" /></div>
        <div><div style={SX.aiPanLabel}>Resumo do desempenho</div><p style={SX.aiPanText}>{result.resumo}</p></div>
      </div>

      {/* pontos fortes + a melhorar */}
      <div style={SX.aiHighlights}>
        <div style={{ ...SX.indCol, borderColor: "rgba(18,161,80,0.3)" }} className="panel">
          <div style={SX.indColTitle}><Award size={16} color="#12A150" /> Pontos fortes</div>
          <ul style={SX.aiSugList}>
            {result.pontos_fortes?.map((s, i) => <li key={i} style={SX.aiSugItem}><CheckCircle2 size={13} color="#12A150" style={{ flexShrink: 0, marginTop: 3 }} /> {s}</li>)}
          </ul>
        </div>
        <div style={{ ...SX.indCol, borderColor: "rgba(243,146,0,0.3)" }} className="panel">
          <div style={SX.indColTitle}><Target size={16} color="#F39200" /> Pontos a melhorar</div>
          <ul style={SX.aiSugList}>
            {result.pontos_melhoria?.map((s, i) => <li key={i} style={SX.aiSugItem}><TrendingUp size={13} color="#F39200" style={{ flexShrink: 0, marginTop: 3 }} /> {s}</li>)}
          </ul>
        </div>
      </div>

      {/* sugestões */}
      <div style={SX.aiActions} className="ai-actions">
        <div style={SX.aiActionsTitle}><Zap size={18} color="#F39200" /> Sugestões práticas</div>
        <div style={SX.aiActionsList}>
          {result.sugestoes?.map((a, i) => <div key={i} style={SX.aiActionItem} className="ai-action-item"><span style={SX.aiActionNum}>{i + 1}</span> {a}</div>)}
        </div>
      </div>

      {/* feedback sugerido */}
      {result.feedback_sugerido && (
        <div style={SX.feedbackBox} className="panel feedback-box">
          <div style={SX.feedbackLabel}><Sparkles size={15} color="#F39200" /> Feedback sugerido para passar a ela</div>
          <p style={SX.feedbackText}>"{result.feedback_sugerido}"</p>
        </div>
      )}
    </div>
  );
}

// ============================================================= LISTA
function Lista({ records, users, can, refresh, goNew }) {
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fColab, setFColab] = useState("todas");

  const colabNames = useMemo(() => {
    const ids = new Set(records.map((r) => r.colaboradoraId));
    return users.filter((u) => ids.has(u.id));
  }, [records, users]);

  const filtered = useMemo(() => records.filter((r) => {
    if (fStatus !== "todos" && r.status !== fStatus) return false;
    if (fColab !== "todas" && r.colaboradoraId !== fColab) return false;
    if (q) { const h = `${r.aluno} ${r.email} ${r.assunto} ${r.solucao} ${r.obs}`.toLowerCase(); if (!h.includes(q.toLowerCase())) return false; }
    return true;
  }), [records, q, fStatus, fColab]);

  function exportCSV() {
    const headers = ["Data", "Colaboradora", "Aluno", "E-mail", "Telefone", "Assunto", "Solução", "Status", "Observações"];
    const rows = filtered.map((r) => [r.data, nameOf(users, r.colaboradoraId), r.aluno, r.email, r.telefone, r.assunto, r.solucao, STATUS[r.status]?.label, r.obs]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `atendimentos_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Header title="Atendimentos" subtitle={`${filtered.length} registro${filtered.length !== 1 ? "s" : ""}`}>
        {can("exportar") && <button onClick={exportCSV} className="btn-ghost" style={SX.btnGhost}><Download size={16} /> Exportar</button>}
        {can("registrar") && <button onClick={goNew} className="btn-primary" style={SX.btnPrimary}><PlusCircle size={16} /> Novo</button>}
      </Header>

      <div style={SX.filterBar}>
        <div style={SX.searchWrap}>
          <Search size={16} color="#A0A2A6" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno, e-mail, assunto…" style={SX.searchInput} />
          {q && <X size={15} color="#A0A2A6" style={{ cursor: "pointer" }} onClick={() => setQ("")} />}
        </div>
        {can("ver_todos") && <Sel value={fColab} onChange={setFColab} opts={[["todas", "Todas colaboradoras"], ...colabNames.map((u) => [u.id, u.nome])]} />}
        <Sel value={fStatus} onChange={setFStatus} opts={[["todos", "Todos status"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])]} />
      </div>

      {filtered.length === 0 ? (
        <div style={SX.noRes}><Filter size={26} color="#C9CACE" /><p style={{ margin: "10px 0 0", color: "#A0A2A6" }}>Nenhum atendimento encontrado.</p></div>
      ) : (
        <div style={SX.tableWrap}>
          <table style={SX.table}>
            <thead><tr>{["Data", "Colaboradora", "Aluno", "Contato", "Assunto", "Solução", "Status", ""].map((h) => <th key={h} style={SX.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r) => {
                const st = STATUS[r.status]; const Icon = st.icon;
                return (
                  <tr key={r.id} className="trow">
                    <td style={SX.td}><span style={SX.dataChip}>{fmtDate(r.data)}</span></td>
                    <td style={SX.td}><span style={SX.colabTag}><span style={SX.colabDot}>{initials(nameOf(users, r.colaboradoraId))}</span>{nameOf(users, r.colaboradoraId)}</span></td>
                    <td style={SX.td}>{r.aluno}</td>
                    <td style={SX.td}><div style={SX.contact}>{r.email && <span style={SX.cMain}>{r.email}</span>}{r.telefone && <span style={SX.cSub}>{r.telefone}</span>}</div></td>
                    <td style={SX.td}>{r.assunto}</td>
                    <td style={{ ...SX.td, maxWidth: 210 }}><span style={SX.trunc} title={r.solucao}>{r.solucao || "—"}</span></td>
                    <td style={SX.td}><span style={{ ...SX.pill, background: st.bg, color: st.color }}><Icon size={13} strokeWidth={2.5} /> {st.label}</span></td>
                    <td style={SX.td}>{can("excluir") && <button onClick={async () => { if (confirm("Excluir este atendimento?")) { try { await api.deleteRecord(r.id); refresh(); } catch (e) { alert(e.message); } } }} className="btn-del" style={SX.btnDel}><Trash2 size={15} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================= NOVO REGISTRO
function NovoRegistro({ me, isAdmin, users, refresh, onDone, prefill }) {
  const colabs = users.filter((u) => u.ativo);
  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    colaboradoraId: me.id,
    ...(prefill ? { telefone: prefill.telefone || "", aluno: prefill.nome || "" } : {}),
  }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.colaboradoraId && form.aluno && form.assunto;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.createRecord(form);
      await refresh();
      onDone();
    } catch (e) { alert(e.message); setSaving(false); }
  }
  return (
    <div>
      <Header title="Novo Registro" subtitle="Registrar um atendimento ao aluno" />
      <div style={SX.formCard} className="rise panel">
        <div style={SX.formGrid}>
          <F label="Data" req><input type="date" value={form.data} onChange={set("data")} style={SX.input} /></F>
          <F label="Colaboradora" req>
            {isAdmin ? (
              <select value={form.colaboradoraId} onChange={set("colaboradoraId")} style={SX.input}>
                {colabs.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.role === "admin" ? " (você)" : ""}</option>)}
              </select>
            ) : <input value={me.nome} disabled style={{ ...SX.input, background: "#F4F4F6", color: "#8A8C90" }} />}
          </F>
          <F label="Status" req><select value={form.status} onChange={set("status")} style={SX.input}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></F>
          <F label="Nome do Aluno" req><input value={form.aluno} onChange={set("aluno")} placeholder="Nome completo" style={SX.input} /></F>
          <F label="E-mail"><input type="email" value={form.email} onChange={set("email")} placeholder="email@exemplo.com" style={SX.input} /></F>
          <F label="Telefone"><input value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" style={SX.input} /></F>
          <F label="Assunto" req full><input value={form.assunto} onChange={set("assunto")} placeholder="Ex: Acesso ao portal, dúvida sobre matrícula…" style={SX.input} /></F>
          <F label="Solução Aplicada" full><textarea value={form.solucao} onChange={set("solucao")} placeholder="Descreva o que foi feito…" style={{ ...SX.input, minHeight: 82, resize: "vertical", paddingTop: 11 }} /></F>
          <F label="Observações" full><textarea value={form.obs} onChange={set("obs")} placeholder="Anotações adicionais (opcional)" style={{ ...SX.input, minHeight: 60, resize: "vertical", paddingTop: 11 }} /></F>
        </div>
        <div style={SX.formActions}>
          <button onClick={onDone} className="btn-ghost" style={SX.btnGhost}>Cancelar</button>
          <button onClick={save} disabled={!valid} className="btn-primary" style={{ ...SX.btnPrimary, opacity: valid ? 1 : 0.45, cursor: valid ? "pointer" : "not-allowed" }}><CheckCircle2 size={16} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================= EQUIPE & ACESSOS
function Equipe({ refresh }) {
  const [showNew, setShowNew] = useState(false);
  const blank = { nome: "", login: "", senha: "", perms: { registrar: true, ver_todos: false, excluir: false, exportar: false, ia: false, gerir_usuarios: false } };
  const [nf, setNf] = useState(blank);
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});

  async function load() {
    try {
      const { users } = await api.listUsers();
      setUsers(users);
    } catch (e) { /* sem permissão ou erro */ }
    try {
      const { records } = await api.listRecords();
      const c = {};
      records.forEach((r) => { c[r.colaboradoraId] = (c[r.colaboradoraId] || 0) + 1; });
      setCounts(c);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function addUser() {
    if (!nf.nome.trim() || !nf.login.trim() || !nf.senha.trim()) return;
    try {
      await api.createUser({ nome: nf.nome.trim(), login: nf.login.trim(), senha: nf.senha.trim(), perms: nf.perms });
      setNf(blank); setShowNew(false);
      await load(); refresh && refresh();
    } catch (e) { alert(e.message); }
  }
  async function togglePerm(u, perm) {
    const novo = { ...u.perms, [perm]: !u.perms[perm] };
    try { await api.updateUser(u.id, { perms: novo }); await load(); } catch (e) { alert(e.message); }
  }
  async function toggleActive(u) {
    try { await api.updateUser(u.id, { ativo: !u.ativo }); await load(); refresh && refresh(); } catch (e) { alert(e.message); }
  }
  async function removeUser(id) {
    if (!confirm("Remover este acesso?")) return;
    try { await api.deleteUser(id); await load(); refresh && refresh(); } catch (e) { alert(e.message); }
  }
  const count = (id) => counts[id] || 0;

  return (
    <div>
      <Header title="Equipe & Acessos" subtitle="Crie logins e defina o que cada colaboradora pode fazer">
        <button onClick={() => setShowNew(!showNew)} className="btn-primary" style={SX.btnPrimary}><UserPlus size={16} /> Novo acesso</button>
      </Header>

      {showNew && (
        <div style={SX.newUserCard} className="fade-in">
          <div style={SX.newUserTitle}><UserPlus size={17} color="#F39200" /> Criar acesso de colaboradora</div>
          <div style={SX.newUserGrid}>
            <F label="Nome" req><input value={nf.nome} onChange={(e) => setNf({ ...nf, nome: e.target.value })} placeholder="Nome da colaboradora" style={SX.input} /></F>
            <F label="Usuário (login)" req><input value={nf.login} onChange={(e) => setNf({ ...nf, login: e.target.value })} placeholder="ex: ana.paula" style={SX.input} /></F>
            <F label="Senha" req><input value={nf.senha} onChange={(e) => setNf({ ...nf, senha: e.target.value })} placeholder="senha inicial" style={SX.input} /></F>
          </div>
          <div style={SX.permLabel}>Permissões</div>
          <div style={SX.permGrid}>
            {Object.entries(PERM_LABELS).map(([k, label]) => (
              <label key={k} style={SX.permChk}>
                <input type="checkbox" checked={nf.perms[k]} onChange={() => setNf({ ...nf, perms: { ...nf.perms, [k]: !nf.perms[k] } })} style={SX.checkbox} />
                {label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button onClick={() => setShowNew(false)} className="btn-ghost" style={SX.btnGhost}>Cancelar</button>
            <button onClick={addUser} className="btn-primary" style={SX.btnPrimary}><CheckCircle2 size={16} /> Criar acesso</button>
          </div>
        </div>
      )}

      <div style={SX.userGrid}>
        {users.map((u) => {
          const admin = u.role === "admin";
          return (
            <div key={u.id} style={{ ...SX.userBlock, opacity: u.ativo ? 1 : 0.55 }} className="card-hover panel">
              <div style={SX.userBlockHead}>
                <div style={{ ...SX.userBlockAvatar, background: admin ? "linear-gradient(135deg,#F39200,#C97A1A)" : "linear-gradient(135deg,#7E8084,#6E7073)" }}>{initials(u.nome)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={SX.userBlockName}>{u.nome} {admin && <Crown size={13} color="#F39200" />}</div>
                  <div style={SX.userBlockLogin}>@{u.login} · {count(u.id)} atendimento{count(u.id) !== 1 ? "s" : ""}</div>
                </div>
                {!admin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleActive(u)} className="btn-ghost" style={SX.miniBtn} title={u.ativo ? "Desativar" : "Ativar"}>{u.ativo ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                    <button onClick={() => removeUser(u.id)} className="btn-del" style={SX.miniBtnDel} title="Remover"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              {admin ? (
                <div style={SX.adminNote}><Shield size={13} /> Acesso total ao sistema</div>
              ) : (
                <div style={SX.permRow}>
                  {Object.entries(PERM_LABELS).map(([k, label]) => (
                    <button key={k} onClick={() => togglePerm(u, k)} title={label} style={{ ...SX.permPill, ...(u.perms[k] ? SX.permPillOn : {}) }}>
                      {u.perms[k] ? <CheckCircle2 size={11} /> : <X size={11} />} {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================= CONFIG
function Config({ me, onUpdated }) {
  const [nome, setNome] = useState(me.nome);
  const [login, setLogin] = useState(me.login);
  const [senha, setSenha] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    try {
      const { user } = await api.updateMe({ nome, login, senha });
      onUpdated && onUpdated(user);
      setSaved(true); setSenha(""); setTimeout(() => setSaved(false), 2200);
    } catch (e) { setErr(e.message); }
  }
  return (
    <div>
      <Header title="Configurações" subtitle="Seus dados de acesso de administradora" />
      <div style={SX.formCard} className="rise panel">
        <div style={SX.formGrid}>
          <F label="Seu nome" full><input value={nome} onChange={(e) => setNome(e.target.value)} style={SX.input} /></F>
          <F label="Usuário (login)"><input value={login} onChange={(e) => setLogin(e.target.value)} style={SX.input} /></F>
          <F label="Nova senha"><input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="deixe vazio para manter" style={SX.input} /></F>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22, flexWrap: "wrap", gap: 12 }}>
          {saved ? <span style={SX.savedMsg}><CheckCircle2 size={15} /> Alterações salvas!</span> : err ? <span style={{ color: "#E5484D", fontSize: 14, fontWeight: 600 }}>{err}</span> : <span />}
          <button onClick={save} className="btn-primary" style={SX.btnPrimary}><CheckCircle2 size={16} /> Salvar alterações</button>
        </div>
      </div>
      <div style={SX.configNote}>
        <Shield size={15} color="#F39200" />
        <span>Como administradora, você tem acesso total: dashboard, análise por IA, gestão de toda a equipe e exportações. Use <strong>Equipe & Acessos</strong> para liberar logins às colaboradoras com permissões específicas.</span>
      </div>
    </div>
  );
}

// ============================================================= TAREFAS
const PRIORIDADE = {
  alta: { label: "Alta", color: "#E5484D", bg: "rgba(229,72,77,0.12)" },
  media: { label: "Média", color: "#F39200", bg: "rgba(243,146,0,0.13)" },
  baixa: { label: "Baixa", color: "#12A150", bg: "rgba(18,161,80,0.12)" },
};

function Tarefas({ me, isAdmin, can, users }) {
  const podeAtribuir = isAdmin || can("gerir_usuarios");
  const [tasks, setTasks] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [filtro, setFiltro] = useState("pendentes"); // pendentes | concluidas | todas
  const blank = { titulo: "", descricao: "", responsavelId: "", prazo: "", prioridade: "media" };
  const [nf, setNf] = useState(blank);

  const colabs = users.filter((u) => u.ativo !== false);

  async function load() {
    try { const { tasks } = await api.listTasks(); setTasks(tasks); } catch (e) { /* */ }
  }
  useEffect(() => { load(); }, []);

  async function criar() {
    if (!nf.titulo.trim() || !nf.responsavelId) return;
    try {
      await api.createTask(nf);
      setNf(blank); setShowNew(false); await load();
    } catch (e) { alert(e.message); }
  }
  async function toggle(t) {
    try { await api.updateTask(t.id, { concluida: !t.concluida }); await load(); } catch (e) { alert(e.message); }
  }
  async function remover(id) {
    if (!confirm("Excluir esta tarefa?")) return;
    try { await api.deleteTask(id); await load(); } catch (e) { alert(e.message); }
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const filtradas = tasks.filter((t) => {
    if (filtro === "pendentes") return !t.concluida;
    if (filtro === "concluidas") return t.concluida;
    return true;
  });
  const pendentes = tasks.filter((t) => !t.concluida).length;
  const atrasadas = tasks.filter((t) => !t.concluida && t.prazo && t.prazo < hoje).length;

  return (
    <div>
      <Header title="Tarefas" subtitle={podeAtribuir ? "Atribua e acompanhe as tarefas da equipe" : "Suas tarefas"}>
        {podeAtribuir && <button onClick={() => setShowNew(!showNew)} className="btn-primary" style={SX.btnPrimary}><PlusCircle size={16} /> Nova tarefa</button>}
      </Header>

      {/* mini stats */}
      <div style={SX.taskStats}>
        <div style={SX.taskStat}><ListTodo size={17} color="#F39200" /> <strong>{pendentes}</strong> pendente{pendentes !== 1 ? "s" : ""}</div>
        {atrasadas > 0 && <div style={{ ...SX.taskStat, color: "#E5484D" }}><AlertTriangle size={16} /> <strong>{atrasadas}</strong> atrasada{atrasadas !== 1 ? "s" : ""}</div>}
      </div>

      {showNew && podeAtribuir && (
        <div style={SX.newUserCard} className="fade-in panel">
          <div style={SX.newUserTitle}><ListTodo size={17} color="#F39200" /> Nova tarefa</div>
          <div style={SX.formGrid}>
            <F label="Título" req full><input value={nf.titulo} onChange={(e) => setNf({ ...nf, titulo: e.target.value })} placeholder="Ex: Entrar em contato com alunos pendentes" style={SX.input} /></F>
            <F label="Responsável" req>
              <select value={nf.responsavelId} onChange={(e) => setNf({ ...nf, responsavelId: e.target.value })} style={SX.input}>
                <option value="">Selecione...</option>
                {colabs.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.role === "admin" ? " (você)" : ""}</option>)}
              </select>
            </F>
            <F label="Prazo"><input type="date" value={nf.prazo} onChange={(e) => setNf({ ...nf, prazo: e.target.value })} style={SX.input} /></F>
            <F label="Prioridade">
              <select value={nf.prioridade} onChange={(e) => setNf({ ...nf, prioridade: e.target.value })} style={SX.input}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </F>
            <F label="Descrição (opcional)" full><textarea value={nf.descricao} onChange={(e) => setNf({ ...nf, descricao: e.target.value })} placeholder="Detalhes da tarefa…" style={{ ...SX.input, minHeight: 70, resize: "vertical", paddingTop: 11 }} /></F>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button onClick={() => setShowNew(false)} className="btn-ghost" style={SX.btnGhost}>Cancelar</button>
            <button onClick={criar} className="btn-primary" style={SX.btnPrimary}><CheckCircle2 size={16} /> Criar tarefa</button>
          </div>
        </div>
      )}

      {/* filtros */}
      <div style={{ display: "flex", gap: 8, margin: "4px 0 18px" }}>
        {[["pendentes", "Pendentes"], ["concluidas", "Concluídas"], ["todas", "Todas"]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} className="filter-chip" style={{ ...SX.filterChip, ...(filtro === v ? SX.filterChipOn : {}) }}>{l}</button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div style={SX.noRes} className="panel"><ListTodo size={26} color="#C9CACE" /><p style={{ margin: "10px 0 0", color: "#A0A2A6" }}>Nenhuma tarefa {filtro === "concluidas" ? "concluída" : filtro === "pendentes" ? "pendente" : ""} por aqui.</p></div>
      ) : (
        <div style={SX.taskList}>
          {filtradas.map((t) => {
            const pr = PRIORIDADE[t.prioridade] || PRIORIDADE.media;
            const atrasada = !t.concluida && t.prazo && t.prazo < hoje;
            const podeMarcar = t.responsavelId === me.id || podeAtribuir;
            return (
              <div key={t.id} style={{ ...SX.taskCard, opacity: t.concluida ? 0.62 : 1 }} className="task-card panel">
                <button onClick={() => podeMarcar && toggle(t)} className="task-check" style={{ ...SX.taskCheck, ...(t.concluida ? SX.taskCheckOn : {}), cursor: podeMarcar ? "pointer" : "default" }} title={t.concluida ? "Concluída" : "Marcar como concluída"}>
                  {t.concluida ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...SX.taskTitle, textDecoration: t.concluida ? "line-through" : "none" }}>{t.titulo}</div>
                  {t.descricao && <div style={SX.taskDesc}>{t.descricao}</div>}
                  <div style={SX.taskMeta}>
                    {podeAtribuir && <span style={SX.taskMetaItem}><UserCircle size={13} /> {nameOf(users, t.responsavelId)}</span>}
                    {t.prazo && <span style={{ ...SX.taskMetaItem, color: atrasada ? "#E5484D" : undefined, fontWeight: atrasada ? 700 : 500 }}><CalendarClock size={13} /> {fmtDate(t.prazo)}{atrasada ? " (atrasada)" : ""}</span>}
                    <span style={{ ...SX.taskPill, background: pr.bg, color: pr.color }}><Flag size={11} /> {pr.label}</span>
                  </div>
                </div>
                {podeAtribuir && <button onClick={() => remover(t.id)} className="btn-del" style={SX.btnDel}><Trash2 size={15} /></button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================= WHATSAPP
function WhatsApp({ me, isAdmin, can, goNovo }) {
  const [chats, setChats] = useState([]);
  const [sel, setSel] = useState(null);          // número selecionado
  const [chat, setChat] = useState(null);        // conversa aberta
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [cfg, setCfg] = useState(null);
  const podeConfigurar = isAdmin || can("gerir_usuarios");

  async function loadChats() {
    try {
      const r = await api.waListChats();
      setChats(r.chats || []);
    } catch (e) { /* silencioso */ }
    setLoading(false);
  }
  async function loadCfg() {
    if (!podeConfigurar) return;
    try { const r = await api.waGetConfig(); setCfg(r.config); } catch {}
  }

  useEffect(() => {
    loadChats(); loadCfg();
    const t = setInterval(loadChats, 8000);   // atualiza a cada 8s
    return () => clearInterval(t);
  }, []);

  async function abrir(numero) {
    setSel(numero);
    try {
      const r = await api.waGetChat(numero);
      setChat(r.chat);
      // atualiza contador de não-lidas na lista
      setChats((cs) => cs.map((c) => c.numero === numero ? { ...c, naoLidas: 0 } : c));
    } catch (e) { alert(e.message); }
  }

  async function enviar() {
    if (!texto.trim() || enviando || !sel) return;
    setEnviando(true);
    try {
      await api.waSend(sel, texto.trim());
      setTexto("");
      const r = await api.waGetChat(sel);
      setChat(r.chat);
    } catch (e) { alert(e.message); }
    setEnviando(false);
  }

  function criarAtendimento() {
    if (!chat) return;
    goNovo({ telefone: chat.numero, nome: chat.nome !== chat.numero ? chat.nome : "" });
  }

  // ---- tela de configuração (só admin) ----
  if (showConfig && podeConfigurar) {
    return <WhatsAppConfig cfg={cfg} onBack={() => { setShowConfig(false); loadCfg(); }} />;
  }

  return (
    <div>
      <Header title="WhatsApp" subtitle="Conversas dos alunos em tempo real">
        <button onClick={loadChats} className="btn-ghost" style={SX.btnGhost} title="Atualizar">
          <RefreshCw size={15} /> Atualizar
        </button>
        {podeConfigurar && (
          <button onClick={() => setShowConfig(true)} className="btn-ghost" style={SX.btnGhost}>
            <Link2 size={15} /> Configurar conexão
          </button>
        )}
      </Header>

      <div style={SX.waWrap} className="panel">
        {/* LISTA DE CONVERSAS */}
        <div style={SX.waList}>
          <div style={SX.waListHead}>
            <MessageCircle size={16} /> Conversas
            <span style={SX.waCount}>{chats.length}</span>
          </div>
          <div style={SX.waListScroll}>
            {loading ? (
              <div style={SX.waEmpty}>Carregando…</div>
            ) : chats.length === 0 ? (
              <div style={SX.waEmpty}>
                <MessageCircle size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>Nenhuma conversa ainda.</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  As mensagens aparecem aqui quando os alunos escreverem.
                </div>
              </div>
            ) : (
              chats.map((c) => (
                <button key={c.numero} onClick={() => abrir(c.numero)}
                  className="wa-chat-item"
                  style={{ ...SX.waChatItem, ...(sel === c.numero ? SX.waChatItemActive : {}) }}>
                  <div style={SX.waAvatar}>{(c.nome || c.numero).slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={SX.waChatName}>{c.nome || c.numero}</div>
                    <div style={SX.waChatPreview}>{c.ultima || "—"}</div>
                  </div>
                  {c.naoLidas > 0 && <span style={SX.waBadge}>{c.naoLidas}</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* CONVERSA ABERTA */}
        <div style={SX.waConvo}>
          {!chat ? (
            <div style={SX.waConvoEmpty}>
              <MessageCircle size={48} style={{ opacity: 0.2 }} />
              <div style={{ marginTop: 12, opacity: 0.6 }}>Selecione uma conversa para ver as mensagens</div>
            </div>
          ) : (
            <>
              <div style={SX.waConvoHead}>
                <div style={SX.waAvatar}>{(chat.nome || chat.numero).slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={SX.waChatName}>{chat.nome || chat.numero}</div>
                  <div style={SX.waChatPreview}><Phone size={11} style={{ verticalAlign: "middle" }} /> {chat.numero}</div>
                </div>
                {can("registrar") && (
                  <button onClick={criarAtendimento} className="btn-primary" style={SX.btnPrimarySm}>
                    <PlusSquare size={15} /> Registrar atendimento
                  </button>
                )}
              </div>

              <div style={SX.waMessages} className="wa-messages">
                {chat.mensagens.length === 0 ? (
                  <div style={SX.waEmpty}>Sem mensagens nesta conversa.</div>
                ) : (
                  chat.mensagens.map((m) => (
                    <div key={m.id} style={{ ...SX.waBubbleRow, justifyContent: m.fromMe ? "flex-end" : "flex-start" }}>
                      <div style={{ ...SX.waBubble, ...(m.fromMe ? SX.waBubbleMe : SX.waBubbleThem) }}>
                        <div>{m.texto || "—"}</div>
                        <div style={SX.waTime}>{new Date(m.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={SX.waInputBar}>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
                  placeholder="Escreva uma mensagem…"
                  style={SX.waInput}
                />
                <button onClick={enviar} disabled={enviando || !texto.trim()} className="btn-primary" style={SX.waSendBtn}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// tela de configuração da conexão WhatsApp
function WhatsAppConfig({ cfg, onBack }) {
  const [url, setUrl] = useState(cfg?.url || "");
  const [apiKey, setApiKey] = useState("");
  const [instance, setInstance] = useState(cfg?.instance || "");
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState(cfg?.webhookToken || "");
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { url, instance };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      const r = await api.waSetConfig(payload);
      if (r.webhookToken) setToken(r.webhookToken);
      setSalvo(true);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  const base = (typeof window !== "undefined") ? window.location.origin : "";
  const webhookUrl = token ? `${base}/api/wa/webhook/${token}` : "(salve para gerar)";

  return (
    <div>
      <Header title="Configurar WhatsApp" subtitle="Conecte o sistema à sua Evolution API">
        <button onClick={onBack} className="btn-ghost" style={SX.btnGhost}><ArrowLeft size={15} /> Voltar</button>
      </Header>

      <div style={SX.formCard} className="rise panel" >
        <div style={{ display: "grid", gap: 16, maxWidth: 620 }}>
          <F label="Endereço da Evolution (URL)" req>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://evolution-api-production-xxxx.up.railway.app" style={SX.input} />
          </F>
          <F label="Chave da API (AUTHENTICATION_API_KEY)" req>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.temApiKey ? "•••••• (já salva — preencha só para trocar)" : "cole a chave aqui"} style={SX.input} />
          </F>
          <F label="Nome da instância" req>
            <input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="thiago" style={SX.input} />
          </F>

          <button onClick={salvar} disabled={saving} className="btn-primary" style={SX.btnPrimary}>
            {saving ? "Salvando…" : "Salvar conexão"}
          </button>

          {salvo && <div style={SX.waOk}><CheckCircle2 size={15} /> Conexão salva!</div>}

          <div style={SX.waWebhookBox}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
              <Link2 size={14} style={{ verticalAlign: "middle" }} /> Endereço do Webhook
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              Cole este endereço na sua Evolution (em Events → Webhook), marcando o evento <b>messages.upsert</b>:
            </div>
            <code style={SX.waCode}>{webhookUrl}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================= SHARED
function Header({ title, subtitle, children }) {
  return (<div style={SX.header}><div><h1 style={SX.h1}>{title}</h1><p style={SX.sub}>{subtitle}</p></div>{children && <div style={SX.headerActions}>{children}</div>}</div>);
}
function CardBox({ title, sub, children, wide }) {
  return (<div style={{ ...SX.chartCard, gridColumn: wide ? "span 2" : "span 1" }} className="card-hover panel"><div style={SX.chartHead}><div><div style={SX.chartTitle}>{title}</div>{sub && <div style={SX.chartSub}>{sub}</div>}</div></div>{children}</div>);
}
function F({ label, children, req, full }) {
  return <div style={{ gridColumn: full ? "1 / -1" : "auto" }}><label style={SX.label}>{label}{req && <span style={{ color: "#E5484D" }}> *</span>}</label>{children}</div>;
}
function Sel({ value, onChange, opts }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} style={SX.filterSel}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
function Empty() {
  return (<div style={SX.empty}><div style={SX.emptyIcon}><ClipboardList size={34} color="#F39200" /></div><h3 style={SX.emptyTitle}>Nenhum atendimento ainda</h3><p style={SX.emptyText}>Os registros e gráficos aparecem aqui assim que os atendimentos forem cadastrados.</p></div>);
}

// ============================================================= LOGIC
function buildStats(records, users) {
  const total = records.length;
  const byStatus = { resolvido: 0, andamento: 0, pendente: 0 };
  records.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  const taxa = total ? Math.round((byStatus.resolvido / total) * 100) : 0;
  const cm = {}; records.forEach((r) => { cm[r.colaboradoraId] = (cm[r.colaboradoraId] || 0) + 1; });
  const byColab = Object.entries(cm).map(([id, value]) => ({ name: shortName(nameOf(users, id)), value })).sort((a, b) => b.value - a.value);
  const am = {}; records.forEach((r) => { const k = r.assunto || "—"; am[k] = (am[k] || 0) + 1; });
  const byAssunto = Object.entries(am).map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 21) + "…" : name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const dm = {}; records.forEach((r) => { if (r.data) dm[r.data] = (dm[r.data] || 0) + 1; });
  const byDay = Object.entries(dm).map(([d, value]) => ({ data: d.slice(8, 10) + "/" + d.slice(5, 7), value })).sort((a, b) => a.data.localeCompare(b.data)).slice(-14);
  const statusData = Object.entries(byStatus).filter(([, v]) => v > 0).map(([k, v]) => ({ name: STATUS[k].label, value: v, key: k }));
  return { total, byStatus, taxa, byColab, byAssunto, byDay, statusData };
}
// ============================================================= HELPERS
function initials(n) { if (!n) return "?"; const p = n.trim().split(" "); return (p[0][0] + (p[1]?.[0] || "")).toUpperCase(); }
function shortName(n) { if (!n) return "—"; const p = n.trim().split(" "); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]; }
function nameOf(users, id) { return users.find((u) => u.id === id)?.nome || "—"; }
function fmtDate(d) { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y.slice(2)}`; }

const TT = { background: "#fff", border: "1px solid #EBEBEE", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 28px rgba(60,55,45,0.12)", padding: "8px 12px" };

// ============================================================= STYLES
const SX = {
  // tema toggle
  themeToggle: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 10, borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#B4B6BA", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" },

  // tarefas
  taskStats: { display: "flex", gap: 18, marginBottom: 16, flexWrap: "wrap" },
  taskStat: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, color: "var(--text-soft)", fontWeight: 500 },
  taskList: { display: "flex", flexDirection: "column", gap: 10 },
  taskCard: { display: "flex", alignItems: "flex-start", gap: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 3px rgba(60,55,45,0.04)", transition: "all .2s" },
  taskCheck: { width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", color: "#C4C4C8", display: "grid", placeItems: "center", flexShrink: 0, transition: "all .15s" },
  taskCheckOn: { color: "#12A150" },
  taskTitle: { fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 3 },
  taskDesc: { fontSize: 13, color: "var(--text-soft)", marginBottom: 8, lineHeight: 1.5 },
  taskMeta: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 6 },
  taskMetaItem: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-soft)", fontWeight: 500 },
  taskPill: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20 },

  // filtros (chips)
  filterChip: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text-soft)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" },
  filterChipOn: { background: "linear-gradient(120deg,#F39200,#E08200)", color: "#fff", borderColor: "transparent", boxShadow: "0 3px 10px rgba(243,146,0,0.3)" },

  // análise individual
  indHead: { display: "flex", alignItems: "center", gap: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "22px 24px", marginBottom: 16, boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  indAvatar: { width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#F39200,#C97A1A)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 20, flexShrink: 0 },
  indName: { fontSize: 21, fontWeight: 800, color: "var(--text)" },
  indCol: { background: "var(--card)", border: "1px solid", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  indColTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 700, color: "var(--text)", marginBottom: 12 },
  feedbackBox: { background: "linear-gradient(120deg,#FBF4EA,#FDF6EC)", border: "1px solid #F2E6D2", borderRadius: 16, padding: "20px 24px", marginTop: 16 },
  feedbackLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#C97A1A", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 10 },
  feedbackText: { margin: 0, fontSize: 15, lineHeight: 1.65, color: "#5A4E3C", fontStyle: "italic" },

  app: { display: "flex", minHeight: "100vh", background: "transparent", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "var(--text)", position: "relative", overflow: "hidden" },
  bgGlow: { position: "fixed", top: -180, right: -120, width: 520, height: 520, background: "radial-gradient(circle, rgba(243,146,0,0.09), transparent 70%)", pointerEvents: "none", zIndex: 0 },

  sidebar: { width: 262, background: "linear-gradient(180deg,#3A3B3E,#2C2D30)", display: "flex", flexDirection: "column", padding: "28px 16px 20px", position: "sticky", top: 0, height: "100vh", zIndex: 2, boxShadow: "4px 0 30px rgba(40,40,44,0.14)" },
  brand: { padding: "0 8px", marginBottom: 4 },
  brandLogo: { width: 150, display: "block" },
  brandTag: { color: "#9A9CA0", fontSize: 11.5, fontWeight: 600, padding: "0 10px", marginBottom: 30, letterSpacing: "0.3px" },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navBtn: { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: "none", background: "transparent", color: "#B4B6BA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s", position: "relative" },
  navBtnActive: { background: "linear-gradient(100deg,rgba(243,146,0,0.95),rgba(201,122,26,0.9))", color: "#fff", boxShadow: "0 4px 14px rgba(243,146,0,0.35)" },

  userCard: { marginTop: "auto", display: "flex", alignItems: "center", gap: 11, padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)" },
  avatar: { width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#F39200,#C97A1A)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 },
  userName: { color: "#fff", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { color: "#9A9CA0", fontSize: 11, display: "flex", alignItems: "center", gap: 4, marginTop: 1 },
  logoutBtn: { width: 32, height: 32, borderRadius: 9, border: "none", background: "rgba(255,255,255,0.06)", color: "#B4B6BA", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, transition: "all .15s" },

  main: { flex: 1, padding: "36px 44px 70px", maxWidth: 1340, margin: "0 auto", width: "100%", position: "relative", zIndex: 1, overflowY: "auto", height: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26, flexWrap: "wrap", gap: 16 },
  h1: { margin: 0, fontSize: 29, fontWeight: 800, letterSpacing: "-0.6px", color: "#2A2B2E" },
  sub: { margin: "5px 0 0", color: "#82848A", fontSize: 14.5, fontWeight: 500 },
  headerActions: { display: "flex", gap: 10 },

  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(218px,1fr))", gap: 15, marginBottom: 16 },
  kpiCard: { background: "#fff", borderRadius: 18, padding: "20px 22px", display: "flex", alignItems: "center", gap: 15, border: "1px solid #ECECEE", boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  kpiIcon: { width: 50, height: 50, borderRadius: 14, display: "grid", placeItems: "center", flexShrink: 0 },
  kpiValue: { fontSize: 30, fontWeight: 800, color: "#2A2B2E", lineHeight: 1 },
  kpiLabel: { fontSize: 12.5, color: "#82848A", marginTop: 5, fontWeight: 500 },

  taxaCard: { background: "linear-gradient(110deg,#2C2D30,#46474A)", borderRadius: 18, padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 18, boxShadow: "0 12px 32px rgba(44,45,48,0.26)", position: "relative", overflow: "hidden" },
  taxaShine: { position: "absolute", top: -60, right: -40, width: 240, height: 240, background: "radial-gradient(circle,rgba(243,146,0,0.32),transparent 70%)" },
  taxaLabel: { color: "#fff", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 },
  taxaSub: { color: "#B4B6BA", fontSize: 13, marginTop: 4 },
  taxaRight: { display: "flex", alignItems: "center", gap: 18, flex: 1, maxWidth: 440, minWidth: 240, position: "relative" },
  taxaTrack: { flex: 1, height: 13, background: "rgba(255,255,255,0.14)", borderRadius: 20, overflow: "hidden" },
  taxaFill: { height: "100%", background: "linear-gradient(90deg,#F8B14E,#F39200)", borderRadius: 20, transition: "width 1s cubic-bezier(.4,0,.2,1)", boxShadow: "0 0 12px rgba(243,146,0,0.55)" },
  taxaPct: { color: "#fff", fontSize: 34, fontWeight: 800, minWidth: 76, textAlign: "right" },

  chartGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 },
  chartCard: { background: "#fff", borderRadius: 18, padding: "20px 22px 14px", border: "1px solid #ECECEE", boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  chartHead: { display: "flex", justifyContent: "space-between", marginBottom: 16 },
  chartTitle: { fontSize: 15, fontWeight: 700, color: "#2A2B2E" },
  chartSub: { fontSize: 12, color: "#969A9E", marginTop: 2, fontWeight: 500 },

  aiHero: { background: "linear-gradient(120deg,#2C2D30 0%,#46474A 55%,#5A4326 100%)", borderRadius: 22, padding: "30px 32px", display: "flex", gap: 24, marginBottom: 22, position: "relative", overflow: "hidden", boxShadow: "0 16px 40px rgba(44,45,48,0.28)" },
  aiHeroGlow: { position: "absolute", top: -80, right: -60, width: 320, height: 320, background: "radial-gradient(circle,rgba(243,146,0,0.4),transparent 70%)" },
  aiBadge: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(243,146,0,0.2)", color: "#FFD9A0", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(243,146,0,0.35)" },
  aiHeroTitle: { color: "#fff", fontSize: 25, fontWeight: 800, margin: "14px 0 8px", letterSpacing: "-0.5px" },
  aiHeroText: { color: "#C4C6CA", fontSize: 14.5, lineHeight: 1.6, maxWidth: 620, margin: 0 },
  aiMeta: { display: "flex", alignItems: "center", gap: 14, margin: "18px 0 22px", color: "#DADCE0", fontSize: 13.5, flexWrap: "wrap" },
  dot: { width: 4, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.3)" },
  aiCta: { display: "inline-flex", alignItems: "center", gap: 9, background: "#F39200", color: "#fff", border: "none", borderRadius: 13, padding: "0 24px", height: 48, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", boxShadow: "0 8px 24px rgba(243,146,0,0.4)", transition: "transform .15s" },
  aiError: { display: "flex", alignItems: "center", gap: 8, background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.25)", color: "#C13B30", padding: "13px 16px", borderRadius: 13, fontSize: 14, marginBottom: 16 },
  aiLoading: { display: "flex", flexDirection: "column", gap: 12 },
  skel: { height: 90, background: "linear-gradient(90deg,#EEEEF0,#F7F7F8,#EEEEF0)", backgroundSize: "200% 100%", borderRadius: 16 },

  aiPanorama: { display: "flex", gap: 16, background: "#fff", border: "1px solid #ECECEE", borderRadius: 18, padding: "22px 24px", marginBottom: 16, boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  aiPanIcon: { width: 46, height: 46, borderRadius: 13, background: "rgba(243,146,0,0.1)", display: "grid", placeItems: "center", flexShrink: 0 },
  aiPanLabel: { fontSize: 12.5, fontWeight: 700, color: "#F39200", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 },
  aiPanText: { margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "#3C3D40", fontWeight: 500 },

  aiHighlights: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 },
  aiHl: { display: "flex", gap: 14, padding: "18px 20px", borderRadius: 16, border: "1px solid" },
  aiHlIcon: { width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0 },
  aiHlLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#82848A", marginBottom: 4 },
  aiHlText: { fontSize: 14.5, color: "#2E2F32", fontWeight: 600, lineHeight: 1.45 },

  aiSectionTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: "#2A2B2E", marginBottom: 14 },
  aiColabGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 15, marginBottom: 26 },
  aiColabCard: { background: "#fff", border: "1px solid #ECECEE", borderRadius: 18, padding: "20px 22px", boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  aiColabHead: { display: "flex", alignItems: "center", gap: 13, marginBottom: 14 },
  aiColabAvatar: { width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#F39200,#C97A1A)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 },
  aiColabName: { fontSize: 15.5, fontWeight: 700, color: "#2A2B2E", marginBottom: 5 },
  aiAval: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20 },
  aiColabLeitura: { fontSize: 14, lineHeight: 1.55, color: "#4C4E52", margin: "0 0 16px", fontWeight: 500 },
  aiSugLabel: { fontSize: 11.5, fontWeight: 700, color: "#82848A", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 9 },
  aiSugList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 },
  aiSugItem: { display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.5, color: "#3C3D40" },

  aiActions: { background: "linear-gradient(120deg,#FBF4EA,#FDF6EC)", border: "1px solid #F2E6D2", borderRadius: 18, padding: "24px 26px" },
  aiActionsTitle: { display: "flex", alignItems: "center", gap: 9, fontSize: 16.5, fontWeight: 800, color: "#2A2B2E", marginBottom: 16 },
  aiActionsList: { display: "flex", flexDirection: "column", gap: 11 },
  aiActionItem: { display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14.5, color: "#3C3D40", lineHeight: 1.5, fontWeight: 500 },
  aiActionNum: { width: 24, height: 24, borderRadius: 8, background: "#F39200", color: "#fff", fontSize: 12.5, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 },

  filterBar: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  searchWrap: { display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #E6E6E9", borderRadius: 13, padding: "0 15px", flex: 1, minWidth: 220, height: 44 },
  searchInput: { border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14, fontFamily: "inherit", color: "#2A2B2E" },
  filterSel: { background: "#fff", border: "1px solid #E6E6E9", borderRadius: 13, padding: "0 15px", height: 44, fontSize: 13.5, fontFamily: "inherit", color: "#2A2B2E", cursor: "pointer", outline: "none", fontWeight: 500 },

  tableWrap: { background: "#fff", borderRadius: 18, border: "1px solid #ECECEE", overflow: "hidden", boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { textAlign: "left", padding: "14px 16px", fontSize: 11, fontWeight: 700, color: "#969A9E", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #ECECEE", background: "#FAFAFA", whiteSpace: "nowrap" },
  td: { padding: "13px 16px", borderBottom: "1px solid #F2F2F3", color: "#46484C", verticalAlign: "middle" },
  dataChip: { fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#C97A1A", fontSize: 13 },
  colabTag: { display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#2E2F32" },
  colabDot: { width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#F39200,#C97A1A)", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 },
  contact: { display: "flex", flexDirection: "column", gap: 1 },
  cMain: { fontSize: 12.5, color: "#46484C" },
  cSub: { fontSize: 12, color: "#969A9E" },
  trunc: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pill: { display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" },
  btnDel: { width: 32, height: 32, borderRadius: 9, border: "1px solid #F3D7D8", background: "#fff", color: "#E5484D", cursor: "pointer", display: "grid", placeItems: "center", transition: "all .15s" },
  noRes: { background: "#fff", borderRadius: 18, border: "1px dashed #E6E6E9", padding: "48px 20px", textAlign: "center" },

  formCard: { background: "#fff", borderRadius: 18, border: "1px solid #ECECEE", padding: 28, maxWidth: 880, boxShadow: "0 1px 3px rgba(60,55,45,0.04)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#5C5E62", marginBottom: 7 },
  input: { width: "100%", boxSizing: "border-box", height: 44, padding: "0 14px", border: "1px solid #DCDCDF", borderRadius: 11, fontSize: 14, fontFamily: "inherit", color: "#2A2B2E", outline: "none", background: "#fff", transition: "all .15s" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 26 },

  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(120deg,#F39200,#E08200)", color: "#fff", border: "none", borderRadius: 12, padding: "0 20px", height: 44, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(243,146,0,0.35)", transition: "all .15s" },
  btnGhost: { display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#5C5E62", border: "1px solid #DCDCDF", borderRadius: 12, padding: "0 18px", height: 44, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" },

  newUserCard: { background: "#fff", borderRadius: 18, border: "1px solid #F2E6D2", padding: 26, marginBottom: 22, boxShadow: "0 8px 28px rgba(243,146,0,0.1)" },
  newUserTitle: { display: "flex", alignItems: "center", gap: 9, fontSize: 16, fontWeight: 700, color: "#2A2B2E", marginBottom: 20 },
  newUserGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 },
  permLabel: { fontSize: 12.5, fontWeight: 700, color: "#82848A", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 },
  permGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 },
  permChk: { display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "#46484C", fontWeight: 500, cursor: "pointer", padding: "8px 0" },
  checkbox: { width: 17, height: 17, accentColor: "#F39200", cursor: "pointer" },

  userGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 15 },
  userBlock: { background: "#fff", borderRadius: 18, border: "1px solid #ECECEE", padding: "20px 22px", boxShadow: "0 1px 3px rgba(60,55,45,0.04)", transition: "all .2s" },
  userBlockHead: { display: "flex", alignItems: "center", gap: 13, marginBottom: 14 },
  userBlockAvatar: { width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 },
  userBlockName: { fontSize: 15.5, fontWeight: 700, color: "#2A2B2E", display: "flex", alignItems: "center", gap: 6 },
  userBlockLogin: { fontSize: 12.5, color: "#969A9E", marginTop: 2, fontWeight: 500 },
  miniBtn: { width: 32, height: 32, borderRadius: 9, border: "1px solid #DCDCDF", background: "#fff", color: "#5C5E62", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 },
  miniBtnDel: { width: 32, height: 32, borderRadius: 9, border: "1px solid #F3D7D8", background: "#fff", color: "#E5484D", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 },
  adminNote: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#C97A1A", background: "rgba(243,146,0,0.1)", padding: "8px 14px", borderRadius: 10 },
  permRow: { display: "flex", flexWrap: "wrap", gap: 7 },
  permPill: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "6px 11px", borderRadius: 9, border: "1px solid #E6E6E9", background: "#F8F8F9", color: "#969A9E", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" },
  permPillOn: { background: "rgba(243,146,0,0.1)", color: "#C97A1A", borderColor: "rgba(243,146,0,0.35)" },

  savedMsg: { display: "inline-flex", alignItems: "center", gap: 7, color: "#12A150", fontSize: 14, fontWeight: 600 },
  configNote: { display: "flex", gap: 11, marginTop: 18, padding: "16px 18px", background: "rgba(243,146,0,0.05)", border: "1px solid rgba(243,146,0,0.16)", borderRadius: 14, fontSize: 13.5, color: "#4C4E52", lineHeight: 1.55, maxWidth: 880 },

  empty: { background: "#fff", borderRadius: 20, border: "1px dashed #DCDCDF", padding: "56px 24px", textAlign: "center", maxWidth: 540, margin: "20px auto" },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, background: "rgba(243,146,0,0.09)", display: "grid", placeItems: "center", margin: "0 auto 18px" },
  emptyTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: "#2A2B2E" },
  emptyText: { margin: "10px 0 0", color: "#82848A", fontSize: 14.5, lineHeight: 1.6 },

  loginWrap: { minHeight: "100vh", background: "linear-gradient(135deg,#2C2D30 0%,#3E3F42 50%,#4A3A22 100%)", display: "grid", placeItems: "center", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", position: "relative", overflow: "hidden", padding: 20 },
  loginGlow: { position: "absolute", top: "18%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: "radial-gradient(circle,rgba(243,146,0,0.22),transparent 65%)", pointerEvents: "none" },
  loginCard: { background: "rgba(255,255,255,0.98)", borderRadius: 24, padding: "40px 38px", width: "100%", maxWidth: 410, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", position: "relative", zIndex: 1, border: "1px solid rgba(255,255,255,0.5)" },
  loginSub: { textAlign: "center", color: "#82848A", fontSize: 14, margin: "12px 0 0", fontWeight: 500 },
  loginLabel: { display: "block", fontSize: 13, fontWeight: 600, color: "#5C5E62", marginBottom: 8 },
  loginField: { display: "flex", alignItems: "center", gap: 10, background: "#F6F5F3", border: "1px solid #E4E2DE", borderRadius: 13, padding: "0 15px", height: 50, transition: "all .15s" },
  loginInput: { border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14.5, fontFamily: "inherit", color: "#2A2B2E" },
  eyeBtn: { border: "none", background: "transparent", color: "#A0A2A6", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" },
  loginErr: { display: "flex", alignItems: "center", gap: 7, color: "#E5484D", fontSize: 13, fontWeight: 600, marginTop: 14, justifyContent: "center" },
  loginBtn: { width: "100%", marginTop: 22, height: 50, background: "linear-gradient(120deg,#F39200,#E08200)", color: "#fff", border: "none", borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 10px 28px rgba(243,146,0,0.4)", transition: "transform .15s" },
  loginHint: { marginTop: 24, padding: "13px 15px", background: "rgba(243,146,0,0.07)", border: "1px solid rgba(243,146,0,0.16)", borderRadius: 12, fontSize: 12.5, color: "#6E6A62", lineHeight: 1.6, textAlign: "center" },
  code: { background: "#2C2D30", color: "#F8B14E", padding: "1px 7px", borderRadius: 6, fontSize: 12, fontFamily: "monospace", fontWeight: 600 },
  loginFoot: { position: "absolute", bottom: 22, color: "rgba(255,255,255,0.4)", fontSize: 12.5, zIndex: 1 },

  onbIcon: { width: 52, height: 52, borderRadius: 16, background: "rgba(243,146,0,0.1)", display: "grid", placeItems: "center", margin: "18px auto 0" },
  onbTitle: { textAlign: "center", fontSize: 23, fontWeight: 800, color: "#2A2B2E", margin: "14px 0 0" },
  onbText: { textAlign: "center", color: "#82848A", fontSize: 14, lineHeight: 1.55, margin: "10px 0 0" },
  onbHint: { textAlign: "center", color: "#A0A2A6", fontSize: 12.5, marginTop: 16 },

  // ---- WhatsApp ----
  btnPrimarySm: { display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(120deg,#F39200,#E08200)", color: "#fff", border: "none", borderRadius: 10, padding: "0 14px", height: 38, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px rgba(243,146,0,0.3)", whiteSpace: "nowrap" },
  waWrap: { display: "grid", gridTemplateColumns: "320px 1fr", height: "calc(100vh - 200px)", minHeight: 480, borderRadius: 18, overflow: "hidden", border: "1px solid var(--line)", background: "var(--card)" },
  waList: { display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)", minWidth: 0, background: "var(--card)" },
  waListHead: { display: "flex", alignItems: "center", gap: 8, padding: "16px 18px", fontWeight: 700, fontSize: 14, color: "var(--text)", borderBottom: "1px solid var(--line)" },
  waCount: { marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#fff", background: "#F39200", borderRadius: 20, padding: "1px 9px" },
  waListScroll: { flex: 1, overflowY: "auto" },
  waEmpty: { padding: "36px 20px", textAlign: "center", color: "var(--muted)", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center" },
  waChatItem: { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "12px 16px", border: "none", borderBottom: "1px solid var(--line)", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background .12s" },
  waChatItemActive: { background: "rgba(243,146,0,0.1)" },
  waAvatar: { width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#F39200,#C97A1A)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 },
  waChatName: { fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  waChatPreview: { fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 },
  waBadge: { fontSize: 11, fontWeight: 700, color: "#fff", background: "#12A150", borderRadius: 20, padding: "1px 7px", flexShrink: 0 },
  waConvo: { display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" },
  waConvoEmpty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 },
  waConvoHead: { display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--card)" },
  waMessages: { flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 },
  waBubbleRow: { display: "flex", width: "100%" },
  waBubble: { maxWidth: "72%", padding: "9px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.45, wordBreak: "break-word" },
  waBubbleThem: { background: "var(--card)", color: "var(--text)", border: "1px solid var(--line)", borderBottomLeftRadius: 4 },
  waBubbleMe: { background: "linear-gradient(120deg,#F39200,#E08200)", color: "#fff", borderBottomRightRadius: 4 },
  waTime: { fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: "right" },
  waInputBar: { display: "flex", gap: 10, padding: "14px 16px", borderTop: "1px solid var(--line)", background: "var(--card)" },
  waInput: { flex: 1, border: "1px solid var(--line)", borderRadius: 12, padding: "0 15px", height: 44, fontSize: 14, fontFamily: "inherit", background: "var(--bg)", color: "var(--text)", outline: "none" },
  waSendBtn: { width: 48, height: 44, borderRadius: 12, border: "none", background: "linear-gradient(120deg,#F39200,#E08200)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(243,146,0,0.3)" },
  waOk: { display: "inline-flex", alignItems: "center", gap: 7, color: "#12A150", fontSize: 14, fontWeight: 600 },
  waWebhookBox: { marginTop: 8, padding: "16px 18px", background: "rgba(243,146,0,0.05)", border: "1px solid rgba(243,146,0,0.16)", borderRadius: 14 },
  waCode: { display: "block", background: "#2C2D30", color: "#F8B14E", padding: "10px 13px", borderRadius: 9, fontSize: 12.5, fontFamily: "monospace", fontWeight: 600, wordBreak: "break-all", lineHeight: 1.5 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }

/* ======================= TEMA — PALETA PREMIUM ======================= */
.theme-dark {
  --bg: #0C0D10;
  --bg-2: #121317;
  --card: rgba(255,255,255,0.045);
  --card-solid: #16181D;
  --card-hi: rgba(255,255,255,0.07);
  --border: rgba(255,255,255,0.08);
  --border-hi: rgba(255,255,255,0.14);
  --text: #F4F4F2;
  --text-soft: #A0A3AB;
  --text-faint: #6A6E78;
  --table-head: rgba(255,255,255,0.03);
  --input-bg: rgba(255,255,255,0.04);
  --shadow: 0 18px 50px -12px rgba(0,0,0,0.6);
  --mesh-1: rgba(243,146,0,0.14);
  --mesh-2: rgba(255,160,60,0.07);
}
.theme-light {
  --bg: #F7F6F3;
  --bg-2: #FFFFFF;
  --card: #FFFFFF;
  --card-solid: #FFFFFF;
  --card-hi: #FFFFFF;
  --border: #EBE9E4;
  --border-hi: #DEDBD4;
  --text: #1E2024;
  --text-soft: #6B6F78;
  --text-faint: #9CA0A8;
  --table-head: #FAF9F7;
  --input-bg: #FFFFFF;
  --shadow: 0 14px 40px -16px rgba(60,55,45,0.18);
  --mesh-1: rgba(243,146,0,0.10);
  --mesh-2: rgba(255,160,60,0.05);
}

/* fundo com gradient mesh atmosférico */
.app-root { background: var(--bg) !important; color: var(--text); position: relative; }
.app-root::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(680px 520px at 78% -8%, var(--mesh-1), transparent 60%),
    radial-gradient(560px 460px at 12% 8%, var(--mesh-2), transparent 55%),
    radial-gradient(700px 600px at 90% 100%, var(--mesh-2), transparent 60%);
}
/* textura de grão sutil */
.app-root::after {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ======================= TIPOGRAFIA ======================= */
.app-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
.app-root h1, .login-card h1 { font-family: 'Fraunces', Georgia, serif !important; font-weight: 600 !important; letter-spacing: -0.5px; }
main h1 { color: var(--text) !important; font-size: 30px !important; }
main p { color: var(--text-soft); }
/* números/KPIs em mono elegante */
.kpi-value, .taxa-pct { font-family: 'JetBrains Mono', monospace !important; letter-spacing: -1px; }

/* ======================= SIDEBAR PREMIUM ======================= */
.theme-dark .sidebar { background: linear-gradient(185deg, #141519, #0E0F12) !important; border-right: 1px solid rgba(255,255,255,0.06); box-shadow: none !important; }
.theme-light .sidebar { background: linear-gradient(185deg, #1F2024, #161719) !important; }
.navbtn { border-radius: 13px !important; transition: all .22s cubic-bezier(.2,.7,.3,1) !important; }
.navbtn:hover { background: rgba(255,255,255,0.06) !important; color: #fff !important; transform: translateX(2px); }
.logout-btn:hover { background: rgba(255,90,95,0.18) !important; color: #FF8A8E !important; }
.theme-toggle { border-radius: 13px !important; }
.theme-toggle:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }

/* ======================= CARTÕES (glassmorphism) ======================= */
.theme-dark .panel, .theme-dark .card, .theme-dark .card-hover, .theme-dark .kpi {
  background: var(--card) !important; border: 1px solid var(--border) !important;
  backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: var(--shadow) !important; border-radius: 20px !important;
}
.theme-light .panel, .theme-light .card, .theme-light .card-hover, .theme-light .kpi {
  background: var(--card) !important; border: 1px solid var(--border) !important;
  box-shadow: var(--shadow) !important; border-radius: 20px !important;
}
.card-hover { transition: transform .26s cubic-bezier(.2,.7,.3,1), box-shadow .26s, border-color .26s; }
.card-hover:hover { transform: translateY(-3px); border-color: var(--border-hi) !important; }
.theme-dark .card-hover:hover { box-shadow: 0 24px 60px -14px rgba(0,0,0,0.7), 0 0 0 1px rgba(243,146,0,0.12) !important; }
.theme-light .card-hover:hover { box-shadow: 0 22px 55px -16px rgba(60,55,45,0.24) !important; }

/* inputs refinados */
.theme-dark input, .theme-dark select, .theme-dark textarea { background: var(--input-bg) !important; border: 1px solid var(--border) !important; color: var(--text) !important; }
.theme-light input, .theme-light select, .theme-light textarea { background: var(--input-bg) !important; border-color: var(--border) !important; color: var(--text) !important; }
.theme-dark input::placeholder, .theme-dark textarea::placeholder { color: #5E626B !important; }
input, select, textarea { border-radius: 12px !important; transition: all .18s !important; }
input:focus, textarea:focus, select:focus { border-color: #F39200 !important; box-shadow: 0 0 0 3.5px rgba(243,146,0,0.16) !important; outline: none; }

/* tabelas */
.theme-dark table thead th { background: var(--table-head) !important; color: var(--text-soft) !important; border-color: var(--border) !important; }
.theme-dark table td { color: var(--text) !important; border-color: var(--border) !important; }
.theme-dark .trow:hover td { background: rgba(255,255,255,0.035) !important; }
.theme-light .trow:hover td { background: var(--table-head); }

/* botões */
.btn-primary { border-radius: 13px !important; background: linear-gradient(120deg,#FF9D2E,#E07B00) !important; box-shadow: 0 6px 20px -4px rgba(243,146,0,0.5) !important; transition: all .22s cubic-bezier(.2,.7,.3,1) !important; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -6px rgba(243,146,0,0.6) !important; filter: brightness(1.05); }
.theme-dark .btn-ghost { background: var(--card) !important; border: 1px solid var(--border) !important; color: var(--text-soft) !important; border-radius: 13px !important; }
.theme-dark .btn-ghost:hover { background: rgba(255,255,255,0.06) !important; color: var(--text) !important; }
.btn-ghost { border-radius: 13px !important; }
.btn-del:hover { background: #FF5A5F !important; color: #fff !important; border-color: #FF5A5F !important; }

/* chips de filtro */
.filter-chip { border-radius: 13px !important; transition: all .18s !important; }
.theme-dark .filter-chip { background: var(--card) !important; border: 1px solid var(--border) !important; color: var(--text-soft) !important; }
.filter-chip:hover { border-color: #F39200 !important; color: #F39200 !important; }

/* tarefas */
.theme-dark .task-card { background: var(--card) !important; border: 1px solid var(--border) !important; backdrop-filter: blur(14px); box-shadow: var(--shadow) !important; border-radius: 18px !important; }
.task-card { transition: transform .22s, box-shadow .22s, border-color .22s; border-radius: 18px !important; }
.task-card:hover { transform: translateY(-2px); border-color: var(--border-hi) !important; }
.task-check:hover { background: rgba(45,212,160,0.14) !important; color: #2DD4A0 !important; }

/* IA */
.theme-dark .ai-actions { background: linear-gradient(135deg, rgba(243,146,0,0.10), rgba(243,146,0,0.04)) !important; border: 1px solid rgba(243,146,0,0.2) !important; border-radius: 20px !important; }
.theme-dark .ai-hl { background: rgba(255,255,255,0.035) !important; border-radius: 16px !important; }
.theme-dark .ai-action-item { color: var(--text) !important; }
.theme-dark .feedback-box { background: linear-gradient(135deg, rgba(243,146,0,0.10), rgba(243,146,0,0.05)) !important; border: 1px solid rgba(243,146,0,0.22) !important; border-radius: 20px !important; }
.theme-dark .feedback-box p { color: #E9C9A0 !important; }
.theme-dark .panel { color: var(--text); }

/* hero da IA — vidro escuro premium nos dois temas */
.ai-hero { border-radius: 24px !important; }

/* login premium */
.theme-dark .login-card { background: rgba(22,24,29,0.8) !important; border: 1px solid var(--border) !important; backdrop-filter: blur(20px); }

/* scrollbar */
::-webkit-scrollbar { width: 10px; height: 10px; }
.theme-dark ::-webkit-scrollbar-thumb { background: #2C2E34; border-radius: 8px; }
.theme-light ::-webkit-scrollbar-thumb { background: #D6D4D0; border-radius: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb:hover { background: #F39200; }

/* ======================= ANIMAÇÕES ======================= */
.ai-dot { width: 7px; height: 7px; border-radius: 8px; background: linear-gradient(135deg,#FFB14E,#F39200); box-shadow: 0 0 10px rgba(243,146,0,0.9); animation: pulse 1.8s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.85); } }
.pulse { animation: pulse 1.4s ease-in-out infinite; }
.spin { display: inline-flex; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.skel { animation: shimmer 1.6s ease-in-out infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.fade-in { animation: fadeIn .5s cubic-bezier(.2,.7,.3,1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.rise { animation: rise .6s cubic-bezier(.2,.7,.3,1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
.kpi { animation: rise .6s cubic-bezier(.2,.7,.3,1) both; }
.kpi:nth-child(1){animation-delay:.04s}.kpi:nth-child(2){animation-delay:.1s}.kpi:nth-child(3){animation-delay:.16s}.kpi:nth-child(4){animation-delay:.22s}
.login-rise { animation: loginRise .7s cubic-bezier(.2,.7,.3,1) both; }
@keyframes loginRise { from { opacity: 0; transform: translateY(28px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
.shake { animation: shake .4s ease; }
@keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@media (max-width: 900px) { aside { display: none; } .chartCard { grid-column: span 2 !important; } main { padding: 20px !important; } }
`;
