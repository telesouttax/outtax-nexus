// ── FLOWDESK — app.js ──

const STAGES = [
  { id: 'ideia',        label: 'Ideia',        icon: '💡', color: 'purple' },
  { id: 'diagnostico',  label: 'Diagnóstico',  icon: '🔍', color: 'blue'   },
  { id: 'planejamento', label: 'Planejamento', icon: '📋', color: 'teal'   },
  { id: 'execucao',     label: 'Execução',     icon: '⚙️', color: 'amber'  },
  { id: 'revisao',      label: 'Revisão',      icon: '🔄', color: 'coral'  },
  { id: 'entregue',     label: 'Entregue',     icon: '✅', color: 'green'  },
];

const PRIORITIES = ['Alta', 'Média', 'Baixa'];
const TYPES = ['Processo', 'Melhoria', 'Automação', 'Fluxo', 'Outro'];

// ── STORAGE ──
const DB = {
  getProjects() { return JSON.parse(localStorage.getItem('fd_projects') || '[]'); },
  saveProjects(p) { localStorage.setItem('fd_projects', JSON.stringify(p)); },
  getIdeas() { return JSON.parse(localStorage.getItem('fd_ideas') || '[]'); },
  saveIdeas(i) { localStorage.setItem('fd_ideas', JSON.stringify(i)); },
};

