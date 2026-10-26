// ============ CONFIG API ============
const API_URL = 'https://cagnotte-api.boutiqueleosi.workers.dev';
const ADMIN_KEY = 'MaSuperCle2026_x7K9';

// ============ DONNÉES ============
let data = {
  users: [],
  plans: {},
  paiements: [],
  depenses: [],
  categories: [
    { id: 'alim', nom: 'Alimentaire', icone: '🍚' },
    { id: 'hyg', nom: 'Hygiène', icone: '🧴' },
    { id: 'bois', nom: 'Boissons', icone: '🥤' },
    { id: 'men', nom: 'Ménage', icone: '🧹' },
    { id: 'autre', nom: 'Autre', icone: '📦' }
  ],
  magasins: [
    { id: 'marche', nom: 'Marché' },
    { id: 'super', nom: 'Supermarché' },
    { id: 'boutique', nom: 'Boutique' }
  ]
};

let moisCourant = new Date().toISOString().slice(0, 7);
let achatsTemp = [];
let currentUser = null;
let dataLoaded = false;

// ============ CLOUDFLARE API ============
async function chargerDonnees() {
  try {
    const res = await fetch(`${API_URL}/data`);
    const json = await res.json();
    if (json.ok && json.data) {
      data = json.data;
      // On s'assure que la session n'est pas dans les données partagées
      if (data.session) delete data.session; 
      dataLoaded = true;
    } else {
      dataLoaded = true;
      await sauvegarderServeur();
    }
  } catch (err) {
    console.error('Erreur chargement:', err);
    toast('⚠️ Impossible de contacter le serveur.', 'danger');
  }
}

