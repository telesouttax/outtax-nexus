// ── NEXUS — Google Drive Integration ──

const DRIVE_CLIENT_ID = '701030561562-s4oineknhj80clti073dvt5g0k9peuoc.apps.googleusercontent.com';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const NEXUS_FOLDER_NAME = 'Nexus — Projetos';

let driveTokenClient = null;
let driveAccessToken = null;
let driveRootFolderId = null;

// ── INIT ──
function driveInit() {
  return new Promise((resolve) => {
    if (typeof google === 'undefined') { resolve(false); return; }
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPES,
      callback: async (response) => {
        if (response.error) { console.error('Drive auth error:', response); return; }
        driveAccessToken = response.access_token;
        localStorage.setItem('nd_drive_token', response.access_token);
        driveRootFolderId = await driveGetOrCreateFolder(NEXUS_FOLDER_NAME, null);
        updateDriveUI(true);
      },
    });

    const savedToken = localStorage.getItem('nd_drive_token');
    if (savedToken) {
      driveAccessToken = savedToken;
      driveGetOrCreateFolder(NEXUS_FOLDER_NAME, null).then(id => {
        driveRootFolderId = id;
        updateDriveUI(true);
      }).catch(() => {
        driveAccessToken = null;
        localStorage.removeItem('nd_drive_token');
        updateDriveUI(false);
      });
    } else {
      updateDriveUI(false);
    }
    resolve(true);
  });
}

function driveSignIn() {
  if (!driveTokenClient) return;
  driveTokenClient.requestAccessToken({ prompt: 'consent' });
}

function driveSignOut() {
  if (driveAccessToken) {
    google.accounts.oauth2.revoke(driveAccessToken);
  }
  driveAccessToken = null;
  driveRootFolderId = null;
  localStorage.removeItem('nd_drive_token');
  updateDriveUI(false);
  showToast('Desconectado do Google Drive');
}

function driveIsConnected() {
  return !!driveAccessToken;
}

function updateDriveUI(connected) {
  const btn = document.getElementById('drive-connect-btn');
  const status = document.getElementById('drive-status');
  if (!btn) return;
  if (connected) {
    btn.innerHTML = '<i class="ti ti-brand-google-drive"></i> Drive conectado';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'rgba(34,197,94,0.3)';
    btn.onclick = driveSignOut;
    if (status) { status.textContent = 'Imagens salvas no Google Drive'; status.style.color = 'var(--green)'; }
  } else {
    btn.innerHTML = '<i class="ti ti-brand-google-drive"></i> Conectar Drive';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.onclick = driveSignIn;
    if (status) { status.textContent = 'Conecte o Drive para salvar imagens na nuvem'; status.style.color = 'var(--text-muted)'; }
  }
}

// ── FOLDER HELPERS ──
async function driveApiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${driveAccessToken}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    driveAccessToken = null;
    localStorage.removeItem('nd_drive_token');
    updateDriveUI(false);
    throw new Error('Token expirado — reconecte o Drive');
  }
  return res;
}

async function driveGetOrCreateFolder(name, parentId) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const res = await driveApiRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) return data.files[0].id;

  const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];

  const createRes = await driveApiRequest('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  const created = await createRes.json();
  return created.id;
}

async function driveGetProjectFolder(projectTitle) {
  if (!driveRootFolderId) {
    driveRootFolderId = await driveGetOrCreateFolder(NEXUS_FOLDER_NAME, null);
  }
  const safeName = projectTitle.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 80);
  return driveGetOrCreateFolder(safeName, driveRootFolderId);
}

// ── UPLOAD IMAGE ──
async function driveUploadImage(file, projectTitle) {
  if (!driveAccessToken) throw new Error('Drive não conectado');

  const folderId = await driveGetProjectFolder(projectTitle);

  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await driveApiRequest(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink',
    { method: 'POST', body: form }
  );

  if (!res.ok) throw new Error('Falha no upload');
  const data = await res.json();

  // Make file viewable by anyone with link
  await driveApiRequest(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${data.id}&sz=w200`,
    driveFileId: data.id,
  };
}

// ── DELETE IMAGE ──
async function driveDeleteImage(fileId) {
  if (!driveAccessToken) return;
  try {
    await driveApiRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
    });
  } catch (e) {
    console.warn('Could not delete from Drive:', e);
  }
}
