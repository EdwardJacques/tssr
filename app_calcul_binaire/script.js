// ============================================================
// TSSR - Conversions & Classement (version avec backend Supabase)
// Remplacez ce fichier par votre ancien script.js.
// index.html et style.css restent inchangés.
// ============================================================

// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = 'https://jtjgmkagyfesqzcqfqcw.supabase.co/rest/v1';
const SUPABASE_KEY = 'sb_publishable_m1Gf2sw-qA75rNRNUuI5RQ_f2uVfERI';

// Base de données des questions
const questionsBank = [
    { from: 'Binaire', to: 'Décimal', badge: 'Bin ➔ Dec', type: 'Valeur Réseau IPv4', val: '11000000', answer: '192', hint: '11000000₂ = 128 + 64 = 192' },
    { from: 'Décimal', to: 'Binaire', badge: 'Dec ➔ Bin', type: 'Masque de sous-réseau', val: '255', answer: '11111111', hint: '255 = 8 bits à 1 (11111111)' },
    { from: 'Hexadécimal', to: 'Binaire', badge: 'Hex ➔ Bin', type: 'Octet Adresse MAC', val: 'A5', answer: '10100101', hint: 'A = 1010 | 5 = 0101 ➔ 10100101' },
    { from: 'Binaire', to: 'Hexadécimal', badge: 'Bin ➔ Hex', type: 'Convertir un octet', val: '11110000', answer: 'F0', hint: '1111 = F | 0000 = 0 ➔ F0' },
    { from: 'Décimal', to: 'Hexadécimal', badge: 'Dec ➔ Hex', type: 'Conversion de base', val: '170', answer: 'AA', hint: '170 = 10101010₂ = AA₁₆' },
    { from: 'Hexadécimal', to: 'Décimal', badge: 'Hex ➔ Dec', type: 'Valeur système', val: 'FE', answer: '254', hint: '(15 × 16) + 14 = 254' }
];

// État de l'application
let currentUser = null;
let currentQuestionIndex = 0;
let score = 0;
let streak = 0;
let maxStreak = 0;
let bitsState = [0, 0, 0, 0, 0, 0, 0, 0];

// --- FONCTIONS D'APPEL API SUPABASE ---
async function supabaseRequest(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!res.ok) {
        console.error('Erreur Supabase:', res.status, await res.text());
        return null;
    }
    // 204 = succès sans contenu (UPDATE/DELETE)
    return res.status === 204 ? [] : res.json();
}

// Charger tout le classement (trié par score décroissant)
async function fetchLeaderboard() {
    return await supabaseRequest('/scores?select=*&order=score.desc,max_streak.desc');
}

document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    initQuiz();
    initWorkbench();
    renderLeaderboard();

    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
});

// --- GESTION DE L'UTILISATEUR ---
function checkUserSession() {
    const savedUser = localStorage.getItem('tssr_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('current-user-display').innerText = `${currentUser.firstname} ${currentUser.lastname}`;
    } else {
        document.getElementById('login-modal').classList.remove('hidden');
    }
}

function saveUser(event) {
    event.preventDefault();
    const firstname = document.getElementById('user-firstname').value.trim();
    const lastname = document.getElementById('user-lastname').value.trim();

    if (!firstname || !lastname) return;

    currentUser = { firstname, lastname, id: `${firstname}_${lastname}`.toLowerCase() };
    localStorage.setItem('tssr_user', JSON.stringify(currentUser));

    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('current-user-display').innerText = `${firstname} ${lastname}`;
}

function changeUser() {
    localStorage.removeItem('tssr_user');
    score = 0;
    streak = 0;
    maxStreak = 0;
    updateStats();
    checkUserSession();
}