// ── PROJECT CRUD ──
function createProject(data) {
  const projects = DB.getProjects();
  const project = {
    id: 'p_' + Date.now(),
    title: data.title,
    description: data.description || '',
    type: data.type || 'Processo',
    priority: data.priority || 'Média',
    responsible: data.responsible || '',
    stage: data.stage || 'ideia',
    progress: 0,
    problem: data.problem || '',
    scope: data.scope || '',
    deadline: data.deadline || '',
    updates: [],
    blockers: '',
    result: '',
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.push(project);
  DB.saveProjects(projects);
  return project;
}

function updateProject(id, data) {
  const projects = DB.getProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return null;
  projects[idx] = { ...projects[idx], ...data, updatedAt: new Date().toISOString() };
  DB.saveProjects(projects);
  return projects[idx];
}

function deleteProject(id) {
  const projects = DB.getProjects().filter(p => p.id !== id);
  DB.saveProjects(projects);
}

function getProjectsByStage(stage) {
  return DB.getProjects().filter(p => p.stage === stage);
}

// ── IDEA CRUD ──
function createIdea(data) {
  const ideas = DB.getIdeas();
  const idea = {
    id: 'i_' + Date.now(),
    title: data.title,
    description: data.description || '',
    category: data.category || '',
    createdAt: new Date().toISOString(),
  };
  ideas.push(idea);
  DB.saveIdeas(ideas);
  return idea;
}

function deleteIdea(id) {
  DB.saveIdeas(DB.getIdeas().filter(i => i.id !== id));
}

function promoteIdeaToProject(ideaId) {
  const ideas = DB.getIdeas();
  const idea = ideas.find(i => i.id === ideaId);
  if (!idea) return;
  const project = createProject({
    title: idea.title,
    description: idea.description,
    stage: 'ideia',
  });
  deleteIdea(ideaId);
  return project;
}

// ── METRICS ──
function getMetrics() {
  const projects = DB.getProjects();
  const total = projects.length;
  const delivered = projects.filter(p => p.stage === 'entregue').length;
  const inProgress = projects.filter(p =>
    ['execucao', 'planejamento', 'diagnostico'].includes(p.stage)
  ).length;
  const pending = projects.filter(p => p.stage === 'ideia').length;
  const review = projects.filter(p => p.stage === 'revisao').length;
  const highPriority = projects.filter(p => p.priority === 'Alta' && p.stage !== 'entregue').length;

  return { total, delivered, inProgress, pending, review, highPriority };
}

// ── STAGE HELPERS ──
function stageIndex(stageId) {
  return STAGES.findIndex(s => s.id === stageId);
}

function nextStage(stageId) {
  const idx = stageIndex(stageId);
  return idx < STAGES.length - 1 ? STAGES[idx + 1].id : stageId;
}

function prevStage(stageId) {
  const idx = stageIndex(stageId);
  return idx > 0 ? STAGES[idx - 1].id : stageId;
}

// ── DATE HELPERS ──
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days/7)}sem atrás`;
  return `${Math.floor(days/30)}m atrás`;
}

// ── TOAST ──
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.innerHTML = '<div class="toast-dot"></div><span id="toast-msg"></span>';
    document.body.appendChild(toast);
  }
  document.getElementById('toast-msg').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── CHECKLIST ──
function addChecklistItem(projectId, text) {
  const p = DB.getProjects().find(x => x.id === projectId);
  if (!p || !text.trim()) return;
  const checklist = p.checklist || [];
  checklist.push({ id: 'ck_' + Date.now(), text: text.trim(), done: false, createdAt: new Date().toISOString() });
  updateProject(projectId, { checklist });
  autoUpdateProgress(projectId);
}

function toggleChecklistItem(projectId, itemId) {
  const p = DB.getProjects().find(x => x.id === projectId);
  if (!p) return;
  const checklist = (p.checklist || []).map(item =>
    item.id === itemId ? { ...item, done: !item.done } : item
  );
  updateProject(projectId, { checklist });
  autoUpdateProgress(projectId);
}

function deleteChecklistItem(projectId, itemId) {
  const p = DB.getProjects().find(x => x.id === projectId);
  if (!p) return;
  const checklist = (p.checklist || []).filter(i => i.id !== itemId);
  updateProject(projectId, { checklist });
  autoUpdateProgress(projectId);
}

function autoUpdateProgress(projectId) {
  const p = DB.getProjects().find(x => x.id === projectId);
  if (!p || !p.checklist || p.checklist.length === 0) return;
  const done = p.checklist.filter(i => i.done).length;
  const progress = Math.round((done / p.checklist.length) * 100);
  updateProject(projectId, { progress });
}


function addImageToProject(projectId, base64, name, imageObj) {
  const p = DB.getProjects().find(x => x.id === projectId);
  if (!p) return;
  const images = p.images || [];
  if (imageObj) {
    images.push(imageObj);
  } else {
    images.push({ id: 'img_' + Date.now(), base64, name, addedAt: new Date().toISOString() });
  }
  updateProject(projectId, { images });
}

function removeImageFromProject(projectId, imgId) {
  const p = DB.getProjects().find(x => x.id === projectId);
  if (!p) return;
  updateProject(projectId, { images: (p.images || []).filter(i => i.id !== imgId) });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// ── SIDEBAR ACTIVE STATE ──
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ── SEED DATA (first run only) ──
function seedIfEmpty() {
  if (localStorage.getItem('fd_seeded')) return;
  localStorage.setItem('fd_seeded', '1');

  const seeds = [
    {
      title: 'Automatizar preenchimento do relatório semanal',
      description: 'O time gasta ~2h toda semana preenchendo manualmente o relatório de produtividade. Criar template automático via planilha.',
      type: 'Automação', priority: 'Alta', stage: 'execucao', progress: 60,
      problem: 'Processo manual e repetitivo consome tempo valioso',
      responsible: 'Você', deadline: '2025-02-28',
      checklist: [
        { id: 'ck_s1', text: 'Mapear campos do relatório atual', done: true, createdAt: new Date().toISOString() },
        { id: 'ck_s2', text: 'Criar template na planilha', done: true, createdAt: new Date().toISOString() },
        { id: 'ck_s3', text: 'Testar com o time', done: false, createdAt: new Date().toISOString() },
        { id: 'ck_s4', text: 'Validar com gestor', done: false, createdAt: new Date().toISOString() },
      ],
    },
    {
      title: 'Padronizar nomenclatura de arquivos',
      description: 'Arquivos sem padrão de nome causam dificuldade de localização. Criar guia e processo de arquivamento.',
      type: 'Processo', priority: 'Média', stage: 'planejamento', progress: 30,
      problem: 'Dificuldade em localizar arquivos, retrabalho constante',
      responsible: 'Você',
    },
    {
      title: 'Mapeamento do fluxo de aprovação de compras',
      description: 'O processo de aprovação demora muito e não tem visibilidade. Mapear e propor melhoria.',
      type: 'Fluxo', priority: 'Alta', stage: 'diagnostico', progress: 15,
      problem: 'Aprovações levam até 5 dias sem visibilidade do status',
      responsible: 'Você',
    },
    {
      title: 'Onboarding de novos colaboradores',
      description: 'Processo de integração não é padronizado. Criamos checklist e fluxo de boas vindas.',
      type: 'Processo', priority: 'Média', stage: 'entregue', progress: 100,
      responsible: 'Você', result: 'Checklist criado e validado pelo RH',
    },
  ];

  seeds.forEach(s => createProject(s));

  // Seed ideas
  createIdea({ title: 'Dashboard de KPIs do time', description: 'Painel visual com métricas de desempenho atualizado em tempo real.', category: 'Automação' });
  createIdea({ title: 'Processo de fechamento mensal', description: 'Padronizar e documentar todas as etapas do fechamento para reduzir erros.', category: 'Processo' });
}
