// ── NEXUS — Firebase Integration ──

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAWRZHjsUXAUj9jSJxgAFlIwp7u0LitkVU",
  authDomain: "outtax-nexus-d3d56.firebaseapp.com",
  projectId: "outtax-nexus-d3d56",
  storageBucket: "outtax-nexus-d3d56.firebasestorage.app",
  messagingSenderId: "1065768699282",
  appId: "1:1065768699282:web:c12fd11c4de163bb236d4b"
};

// ── Firebase SDK via CDN ──
let db = null;
let auth = null;
let currentUser = null;
let fbReady = false;
let onAuthChangeCallbacks = [];

async function firebaseInit() {
  return new Promise((resolve) => {
    if (typeof firebase !== 'undefined') {
      _initFirebase();
      resolve();
      return;
    }
    // Load Firebase scripts dynamically
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
    ];
    let loaded = 0;
    scripts.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          _initFirebase();
          resolve();
        }
      };
      document.head.appendChild(s);
    });
  });
}

function _initFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  db = firebase.firestore();
  auth = firebase.auth();

  auth.onAuthStateChanged(user => {
    currentUser = user;
    fbReady = true;
    updateFirebaseUI();
    onAuthChangeCallbacks.forEach(cb => cb(user));
  });
}

function onAuthChange(cb) {
  onAuthChangeCallbacks.push(cb);
}

// ── AUTH ──
function fbSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error('Sign in error:', err);
    showToast('Erro ao fazer login: ' + err.message);
  });
}

function fbSignOut() {
  auth.signOut().then(() => {
    showToast('Logout realizado');
    updateFirebaseUI();
  });
}

function fbIsSignedIn() {
  return !!currentUser;
}

function fbGetUser() {
  return currentUser;
}

// ── FIRESTORE HELPERS ──
function fbCollection(name) {
  return db.collection(name);
}

// Projects
async function fbGetProjects() {
  if (!currentUser) return DB.getProjects();
  try {
    const snap = await db.collection('projects')
      .where('userId', '==', currentUser.uid)
      .get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (e) {
    console.error('fbGetProjects error:', e);
    return DB.getProjects();
  }
}

async function fbSaveProject(project) {
  if (!currentUser) return;
  const data = { ...project, userId: currentUser.uid, updatedAt: new Date().toISOString() };
  await db.collection('projects').doc(project.id).set(data);
}

async function fbDeleteProject(id) {
  if (!currentUser) return;
  await db.collection('projects').doc(id).delete();
}

// Ideas
async function fbGetIdeas() {
  if (!currentUser) return DB.getIdeas();
  try {
    const snap = await db.collection('ideas')
      .where('userId', '==', currentUser.uid)
      .get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) {
    console.error('fbGetIdeas error:', e);
    return DB.getIdeas();
  }
}

async function fbSaveIdea(idea) {
  if (!currentUser) return;
  const data = { ...idea, userId: currentUser.uid };
  await db.collection('ideas').doc(idea.id).set(data);
}

async function fbDeleteIdea(id) {
  if (!currentUser) return;
  await db.collection('ideas').doc(id).delete();
}

// ── MIGRATE local data to Firebase on first login ──
async function migrateLocalToFirebase() {
  const migrated = localStorage.getItem('fd_migrated');
  if (migrated) return;

  const localProjects = DB.getProjects();
  const localIdeas = DB.getIdeas();

  if (localProjects.length === 0 && localIdeas.length === 0) {
    localStorage.setItem('fd_migrated', '1');
    return;
  }

  showToast('Migrando dados para a nuvem...');

  for (const p of localProjects) {
    await fbSaveProject(p);
  }
  for (const i of localIdeas) {
    await fbSaveIdea(i);
  }

  localStorage.setItem('fd_migrated', '1');
  showToast('Dados migrados para o Firebase!');
}

// ── UI ──
function updateFirebaseUI() {
  const loginBtn = document.getElementById('fb-login-btn');
  const userInfo = document.getElementById('fb-user-info');
  const userName = document.getElementById('fb-user-name');
  const userAvatar = document.getElementById('fb-user-avatar');

  if (!loginBtn) return;

  if (currentUser) {
    loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userName) userName.textContent = currentUser.displayName?.split(' ')[0] || 'Usuário';
    if (userAvatar && currentUser.photoURL) userAvatar.src = currentUser.photoURL;
  } else {
    loginBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
  }
}