// --- CLASSEMENT PARTAGÉ (SUPABASE) ---
async function saveScoreToLeaderboard() {
    if (!currentUser) return;

    const fullName = `${currentUser.firstname} ${currentUser.lastname}`;
    const existing = await supabaseRequest(`/scores?select=*&name=eq.${encodeURIComponent(fullName)}`);

    if (existing && existing.length > 0) {
        // Mettre à jour si le nouveau score est meilleur
        const row = existing[0];
        const newScore = Math.max(score, row.score);
        const newStreak = Math.max(maxStreak, row.max_streak);
        await supabaseRequest(`/scores?id=eq.${row.id}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ score: newScore, max_streak: newStreak })
        });
    } else {
        // Nouveau stagiaire : créer sa ligne
        await supabaseRequest('/scores', {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: fullName, score: score, max_streak: maxStreak })
        });
    }
    renderLeaderboard();
}

async function renderLeaderboard() {
    const leaderboard = await fetchLeaderboard();
    const tbody = document.getElementById('leaderboard-body');

    if (!leaderboard) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted)">⚠️ Impossible de charger le classement (vérifiez la config Supabase).</td></tr>';
        return;
    }
    if (leaderboard.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted)">Aucun score enregistré pour le moment.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    leaderboard.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        tr.innerHTML = `
            <td><strong>${rankMedal}</strong></td>
            <td>${entry.name}</td>
            <td><strong style="color:var(--accent-blue)">${entry.score} pts</strong></td>
            <td>🔥 ${entry.max_streak}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function clearLeaderboard() {
    // ATTENTION : le classement est désormais PARTAGÉ entre tous les stagiaires.
    // Ce bouton ne réinitialise plus tout le classement, mais uniquement votre propre ligne.
    if (!currentUser) return;
    if (!confirm("Réinitialiser TON score dans le classement partagé ?")) return;

    const fullName = `${currentUser.firstname} ${currentUser.lastname}`;
    const existing = await supabaseRequest(`/scores?select=*&name=eq.${encodeURIComponent(fullName)}`);
    if (existing && existing.length > 0) {
        await supabaseRequest(`/scores?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ score: 0, max_streak: 0 })
        });
    }
    score = 0;
    streak = 0;
    maxStreak = 0;
    updateStats();
    renderLeaderboard();
}

// --- LOGIQUE NAVIGATION & QUIZ ---
function switchMode(mode) {
    document.querySelectorAll('.mode-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`mode-${mode}`).classList.add('active');
    document.getElementById(`btn-${mode}`).classList.add('active');
}

function initQuiz() {
    loadQuestion(0);
}

function loadQuestion(index) {
    currentQuestionIndex = index;
    const q = questionsBank[index];

    document.getElementById('quiz-badge').innerText = q.badge;
    document.getElementById('quiz-type-desc').innerText = q.type;
    document.getElementById('question-val').innerText = q.val;
    document.getElementById('target-label').innerText = `en ${q.to}`;
    document.getElementById('user-input').value = '';

    document.getElementById('feedback-message').classList.add('hidden');
    document.getElementById('hint-box').classList.add('hidden');
    document.getElementById('hint-content').innerText = q.hint;
    document.getElementById('user-input').focus();
}

function checkAnswer() {
    const inputField = document.getElementById('user-input');
    const userVal = inputField.value.trim().toUpperCase();
    const currentQ = questionsBank[currentQuestionIndex];
    const feedbackBox = document.getElementById('feedback-message');

    if (!userVal) return;

    if (userVal === currentQ.answer.toUpperCase()) {
        score += 10;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        feedbackBox.className = "feedback success";
        feedbackBox.innerText = "✅ Correct ! Score mis à jour.";
    } else {
        streak = 0;
        feedbackBox.className = "feedback error";
        feedbackBox.innerText = `❌ Incorrect. La réponse était : ${currentQ.answer}`;
    }

    feedbackBox.classList.remove('hidden');
    updateStats();
    saveScoreToLeaderboard();
}

function nextQuestion() {
    let nextIdx = (currentQuestionIndex + 1) % questionsBank.length;
    loadQuestion(nextIdx);
}

function toggleHint() {
    document.getElementById('hint-box').classList.toggle('hidden');
}

function updateStats() {
    document.getElementById('score-val').innerText = score;
    document.getElementById('streak-val').innerText = `🔥 ${streak}`;
}

// --- WORKBENCH LOGIC ---
function initWorkbench() {
    const grid = document.getElementById('bit-grid');
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    grid.innerHTML = '';

    weights.forEach((w, idx) => {
        const cell = document.createElement('div');
        cell.className = 'bit-cell';
        cell.innerHTML = `
            <span class="bit-weight">${w}</span>
            <button class="bit-btn" id="bit-${idx}" onclick="toggleBit(${idx})">0</button>
        `;
        grid.appendChild(cell);
    });
    updateWorkbenchDisplays();
}

function toggleBit(idx) {
    bitsState[idx] = bitsState[idx] === 0 ? 1 : 0;
    const btn = document.getElementById(`bit-${idx}`);
    btn.innerText = bitsState[idx];
    btn.classList.toggle('active', bitsState[idx] === 1);
    updateWorkbenchDisplays();
}

function updateWorkbenchDisplays() {
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    let decVal = 0;
    let activeMath = [];

    bitsState.forEach((bit, idx) => {
        if (bit === 1) {
            decVal += weights[idx];
            activeMath.push(weights[idx]);
        }
    });

    document.getElementById('wb-dec').innerText = decVal;
    document.getElementById('wb-bin').innerText = bitsState.join('');
    document.getElementById('wb-hex').innerText = '0x' + decVal.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('wb-math').innerText = activeMath.length > 0 ? `${activeMath.join(' + ')} = ${decVal}` : '0 = 0';
}