async function sauvegarderServeur() {
  try {
    // On ne sauvegarde JAMAIS la session sur le serveur, seulement les vraies données
    const dataToSave = { ...data };
    delete dataToSave.session;

    const res = await fetch(`${API_URL}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY
      },
      body: JSON.stringify({ data: dataToSave })
    });
    if (!res.ok) console.error('Sauvegarde échouée');
  } catch (err) {
    console.error('Erreur sauvegarde:', err);
    toast('⚠️ Sauvegarde échouée. Vérifie ta connexion.', 'danger');
  }
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

// ============ UTILS ============
function formatF(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n * 100) / 100) + ' F';
}
function nomMois(yyyymm) {
  const [y, m] = yyyymm.split('-');
  const d = new Date(y, m - 1, 1);
  const nom = d.toLocaleDateString('fr-FR', { month: 'long' });
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}
function nomMoisComplet(yyyymm) {
  const [y, m] = yyyymm.split('-');
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function initiales(nom) {
  return nom.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function genId() {
  return 'i' + Date.now() + Math.random().toString(36).substr(2, 5);
}
function getCat(id) { return data.categories.find(c => c.id === id); }
function getMag(id) { return data.magasins.find(m => m.id === id); }

// ============ TOAST ============
function toast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', warn: '⚠️', danger: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============ AUTH ============
async function initialiserAuth() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  
  await chargerDonnees();
  
  // ⚠️ LIT LA SESSION DEPUIS LE LOCALSTORAGE LOCAL DU NAVIGATEUR
  const localSessionId = localStorage.getItem('cagnotteSessionId');
  
  if (localSessionId) {
    const user = data.users.find(u => u.id === localSessionId);
    if (user) {
      currentUser = user;
      afficherApp();
      return;
    } else {
      // Si l'utilisateur n'existe plus (supprimé), on nettoie
      localStorage.removeItem('cagnotteSessionId');
    }
  }
  
  afficherLogin();
}

function afficherLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  const setupDiv = document.getElementById('setupAdmin');
  const loginDiv = document.getElementById('loginForm');
  
  if (data.users.length === 0) {
    setupDiv.style.display = 'block';
    loginDiv.style.display = 'none';
  } else {
    setupDiv.style.display = 'none';
    loginDiv.style.display = 'block';
    const sel = document.getElementById('loginMembre');
    sel.innerHTML = data.users.map(u => 
      `<option value="${u.id}">${u.role === 'admin' ? '👑 ' : '👤 '}${escapeHtml(u.nom)}</option>`
    ).join('');
    document.getElementById('loginPwd').value = '';
    document.getElementById('loginError').style.display = 'none';
  }
}

function creerAdmin() {
  const nom = document.getElementById('setupNom').value.trim();
  const pwd = document.getElementById('setupPwd').value;
  const pwd2 = document.getElementById('setupPwd2').value;
  const err = document.getElementById('setupError');
  
  if (!nom) { err.textContent = 'Entre un nom'; err.style.display = 'block'; return; }
  if (!pwd || pwd.length < 3) { err.textContent = 'Mot de passe trop court (min 3)'; err.style.display = 'block'; return; }
  if (pwd !== pwd2) { err.textContent = 'Les mots de passe ne correspondent pas'; err.style.display = 'block'; return; }
  
  const user = { id: genId(), nom, pwd, role: 'admin' };
  data.users.push(user);
  currentUser = user;
  
  // On sauvegarde la session DANS LE NAVIGATEUR (pas sur le serveur)
  localStorage.setItem('cagnotteSessionId', user.id); 
  sauvegarderServeur();
  
  err.style.display = 'none';
  afficherApp();
  toast('Compte Admin créé !', 'success');
}

function tenterConnexion() {
  const userId = document.getElementById('loginMembre').value;
  const pwd = document.getElementById('loginPwd').value;
  const err = document.getElementById('loginError');
  
  const user = data.users.find(u => u.id === userId);
  if (!user) { err.textContent = 'Utilisateur introuvable'; err.style.display = 'block'; return; }
  if (user.pwd !== pwd) { err.textContent = 'Mot de passe incorrect'; err.style.display = 'block'; return; }
  
  currentUser = user;
  // On sauvegarde la session DANS LE NAVIGATEUR
  localStorage.setItem('cagnotteSessionId', user.id); 
  
  err.style.display = 'none';
  afficherApp();
  toast(`Bienvenue ${user.nom} !`, 'success');
}

function deconnexion() {
  if (!confirm('Se déconnecter ?')) return;
  localStorage.removeItem('cagnotteSessionId'); // Efface la session locale
  currentUser = null;
  afficherLogin();
}

function afficherApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  
  document.getElementById('userBadge').innerHTML = `
    <div class="user-avatar ${currentUser.role === 'admin' ? 'admin' : ''}">${initiales(currentUser.nom)}</div>
    <div class="user-info">
      <div class="user-name">${escapeHtml(currentUser.nom)}</div>
      <div class="user-role">${currentUser.role === 'admin' ? '👑 Admin' : '👤 Membre'}</div>
    </div>
  `;
  
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden-by-role', !isAdmin());
  });
  
  const subtitle = document.getElementById('coursesSubtitle');
  if (subtitle) {
    subtitle.textContent = isAdmin() 
      ? 'Coche ce que tu as déjà acheté' 
      : 'Consulte ce qu\'il faut acheter (lecture seule)';
  }
  
  rafraichir();
  switchPage('dashboard');
}

// ============ NAV ============
function switchPage(page, ev) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const btn = ev ? ev.currentTarget : document.querySelector(`.nav-item[data-page="${page}"]`);
  if (btn) btn.classList.add('active');
  if (window.innerWidth <= 900) closeSidebar();
  
  if (page === 'planification') afficherPlanification();
  if (page === 'historique') afficherHistorique();
  if (page === 'comparaison') afficherComparaison();
  if (page === 'courses') afficherCourses();
  if (page === 'parametres') afficherParams();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ============ THEME ============
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('themeIcon').textContent = next === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeText').textContent = next === 'dark' ? 'Mode clair' : 'Mode sombre';
}
function chargerTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  const txt = document.getElementById('themeText');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (txt) txt.textContent = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
}

// ============ CALCULS ============
function totalVerse() { return data.paiements.reduce((s, p) => s + p.montant, 0); }
function totalDepense() { return data.depenses.reduce((s, d) => s + d.montant, 0); }
function solde() { return totalVerse() - totalDepense(); }
function verseMoisMembre(membre, mois) {
  return data.paiements.filter(p => p.mois === mois && p.membre === membre).reduce((s, p) => s + p.montant, 0);
}
function totalVerseMois(mois) {
  return data.paiements.filter(p => p.mois === mois).reduce((s, p) => s + p.montant, 0);
}
function totalDepenseMois(mois) {
  return data.depenses.filter(d => d.mois === mois).reduce((s, d) => s + d.montant, 0);
}

// ============ PLAN ============
function getPlan(mois) { return data.plans[mois] || null; }
function calculBudgetPlan(plan) {
  if (!plan || !plan.achats) return 0;
  return plan.achats.reduce((s, a) => s + (a.prix * (a.qte || 1)), 0);
}
function getCotisationParPersonne(mois) {
  const plan = getPlan(mois);
  if (!plan || !plan.nbPersonnes) return 0;
  return calculBudgetPlan(plan) / plan.nbPersonnes;
}
function getMembresDuMois(mois) {
  const plan = getPlan(mois);
  if (!plan) return [];
  if (plan.membres && plan.membres.length) return plan.membres;
  return Array.from({ length: plan.nbPersonnes }, (_, i) => `Personne ${i + 1}`);
}

// ============ MOIS ============
function changerMois(delta) {
  const [y, m] = moisCourant.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  moisCourant = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  achatsTemp = [];
  rafraichir();
}
function afficherMoisNav() {
  document.getElementById('moisLabel').textContent = nomMois(moisCourant);
  document.getElementById('anneeLabel').textContent = moisCourant.split('-')[0];
}

// ============ DASHBOARD ============
function afficherDashboard() {
  const plan = getPlan(moisCourant);
  const etat = document.getElementById('etatPlanification');
  const content = document.getElementById('dashboardContent');
  
  if (!plan || !plan.achats || plan.achats.length === 0) {
    etat.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Pas encore de planification</div>
        <div class="empty-state-desc">
          ${isAdmin() ? 'Tu n\'as pas encore listé ce que vous allez consommer pour <strong>' + nomMoisComplet(moisCourant) + '</strong>.' : 'L\'admin n\'a pas encore planifié ce mois.'}
        </div>
        ${isAdmin() ? '<button class="btn primary" onclick="switchPage(\'planification\')">📋 Planifier ce mois</button>' : ''}
      </div>
    `;
    content.style.display = 'none';
    return;
  }
  
  etat.innerHTML = '';
  content.style.display = 'block';
  
  const cot = getCotisationParPersonne(moisCourant);
  const membres = getMembresDuMois(moisCourant);
  const budget = calculBudgetPlan(plan);
  const vMois = totalVerseMois(moisCourant);
  const dMois = totalDepenseMois(moisCourant);
  const reste = Math.max(0, budget - vMois);
  const pct = budget > 0 ? Math.min(100, Math.round(vMois / budget * 100)) : 0;
  const v = totalVerse(), d = totalDepense(), s = solde();
  
  document.getElementById('soldeCagnotte').textContent = formatF(s);
  document.getElementById('soldeCagnotte').style.color = s < 0 ? '#fecaca' : 'white';
  document.getElementById('totalVerse').textContent = formatF(v);
  document.getElementById('totalDepense').textContent = formatF(d);
  document.getElementById('soldeMois').textContent = formatF(vMois - dMois);
  
  document.getElementById('statBudget').textContent = formatF(budget);
  document.getElementById('statBudgetSub').textContent = `${plan.nbPersonnes} pers. × ${formatF(cot)}`;
  document.getElementById('statVerseMois').textContent = formatF(vMois);
  document.getElementById('statVerseMoisSub').textContent = `${pct}% de l'objectif`;
  document.getElementById('statReste').textContent = formatF(reste);
  document.getElementById('statResteSub').textContent = reste > 0 ? 'En attente' : 'Tout payé !';
  document.getElementById('statDepenseMois').textContent = formatF(dMois);
  document.getElementById('statDepenseMoisSub').textContent = `${data.depenses.filter(dep => dep.mois === moisCourant).length} dépense(s)`;
  
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('badgeProgression').textContent = pct + '%';
  document.getElementById('progressVerse').textContent = `${formatF(vMois)} versé`;
  document.getElementById('progressObjectif').textContent = `Objectif : ${formatF(budget)}`;
  
  document.getElementById('badgeAchats').textContent = `${plan.achats.length} article(s)`;
  document.getElementById('achatsPrevueContainer').innerHTML = plan.achats.map(a => {
    const cat = getCat(a.catId);
    return `<div class="achat-preview-item">
      <div>
        <div class="achat-preview-nom">${cat ? cat.icone + ' ' : ''}${escapeHtml(a.nom)}</div>
        <div style="font-size:0.72em; color:var(--text-muted);">${a.qte || 1} × ${formatF(a.prix)}</div>
      </div>
      <div class="achat-preview-prix">${formatF(a.prix * (a.qte || 1))}</div>
    </div>`;
  }).join('');
  
  document.getElementById('membresContainer').innerHTML = membres.map(m => {
    const verse = verseMoisMembre(m, moisCourant);
    let statut, label;
    if (verse >= cot) { statut = 'ok'; label = '✅ Payé'; }
    else if (verse > 0) { statut = 'warn'; label = '⚠️ Partiel'; }
    else { statut = 'danger'; label = '❌ Non payé'; }
    
    const user = data.users.find(u => u.nom === m);
    const isAdminUser = user && user.role === 'admin';
    
    return `<div class="membre-card ${statut}">
      <div class="membre-header">
        <div class="membre-nom">
          <div class="membre-avatar ${isAdminUser ? 'admin' : ''}">${initiales(m)}</div>
          ${escapeHtml(m)} ${isAdminUser ? '👑' : ''}
        </div>
        <span class="statut ${statut}">${label}</span>
      </div>
      <div class="membre-ligne"><span>Doit verser</span><strong>${formatF(cot)}</strong></div>
      <div class="membre-ligne"><span>A versé</span><strong>${formatF(verse)}</strong></div>
      <div class="membre-ligne"><span>Reste</span><strong style="color:${cot - verse > 0 ? 'var(--danger)' : 'var(--success)'}">${formatF(Math.max(0, cot - verse))}</strong></div>
    </div>`;
  }).join('');
}

// ============ PLANIFICATION ============
function afficherPlanification() {
  const plan = getPlan(moisCourant);
  const isAdm = isAdmin();
  
  document.getElementById('cardAjoutArticle').style.display = isAdm ? 'block' : 'none';
  document.getElementById('cardListeRO').style.display = isAdm ? 'none' : 'block';
  
  if (plan && plan.achats) {
    achatsTemp = plan.achats.map(a => ({ ...a }));
  } else if (achatsTemp.length === 0) {
    achatsTemp = [];
  }
  
  remplirSelectsCategoriesMagasins();
  
  if (isAdm) {
    afficherAchatsList();
  } else {
    afficherAchatsListRO();
  }
  
  mettreAJourTotal();
  
  if (isAdm) {
    document.getElementById('planNbPersonnes').value = (plan && plan.nbPersonnes) || 3;
    document.getElementById('btnSupprimerPlan').style.display = plan ? 'inline-flex' : 'none';
    genererChampsNoms();
    if (plan && plan.membres) {
      plan.membres.forEach((nom, i) => {
        const input = document.getElementById(`membreNoms-${i}`);
        if (input) input.value = nom;
      });
    }
  }
  
  mettreAJourApercu();
  
  const articles = new Set();
  Object.values(data.plans).forEach(p => p.achats && p.achats.forEach(a => articles.add(a.nom)));
  const dl = document.getElementById('listeArticles');
  if (dl) dl.innerHTML = [...articles].map(a => `<option value="${escapeHtml(a)}">`).join('');
}

function remplirSelectsCategoriesMagasins() {
  const catSel = document.getElementById('achatCategorie');
  const magSel = document.getElementById('achatMagasin');
  if (catSel) catSel.innerHTML = data.categories.map(c => `<option value="${c.id}">${c.icone} ${escapeHtml(c.nom)}</option>`).join('');
  if (magSel) magSel.innerHTML = data.magasins.map(m => `<option value="${m.id}">${escapeHtml(m.nom)}</option>`).join('');
}

function afficherAchatsList() {
  const c = document.getElementById('achatsListContainer');
  if (!c) return;
  
  if (achatsTemp.length === 0) {
    c.innerHTML = '<div class="muted" style="text-align:center; padding:24px;">Aucun article. Ajoute ce que vous allez consommer ce mois.</div>';
    return;
  }
  
  c.innerHTML = achatsTemp.map((a, i) => {
    const cat = getCat(a.catId);
    const mag = getMag(a.magId);
    return `<div class="achat-item ${a.achete ? 'achete' : ''}">
      <div class="achat-item-icon" style="background:${cat ? 'var(--primary-light)' : 'var(--surface-3)'};">${cat ? cat.icone : '📦'}</div>
      <div class="achat-item-info">
        <div class="achat-item-nom">${escapeHtml(a.nom)}</div>
        <div class="achat-item-detail">
          ${cat ? `<span class="achat-tag cat">${escapeHtml(cat.nom)}</span>` : ''}
          ${mag ? `<span class="achat-tag mag">🏪 ${escapeHtml(mag.nom)}</span>` : ''}
          <span>${a.qte || 1} × ${formatF(a.prix)}</span>
        </div>
      </div>
      <div class="achat-item-prix">${formatF(a.prix * (a.qte || 1))}</div>
      <div class="achat-item-actions">
        <button class="check" onclick="toggleAchete(${i})" title="${a.achete ? 'Décocher' : 'Marquer acheté'}">${a.achete ? '↩️' : '✅'}</button>
        <button class="edit" onclick="ouvrirEditAchat(${i})" title="Modifier">✏️</button>
        <button class="del" onclick="supprimerAchat(${i})" title="Supprimer">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function afficherAchatsListRO() {
  const c = document.getElementById('achatsListContainerRO');
  const badge = document.getElementById('badgePlanAchats');
  if (badge) badge.textContent = `${achatsTemp.length} article(s)`;
  if (!c) return;
  
  if (achatsTemp.length === 0) {
    c.innerHTML = '<div class="muted" style="text-align:center; padding:24px;">Aucun article planifié.</div>';
    return;
  }
  
  c.innerHTML = achatsTemp.map(a => {
    const cat = getCat(a.catId);
    const mag = getMag(a.magId);
    return `<div class="achat-item ${a.achete ? 'achete' : ''}">
      <div class="achat-item-icon" style="background:${cat ? 'var(--primary-light)' : 'var(--surface-3)'};">${cat ? cat.icone : '📦'}</div>
      <div class="achat-item-info">
        <div class="achat-item-nom">${escapeHtml(a.nom)}</div>
        <div class="achat-item-detail">
          ${cat ? `<span class="achat-tag cat">${escapeHtml(cat.nom)}</span>` : ''}
          ${mag ? `<span class="achat-tag mag">🏪 ${escapeHtml(mag.nom)}</span>` : ''}
          <span>${a.qte || 1} × ${formatF(a.prix)}</span>
        </div>
      </div>
      <div class="achat-item-prix">${formatF(a.prix * (a.qte || 1))}</div>
    </div>`;
  }).join('');
}

async function ajouterAchat() {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  const nom = document.getElementById('achatNom').value.trim();
  const catId = document.getElementById('achatCategorie').value;
  const magId = document.getElementById('achatMagasin').value;
  const prix = parseFloat(document.getElementById('achatPrix').value);
  const qte = parseFloat(document.getElementById('achatQte').value) || 1;
  
  if (!nom) return toast('Entre un nom d\'article', 'warn');
  if (isNaN(prix) || prix <= 0) return toast('Prix invalide', 'warn');
  if (isNaN(qte) || qte <= 0) return toast('Quantité invalide', 'warn');
  
  achatsTemp.push({ id: genId(), nom, catId, magId, prix, qte, achete: false });
  
  const plan = getPlan(moisCourant);
  if (plan) {
    plan.achats = achatsTemp.map(x => ({ ...x }));
  } else {
    data.plans[moisCourant] = { 
      achats: achatsTemp.map(x => ({ ...x })), 
      nbPersonnes: parseInt(document.getElementById('planNbPersonnes').value) || 3, 
      membres: [] 
    };
  }
  await sauvegarderServeur();
  
  document.getElementById('achatNom').value = '';
  document.getElementById('achatPrix').value = '';
  document.getElementById('achatQte').value = '1';
  document.getElementById('achatNom').focus();
  
  afficherAchatsList();
  mettreAJourTotal();
  mettreAJourApercu();
  toast(`"${nom}" ajouté et sauvegardé`, 'success');
}

async function toggleAchete(i) {
  if (!isAdmin()) return toast('Seul l\'admin peut cocher', 'warn');
  achatsTemp[i].achete = !achatsTemp[i].achete;
  afficherAchatsList();
  
  const plan = getPlan(moisCourant);
  if (plan && plan.achats) {
    plan.achats = achatsTemp.map(x => ({ ...x }));
    await sauvegarderServeur();
  }
  
  if (document.getElementById('page-courses').classList.contains('active')) afficherCourses();
}

async function supprimerAchat(i) {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  const a = achatsTemp[i];
  if (!confirm(`Supprimer "${a.nom}" ?`)) return;
  achatsTemp.splice(i, 1);
  
  const plan = getPlan(moisCourant);
  if (plan) {
    plan.achats = achatsTemp.map(x => ({ ...x }));
    await sauvegarderServeur();
  }
  
  afficherAchatsList();
  mettreAJourTotal();
  mettreAJourApercu();
  toast('Article supprimé', 'info');
}

function ouvrirEditAchat(i) {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  const a = achatsTemp[i];
  if (!a) return;
  
  document.getElementById('editAchatId').value = i;
  document.getElementById('editAchatNom').value = a.nom;
  document.getElementById('editAchatPrix').value = a.prix;
  document.getElementById('editAchatQte').value = a.qte || 1;
  document.getElementById('editAchatCategorie').innerHTML = data.categories.map(c => 
    `<option value="${c.id}" ${c.id === a.catId ? 'selected' : ''}>${c.icone} ${escapeHtml(c.nom)}</option>`
  ).join('');
  document.getElementById('editAchatMagasin').innerHTML = data.magasins.map(m => 
    `<option value="${m.id}" ${m.id === a.magId ? 'selected' : ''}>${escapeHtml(m.nom)}</option>`
  ).join('');
  
  document.getElementById('modalEditAchat').classList.add('active');
  setTimeout(() => document.getElementById('editAchatNom').focus(), 100);
}

async function validerEditAchat() {
  if (!isAdmin()) return;
  const i = parseInt(document.getElementById('editAchatId').value);
  const nom = document.getElementById('editAchatNom').value.trim();
  const catId = document.getElementById('editAchatCategorie').value;
  const magId = document.getElementById('editAchatMagasin').value;
  const prix = parseFloat(document.getElementById('editAchatPrix').value);
  const qte = parseFloat(document.getElementById('editAchatQte').value) || 1;
  
  if (!nom) return toast('Entre un nom d\'article', 'warn');
  if (isNaN(prix) || prix <= 0) return toast('Prix invalide', 'warn');
  if (isNaN(qte) || qte <= 0) return toast('Quantité invalide', 'warn');
  
  achatsTemp[i] = { ...achatsTemp[i], nom, catId, magId, prix, qte };
  
  const plan = getPlan(moisCourant);
  if (plan && plan.achats) {
    plan.achats = achatsTemp.map(x => ({ ...x }));
    await sauvegarderServeur();
  }
  
  fermerModalDirect('modalEditAchat');
  afficherAchatsList();
  mettreAJourTotal();
  mettreAJourApercu();
  toast('Article modifié', 'success');
}

function mettreAJourTotal() {
  const total = achatsTemp.reduce((s, a) => s + (a.prix * (a.qte || 1)), 0);
  const tb = document.getElementById('totalBudget');
  const ta = document.getElementById('totalArticles');
  if (tb) tb.textContent = formatF(total);
  if (ta) ta.textContent = `${achatsTemp.length} article(s)`;
}

function mettreAJourApercu() {
  const total = achatsTemp.reduce((s, a) => s + (a.prix * (a.qte || 1)), 0);
  const nbEl = document.getElementById('planNbPersonnes');
  const nb = nbEl ? parseInt(nbEl.value) || 0 : 0;
  const preview = document.getElementById('calcPreviewValue');
  const formule = document.getElementById('calcPreviewFormule');
  if (!preview || !formule) return;
  
  if (total > 0 && nb > 0) {
    preview.textContent = formatF(total / nb);
    formule.textContent = `${formatF(total)} ÷ ${nb} personne(s)`;
  } else {
    preview.textContent = '0 F';
    formule.textContent = '—';
  }
}

function genererChampsNoms() {
  const nbEl = document.getElementById('planNbPersonnes');
  if (!nbEl) return;
  const nb = parseInt(nbEl.value) || 0;
  const container = document.getElementById('membresNomsContainer');
  if (!container) return;
  container.innerHTML = Array.from({ length: nb }, (_, i) => 
    `<input type="text" id="membreNoms-${i}" placeholder="Personne ${i + 1}" style="margin-bottom:8px;">`
  ).join('');
}

async function enregistrerPlanification() {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  if (achatsTemp.length === 0) return toast('Ajoute au moins un article', 'warn');
  const nb = parseInt(document.getElementById('planNbPersonnes').value);
  if (!nb || nb < 1) return toast('Nombre de personnes invalide', 'warn');
  
  const membres = [];
  for (let i = 0; i < nb; i++) {
    const input = document.getElementById(`membreNoms-${i}`);
    const nom = input ? input.value.trim() : '';
    membres.push(nom || `Personne ${i + 1}`);
  }
  
  const nouveauPlan = {
    achats: achatsTemp.map(a => ({ ...a })),
    nbPersonnes: nb,
    membres
  };
  
  data.plans[moisCourant] = nouveauPlan;
  await sauvegarderServeur();
  
  rafraichir();
  const total = calculBudgetPlan(nouveauPlan);
  toast(`Planification enregistrée : ${formatF(total)} ÷ ${nb} = ${formatF(total / nb)} / pers.`, 'success');
}

async function reinitialiserPlanMois() {
  if (!isAdmin()) return;
  if (!confirm(`Supprimer la planification de ${nomMoisComplet(moisCourant)} ?`)) return;
  delete data.plans[moisCourant];
  achatsTemp = [];
  await sauvegarderServeur();
  rafraichir();
  toast('Planification supprimée', 'info');
}

// ============ COURSES ============
function afficherCourses() {
  const c = document.getElementById('coursesContainer');
  const statsC = document.getElementById('coursesStats');
  const plan = getPlan(moisCourant);
  
  if (!plan || !plan.achats || plan.achats.length === 0) {
    statsC.innerHTML = '';
    c.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🛍️</div>
      <div class="empty-state-title">Aucune liste de courses</div>
      <div class="empty-state-desc">${isAdmin() ? 'Commence par planifier les achats.' : 'L\'admin n\'a pas encore planifié.'}</div>
      ${isAdmin() ? '<button class="btn primary" onclick="switchPage(\'planification\')">📋 Planifier</button>' : ''}
    </div>`;
    return;
  }
  
  const achetes = plan.achats.filter(a => a.achete).length;
  const restants = plan.achats.length - achetes;
  const totalAchete = plan.achats.filter(a => a.achete).reduce((s, a) => s + a.prix * (a.qte || 1), 0);
  
  statsC.innerHTML = `
    <div class="course-stat"><div class="course-stat-value">${plan.achats.length}</div><div class="course-stat-label">Total</div></div>
    <div class="course-stat"><div class="course-stat-value" style="color:var(--success)">${achetes}</div><div class="course-stat-label">Achetés</div></div>
    <div class="course-stat"><div class="course-stat-value" style="color:var(--warning)">${restants}</div><div class="course-stat-label">Restants</div></div>
    <div class="course-stat"><div class="course-stat-value" style="color:var(--primary)">${formatF(totalAchete)}</div><div class="course-stat-label">Déjà dépensé</div></div>
  `;
  
  const clickable = isAdmin();
  c.innerHTML = plan.achats.map((a, i) => {
    const cat = getCat(a.catId);
    const mag = getMag(a.magId);
    return `<div class="course-item ${a.achete ? 'checked' : ''} ${clickable ? 'clickable' : ''}" 
      ${clickable ? `onclick="basculerCourse(${i})"` : ''}>
      <div class="course-check">${a.achete ? '✓' : ''}</div>
      <div class="course-item-info">
        <div class="course-item-nom">${cat ? cat.icone + ' ' : ''}${escapeHtml(a.nom)}</div>
        <div class="course-item-detail">${a.qte || 1} × ${formatF(a.prix)}${mag ? ' · 🏪 ' + escapeHtml(mag.nom) : ''}</div>
      </div>
      <div class="course-item-prix">${formatF(a.prix * (a.qte || 1))}</div>
    </div>`;
  }).join('');
}

async function basculerCourse(idx) {
  if (!isAdmin()) return toast('Seul l\'admin peut cocher', 'warn');
  const plan = getPlan(moisCourant);
  if (!plan) return;
  plan.achats[idx].achete = !plan.achats[idx].achete;
  await sauvegarderServeur();
  rafraichir();
}

// ============ COMPARAISON ============
function afficherComparaison() {
  const cGrid = document.getElementById('compGrid');
  const cTable = document.getElementById('compTable');
  const plan = getPlan(moisCourant);
  
  if (!plan || !plan.achats || plan.achats.length === 0) {
    cGrid.innerHTML = '';
    cTable.innerHTML = '<div class="muted" style="text-align:center; padding:24px;">Aucune donnée à comparer.</div>';
    return;
  }
  
  const budget = calculBudgetPlan(plan);
  const depense = totalDepenseMois(moisCourant);
  const diff = budget - depense;
  
  cGrid.innerHTML = `
    <div class="comp-card">
      <div class="comp-label">📋 Prévu</div>
      <div class="comp-value">${formatF(budget)}</div>
      <div class="comp-sub">${plan.achats.length} article(s)</div>
    </div>
    <div class="comp-card">
      <div class="comp-label">🛒 Dépensé</div>
      <div class="comp-value" style="color:var(--danger)">${formatF(depense)}</div>
      <div class="comp-sub">${data.depenses.filter(d => d.mois === moisCourant).length} dépense(s)</div>
    </div>
    <div class="comp-card">
      <div class="comp-label">${diff >= 0 ? '💰 Économie' : '⚠️ Dépassement'}</div>
      <div class="comp-value" style="color:${diff >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatF(Math.abs(diff))}</div>
      <span class="comp-diff ${diff >= 0 ? 'pos' : 'neg'}">${diff >= 0 ? 'Sous le budget' : 'Au-dessus'}</span>
    </div>
  `;
  
  let html = '<div class="table-wrap"><table><thead><tr><th>Article</th><th>Prévu</th><th>Réel</th><th>Écart</th></tr></thead><tbody>';
  plan.achats.forEach(a => {
    const prevu = a.prix * (a.qte || 1);
    const reel = data.depenses
      .filter(d => d.mois === moisCourant && d.desc.toLowerCase().includes(a.nom.toLowerCase()))
      .reduce((s, d) => s + d.montant, 0);
    const ecart = reel - prevu;
    html += `<tr>
      <td data-label="Article"><strong>${escapeHtml(a.nom)}</strong></td>
      <td data-label="Prévu">${formatF(prevu)}</td>
      <td data-label="Réel">${reel > 0 ? formatF(reel) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td data-label="Écart" class="${reel > 0 ? (ecart > 0 ? 'negative' : 'positive') : ''}">
        ${reel > 0 ? (ecart > 0 ? '+' : '') + formatF(ecart) : '—'}
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  cTable.innerHTML = html;
}

// ============ PAIEMENTS ============
function afficherPaiements() {
  const c = document.getElementById('paiementsContainer');
  const info = document.getElementById('paiementsInfo');
  const plan = getPlan(moisCourant);
  
  if (!plan || !plan.achats || plan.achats.length === 0) {
    info.innerHTML = '';
    c.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">Aucune planification</div>
      <div class="empty-state-desc">${isAdmin() ? 'Planifie d\'abord le mois.' : 'L\'admin n\'a pas encore planifié.'}</div>
      ${isAdmin() ? '<button class="btn primary" onclick="switchPage(\'planification\')">📋 Planifier</button>' : ''}
    </div>`;
    return;
  }
  
  const membres = getMembresDuMois(moisCourant);
  const cot = getCotisationParPersonne(moisCourant);
  const budget = calculBudgetPlan(plan);
  const vMois = totalVerseMois(moisCourant);
  const reste = Math.max(0, budget - vMois);
  
  info.innerHTML = `Mois de <strong>${nomMoisComplet(moisCourant)}</strong> — Budget : ${formatF(budget)} | Versé : ${formatF(vMois)} — 
    <span style="color:${reste > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:700;">
    ${reste > 0 ? 'Reste ' + formatF(reste) : '✅ Tout payé !'}</span>`;
  
  let html = '<div class="table-wrap"><table><thead><tr><th>Personne</th><th>Versé</th><th>Statut</th>' + (isAdmin() ? '<th>Actions</th>' : '') + '</tr></thead><tbody>';
  membres.forEach(m => {
    const verse = verseMoisMembre(m, moisCourant);
    let cls, label;
    if (verse >= cot) { cls = 'ok'; label = '✅ Payé'; }
    else if (verse > 0) { cls = 'warn'; label = '⚠️ Partiel'; }
    else { cls = 'danger'; label = '❌ Non payé'; }
    
    html += `<tr>
      <td data-label="Personne"><strong>${escapeHtml(m)}</strong></td>
      <td data-label="Versé" class="positive">${formatF(verse)}</td>
      <td data-label="Statut" class="center"><span class="statut ${cls}">${label}</span></td>
      ${isAdmin() ? `<td data-label="Actions">
        <button class="btn success small" onclick="ajouterPaiementRapide('${escapeHtml(m)}', ${Math.round(cot)})">+ ${formatF(cot)}</button>
        <button class="btn secondary small" onclick="ajouterPaiementRapide('${escapeHtml(m)}')">Autre</button>
      </td>` : ''}
    </tr>`;
  });
  html += '</tbody></table></div>';
  c.innerHTML = html;
}

// ============ DEPENSES ============
function afficherDepenses() {
  const c = document.getElementById('depensesContainer');
  const list = data.depenses.filter(d => d.mois === moisCourant).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (list.length === 0) {
    c.innerHTML = '<div class="muted" style="text-align:center; padding:30px;">Aucune dépense ce mois-ci.</div>';
    return;
  }
  
  let html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Montant</th>' + (isAdmin() ? '<th></th>' : '') + '</tr></thead><tbody>';
  list.forEach(d => {
    const idx = data.depenses.indexOf(d);
    html += `<tr>
      <td data-label="Date">${new Date(d.date).toLocaleDateString('fr-FR')}</td>
      <td data-label="Description">${escapeHtml(d.desc)}</td>
      <td data-label="Montant" class="negative">− ${formatF(d.montant)}</td>
      ${isAdmin() ? `<td data-label=""><button class="btn danger small" onclick="supprimerDepense(${idx})">🗑</button></td>` : ''}
    </tr>`;
  });
  html += `</tbody></table></div>
    <div style="text-align:right; margin-top:16px; font-weight:700; color:var(--danger); font-size:1.05em;">
      Total du mois : ${formatF(totalDepenseMois(moisCourant))}
    </div>`;
  c.innerHTML = html;
}

// ============ HISTORIQUE ============
function afficherHistorique() {
  const c = document.getElementById('historiqueContainer');
  const tous = [
    ...data.paiements.map(p => ({ ...p, type: 'versement' })),
    ...data.depenses.map(d => ({ ...d, type: 'depense' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (tous.length === 0) {
    c.innerHTML = '<div class="muted" style="text-align:center; padding:30px;">Aucun mouvement enregistré.</div>';
    return;
  }
  
  let html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Détails</th><th>Montant</th></tr></thead><tbody>';
  tous.forEach(m => {
    const isVers = m.type === 'versement';
    const signe = isVers ? '+' : '−';
    const cls = isVers ? 'positive' : 'negative';
    const label = isVers ? '💵 Cotisation' : '🛒 Dépense';
    const detail = isVers ? m.membre : m.desc;
    html += `<tr>
      <td data-label="Date">${new Date(m.date).toLocaleDateString('fr-FR')}</td>
      <td data-label="Type">${label}</td>
      <td data-label="Détails">${escapeHtml(detail)}</td>
      <td data-label="Montant" class="${cls}">${signe} ${formatF(m.montant)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  c.innerHTML = html;
}

// ============ PARAMS ============
function afficherParams() {
  const membresList = document.getElementById('paramMembresList');
  if (membresList) {
    membresList.innerHTML = data.users.map(u => `
      <div class="membre-item">
        <div class="membre-avatar ${u.role === 'admin' ? 'admin' : ''}">${initiales(u.nom)}</div>
        <div class="membre-item-info">
          <div class="membre-item-nom">${escapeHtml(u.nom)}</div>
          <div class="membre-item-role">${u.role === 'admin' ? '👑 Admin' : '👤 Membre'}</div>
        </div>
        <div class="membre-item-actions">
          <button class="btn secondary small" onclick="ouvrirResetPwd('${u.id}')">🔑</button>
          ${data.users.length > 1 ? `<button class="btn danger small" onclick="supprimerMembre('${u.id}')">🗑</button>` : ''}
        </div>
      </div>
    `).join('');
  }
  
  const catsList = document.getElementById('paramCategoriesList');
  if (catsList) {
    catsList.innerHTML = data.categories.map(c => `
      <span class="cat-pill">${c.icone} ${escapeHtml(c.nom)}<button class="del" onclick="supprimerCategorie('${c.id}')">✕</button></span>
    `).join('');
  }
  
  const magsList = document.getElementById('paramMagasinsList');
  if (magsList) {
    magsList.innerHTML = data.magasins.map(m => `
      <span class="cat-pill">🏪 ${escapeHtml(m.nom)}<button class="del" onclick="supprimerMagasin('${m.id}')">✕</button></span>
    `).join('');
  }
}

// ============ GESTION MEMBRES ============
function ouvrirModalAjoutMembre() {
  document.getElementById('newMembreNom').value = '';
  document.getElementById('newMembrePwd').value = '';
  document.getElementById('newMembreRole').value = 'membre';
  document.getElementById('modalAjoutMembre').classList.add('active');
  setTimeout(() => document.getElementById('newMembreNom').focus(), 100);
}

function validerAjoutMembre() {
  const nom = document.getElementById('newMembreNom').value.trim();
  const pwd = document.getElementById('newMembrePwd').value;
  const role = document.getElementById('newMembreRole').value;
  
  if (!nom) return toast('Entre un nom', 'warn');
  if (data.users.find(u => u.nom.toLowerCase() === nom.toLowerCase())) return toast('Ce nom existe déjà', 'warn');
  if (!pwd || pwd.length < 3) return toast('Mot de passe trop court (min 3)', 'warn');
  
  data.users.push({ id: genId(), nom, pwd, role });
  sauvegarderServeur();
  fermerModalDirect('modalAjoutMembre');
  afficherParams();
  toast(`${nom} ajouté(e)`, 'success');
}

function supprimerMembre(id) {
  if (!isAdmin()) return;
  const user = data.users.find(u => u.id === id);
  if (!user) return;
  if (data.users.length <= 1) return toast('Garde au moins un compte', 'warn');
  if (!confirm(`Supprimer le compte de "${user.nom}" ?`)) return;
  data.users = data.users.filter(u => u.id !== id);
  if (currentUser.id === id) {
    currentUser = null;
    localStorage.removeItem('cagnotteSessionId');
    sauvegarderServeur();
    afficherLogin();
    return;
  }
  sauvegarderServeur();
  afficherParams();
  toast('Compte supprimé', 'info');
}

function ouvrirResetPwd(id) {
  const user = data.users.find(u => u.id === id);
  if (!user) return;
  document.getElementById('resetPwdMembreId').value = id;
  document.getElementById('resetPwdInfo').textContent = `Changer le mot de passe de "${user.nom}"`;
  document.getElementById('resetPwdNouveau').value = '';
  document.getElementById('modalResetPwd').classList.add('active');
  setTimeout(() => document.getElementById('resetPwdNouveau').focus(), 100);
}

function validerResetPwd() {
  const id = document.getElementById('resetPwdMembreId').value;
  const pwd = document.getElementById('resetPwdNouveau').value;
  if (!pwd || pwd.length < 3) return toast('Mot de passe trop court (min 3)', 'warn');
  const user = data.users.find(u => u.id === id);
  if (!user) return;
  user.pwd = pwd;
  sauvegarderServeur();
  fermerModalDirect('modalResetPwd');
  toast('Mot de passe changé', 'success');
}

// ============ CHANGER SON MOT DE PASSE ============
function changerMonMotDePasse() {
  const actuel = document.getElementById('pwdActuel').value;
  const nouveau = document.getElementById('pwdNouveau').value;
  const nouveau2 = document.getElementById('pwdNouveau2').value;
  
  if (actuel !== currentUser.pwd) return toast('Mot de passe actuel incorrect', 'warn');
  if (!nouveau || nouveau.length < 3) return toast('Nouveau mot de passe trop court', 'warn');
  if (nouveau !== nouveau2) return toast('Les mots de passe ne correspondent pas', 'warn');
  
  currentUser.pwd = nouveau;
  const u = data.users.find(x => x.id === currentUser.id);
  if (u) u.pwd = nouveau;
  sauvegarderServeur();
  
  document.getElementById('pwdActuel').value = '';
  document.getElementById('pwdNouveau').value = '';
  document.getElementById('pwdNouveau2').value = '';
  toast('Mot de passe changé', 'success');
}

// ============ CATEGORIES / MAGASINS ============
function ajouterCategorie() {
  if (!isAdmin()) return;
  const nom = prompt('Nom de la catégorie :');
  if (!nom || !nom.trim()) return;
  const icone = prompt('Emoji de la catégorie (ex: 🍚) :', '📦') || '📦';
  data.categories.push({ id: genId(), nom: nom.trim(), icone });
  sauvegarderServeur();
  afficherParams();
  toast('Catégorie ajoutée', 'success');
}

function supprimerCategorie(id) {
  if (!isAdmin()) return;
  if (data.categories.length <= 1) return toast('Garde au moins une catégorie', 'warn');
  if (!confirm('Supprimer cette catégorie ?')) return;
  data.categories = data.categories.filter(c => c.id !== id);
  sauvegarderServeur();
  afficherParams();
  toast('Catégorie supprimée', 'info');
}

function ajouterMagasin() {
  if (!isAdmin()) return;
  const nom = prompt('Nom du magasin :');
  if (!nom || !nom.trim()) return;
  data.magasins.push({ id: genId(), nom: nom.trim() });
  sauvegarderServeur();
  afficherParams();
  toast('Magasin ajouté', 'success');
}

function supprimerMagasin(id) {
  if (!isAdmin()) return;
  if (data.magasins.length <= 1) return toast('Garde au moins un magasin', 'warn');
  if (!confirm('Supprimer ce magasin ?')) return;
  data.magasins = data.magasins.filter(m => m.id !== id);
  sauvegarderServeur();
  afficherParams();
  toast('Magasin supprimé', 'info');
}

function ouvrirModalGestionCategories() {
  document.getElementById('modalCategories').classList.add('active');
}

// ============ MODALS ============
function ouvrirModalPaiement() {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  const plan = getPlan(moisCourant);
  if (!plan || !plan.achats || plan.achats.length === 0) return toast('Planifie d\'abord le mois', 'warn');
  const membres = getMembresDuMois(moisCourant);
  document.getElementById('modalPayMembre').innerHTML = membres.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  document.getElementById('modalPayMontant').value = Math.round(getCotisationParPersonne(moisCourant)) || '';
  document.getElementById('modalPaiement').classList.add('active');
  setTimeout(() => document.getElementById('modalPayMontant').focus(), 100);
}

function ouvrirModalDepense() {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  document.getElementById('modalDepDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('modalDepDesc').value = '';
  document.getElementById('modalDepMontant').value = '';
  document.getElementById('modalDepense').classList.add('active');
  setTimeout(() => document.getElementById('modalDepDesc').focus(), 100);
}

function fermerModal(ev, id) {
  if (ev.target.id === id) document.getElementById(id).classList.remove('active');
}
function fermerModalDirect(id) {
  document.getElementById(id).classList.remove('active');
}

// ============ ACTIONS ============
function validerPaiement() {
  if (!isAdmin()) return;
  const membre = document.getElementById('modalPayMembre').value;
  const montant = parseFloat(document.getElementById('modalPayMontant').value);
  if (!membre) return toast('Choisis une personne', 'warn');
  if (isNaN(montant) || montant <= 0) return toast('Montant invalide', 'warn');
  data.paiements.push({ mois: moisCourant, membre, montant, date: new Date().toISOString() });
  sauvegarderServeur();
  fermerModalDirect('modalPaiement');
  rafraichir();
  toast(`Cotisation de ${formatF(montant)} pour ${membre}`, 'success');
}

function validerDepense() {
  if (!isAdmin()) return;
  const desc = document.getElementById('modalDepDesc').value.trim();
  const montant = parseFloat(document.getElementById('modalDepMontant').value);
  const date = document.getElementById('modalDepDate').value || new Date().toISOString().split('T')[0];
  if (!desc) return toast('Décris l\'achat', 'warn');
  if (isNaN(montant) || montant <= 0) return toast('Montant invalide', 'warn');
  const soldeAvant = solde();
  data.depenses.push({ mois: moisCourant, desc, montant, date });
  sauvegarderServeur();
  fermerModalDirect('modalDepense');
  rafraichir();
  if (montant > soldeAvant) {
    toast(`Dépense enregistrée — solde négatif !`, 'warn');
  } else {
    toast(`Dépense de ${formatF(montant)} enregistrée`, 'success');
  }
}

function ajouterPaiementRapide(membre, montantDefaut) {
  if (!isAdmin()) return toast('Action réservée à l\'admin', 'warn');
  const montantStr = prompt(`Montant versé par "${membre}" pour ${nomMoisComplet(moisCourant)} :`, montantDefaut || '');
  if (montantStr === null) return;
  const montant = parseFloat(montantStr);
  if (isNaN(montant) || montant <= 0) return toast('Montant invalide', 'warn');
  data.paiements.push({ mois: moisCourant, membre, montant, date: new Date().toISOString() });
  sauvegarderServeur();
  rafraichir();
  toast(`+${formatF(montant)} de ${membre}`, 'success');
}

function supprimerDepense(idx) {
  if (!isAdmin()) return;
  if (confirm('Supprimer cette dépense ?')) {
    data.depenses.splice(idx, 1);
    sauvegarderServeur();
    rafraichir();
    toast('Dépense supprimée', 'info');
  }
}

// ============ EXPORT / IMPORT ============
function exporterDonnees() {
  if (!isAdmin()) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cagnotte-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Données exportées', 'success');
}

function importerDonnees(ev) {
  if (!isAdmin()) return;
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.plans || !imported.paiements || !imported.depenses) {
        return toast('Fichier invalide', 'danger');
      }
      data = imported;
      if (!data.categories) data.categories = [{ id: 'autre', nom: 'Autre', icone: '📦' }];
      if (!data.magasins) data.magasins = [{ id: 'autre', nom: 'Autre' }];
      sauvegarderServeur();
      rafraichir();
      toast('Données importées', 'success');
    } catch {
      toast('Erreur de lecture', 'danger');
    }
  };
  reader.readAsText(file);
}

async function reinitialiserTout() {
  if (!isAdmin()) return;
  if (confirm('⚠️ TOUT effacer (y compris les comptes) ? Action définitive.')) {
    if (confirm('Vraiment sûr ?')) {
      data = {
        users: [],
        plans: {},
        paiements: [],
        depenses: [],
        categories: data.categories,
        magasins: data.magasins
      };
      currentUser = null;
      localStorage.removeItem('cagnotteSessionId');
      await sauvegarderServeur();
      location.reload();
    }
  }
}

// ============ RAFRAICHIR ============
function rafraichir() {
  if (!currentUser) return;
  afficherMoisNav();
  afficherDashboard();
  afficherPaiements();
  afficherDepenses();
  if (document.getElementById('page-planification').classList.contains('active')) afficherPlanification();
  if (document.getElementById('page-historique').classList.contains('active')) afficherHistorique();
  if (document.getElementById('page-comparaison').classList.contains('active')) afficherComparaison();
  if (document.getElementById('page-courses').classList.contains('active')) afficherCourses();
  if (document.getElementById('page-parametres').classList.contains('active')) afficherParams();
}

// ============ RAFRAICHIR DEPUIS SERVEUR ============
async function rafraichirDepuisServeur() {
  await chargerDonnees();
  const localSessionId = localStorage.getItem('cagnotteSessionId');
  if (localSessionId) {
    const user = data.users.find(u => u.id === localSessionId);
    if (user) currentUser = user;
  }
  if (currentUser) {
    afficherApp();
    toast('Données actualisées', 'success');
  } else {
    afficherLogin();
  }
}

// Auto-refresh toutes les 30s
setInterval(async () => {
  if (!currentUser || !dataLoaded) return;
  if (document.querySelector('.modal-overlay.active')) return;
  
  try {
    const res = await fetch(`${API_URL}/data`);
    const json = await res.json();
    if (json.ok && json.data) {
      data = json.data;
      const localSessionId = localStorage.getItem('cagnotteSessionId');
      if (localSessionId) {
        const user = data.users.find(u => u.id === localSessionId);
        if (user) currentUser = user;
      }
      const activePage = document.querySelector('.page.active');
      const pageId = activePage ? activePage.id.replace('page-', '') : 'dashboard';
      if (pageId === 'dashboard') afficherDashboard();
      if (pageId === 'paiements') afficherPaiements();
      if (pageId === 'depenses') afficherDepenses();
      if (pageId === 'comparaison') afficherComparaison();
      if (pageId === 'courses') afficherCourses();
    }
  } catch (err) {}
}, 30000);

// ============ INIT ============
chargerTheme();
initialiserAuth();

const planNbEl = document.getElementById('planNbPersonnes');
if (planNbEl) {
  planNbEl.addEventListener('input', () => {
    mettreAJourApercu();
    genererChampsNoms();
  });
}

const achatNomEl = document.getElementById('achatNom');
if (achatNomEl) {
  achatNomEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('achatPrix').focus(); }
  });
}
const achatPrixEl = document.getElementById('achatPrix');
if (achatPrixEl) {
  achatPrixEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); ajouterAchat(); }
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    closeSidebar();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) closeSidebar();
});