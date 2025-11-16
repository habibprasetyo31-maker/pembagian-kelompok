// script.js — improved UX, admin auth, and dark-mode toggle
const socket = io();

// =================== CONFIG ===================
// NOTE: This is a simple client-side admin auth for demo purposes only.
// For production, implement server-side authentication.
const ADMIN_PASSWORD = 'admin123'; // change this before sharing in production

// =================== UTILITIES ===================
function esc(str){
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]||s));
}

function showToast(msg, type = 'info', ttl = 3000){
    const container = document.getElementById('toast-container');
    if(!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(()=> el.classList.add('visible'), 20);
    setTimeout(()=> el.remove(), ttl);
}

function setButtonLoading(btn, isLoading){
    if(!btn) return;
    if(isLoading){
        btn.disabled = true;
        const s = document.createElement('span');
        s.className = 'spinner';
        s.dataset.tempSpinner = '1';
        btn.appendChild(s);
    } else {
        btn.disabled = false;
        const spinner = btn.querySelector('[data-temp-spinner]');
        if(spinner) spinner.remove();
    }
}

// =================== RENDER ===================
function renderUserPage(session){
    const container = document.getElementById('groups');
    if(!container) return;

    // Pastikan container memiliki kelas groups-grid
    container.className = 'groups-grid'; 
    container.innerHTML = '';

    // Tampilkan pesan jika belum ada sesi dibuat
    if(session.groups.length === 0) {
        container.innerHTML = '<p class="info-message">Belum ada sesi kelompok yang dibuat oleh Admin.</p>';
        return;
    }

    session.groups.forEach(group=>{
        const full = group.members.length >= group.capacity;
        const warn = group.members.length / group.capacity >= 0.8 && !full;

        // Menggunakan kelas CSS: group-box
        const card = document.createElement('div');
        card.className = 'group-box ' + (full ? 'status-full' : (warn ? 'status-warn' : ''));

        // Konten Header Kartu dan Kapasitas
        let headerHTML = `
            <h3>${esc(group.name)}</h3>
            <p class="capacity-info">Kapasitas: ${group.members.length} / ${group.capacity}</p>
        `;

        // Daftar Anggota
        let membersListHTML = '<ul>';
        if (group.members.length === 0) {
            membersListHTML += '<li>Belum ada anggota</li>';
        } else {
            membersListHTML += group.members.map(m=>`<li>${esc(m.name)}</li>`).join('');
        }
        membersListHTML += '</ul>';

        // Tombol Join
        const btn = document.createElement('button');
        btn.type = 'button';
        // Tambahkan kelas CSS: join-btn
        btn.className = 'join-btn'; 
        btn.textContent = full ? 'Penuh' : 'Masuk Kelompok';

        if(full) btn.disabled = true;
        btn.addEventListener('click', ()=> joinGroup(group.id, btn));

        // Gabungkan semua ke dalam card
        card.innerHTML = headerHTML;
        card.innerHTML += membersListHTML;
        card.appendChild(btn); 

        container.appendChild(card);
    });
}

function renderAdminPage(session){
    const container = document.getElementById('admin_groups');
    if(!container) return;
    container.innerHTML = '';
    session.groups.forEach(group=>{
        // Menggunakan kelas CSS: group-box
        const card = document.createElement('div');
        card.className = 'group-box admin-group-box'; 

        // Konten Header Kartu dan Kapasitas
        let headerHTML = `
            <h3>${esc(group.name)}</h3>
            <p class="capacity-info">Kapasitas: ${group.members.length} / ${group.capacity}</p>
        `;

        // Daftar Anggota dengan tombol Hapus
        const list = document.createElement('ul');
        list.innerHTML = group.members.map(m=>`<li>${esc(m.name)} <button class="small-remove-btn" type="button" onclick="removeMember('${group.id}','${m.id}')">Hapus</button></li>`).join('');

        card.innerHTML = headerHTML;
        card.appendChild(list);
        container.appendChild(card);
    });
}

// =================== ACTIONS ===================
async function joinGroup(groupId, btn = null){
    const input = document.getElementById('name');
    if(!input) return showToast('Field nama tidak ditemukan', 'error');
    const name = input.value.trim();
    if(!name) return showToast('Isi nama dulu!', 'error');
    try{
        setButtonLoading(btn, true);
        const res = await fetch('/api/join', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, groupId })
        });
        const data = await res.json();
        if(!res.ok) showToast(data.error || 'Gagal join', 'error'); else { showToast('Berhasil masuk kelompok','success'); }
    }catch(e){ console.error(e); showToast('Kesalahan jaringan','error'); }
    finally{ setButtonLoading(btn, false); }
}

async function removeMember(groupId, memberId){
    try{
        const res = await fetch('/api/remove-member', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupId, memberId })
        });
        const d = await res.json();
        if(!res.ok) showToast(d.error||'Gagal hapus','error'); else showToast('Anggota dihapus','success');
    }catch(e){ console.error(e); showToast('Kesalahan jaringan','error'); }
}

async function createSession(){
    const btn = document.getElementById('btn-create');
    const groupCount = Number(document.getElementById('groupCount').value);
    const capacity = Number(document.getElementById('capacity').value);
    if(!groupCount || !capacity) return showToast('groupCount dan capacity harus > 0','error');
    try{
        setButtonLoading(btn, true);
        const res = await fetch('/api/create-session', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupCount, capacity })
        });
        const d = await res.json();
        if(!res.ok) showToast(d.error||'Gagal buat session','error'); else showToast('Session dibuat','success');
    }catch(e){ console.error(e); showToast('Kesalahan jaringan','error'); }
    finally{ setButtonLoading(btn, false); }
}

async function updateSettings(){
    const btn = document.getElementById('btn-update');
    const groupCount = Number(document.getElementById('groupCount').value);
    const capacity = Number(document.getElementById('capacity').value);
    if(!groupCount || !capacity) return showToast('groupCount dan capacity harus > 0','error');
    try{
        setButtonLoading(btn, true);
        const res = await fetch('/api/update-settings', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ groupCount, capacity })
        });
        const d = await res.json();
        if(!res.ok) showToast(d.error||'Gagal update','error'); else showToast('Settings diperbarui','success');
    }catch(e){ console.error(e); showToast('Kesalahan jaringan','error'); }
    finally{ setButtonLoading(btn, false); }
}

async function resetMembers(){
    const btn = document.getElementById('btn-reset');
    if(!confirm('Yakin ingin mereset semua anggota?')) return;
    try{
        setButtonLoading(btn, true);
        const res = await fetch('/api/reset-members', { method:'POST' });
        const d = await res.json();
        if(!res.ok) showToast(d.error||'Gagal reset','error'); else showToast('Semua anggota direset','success');
    }catch(e){ console.error(e); showToast('Kesalahan jaringan','error'); }
    finally{ setButtonLoading(btn, false); }
}

// =================== SOCKETS ===================
socket.on('session_update', session=>{
    if(document.getElementById('groups')) renderUserPage(session);
    if(document.getElementById('admin_groups')) renderAdminPage(session);
});

// initial fetch
(async function init(){
    try{
        const res = await fetch('/api/session');
        const session = await res.json();
        if(document.getElementById('groups')) renderUserPage(session);
        if(document.getElementById('admin_groups')) renderAdminPage(session);
    }catch(e){ console.error('Init error', e); }
})();

// =================== ADMIN AUTH (simple client-side) ===================
function showAdminControls(authorized){
    const overlay = document.getElementById('admin-auth-overlay');
    const controls = document.getElementById('admin-controls');
    const groups = document.getElementById('admin_groups');
    if(!overlay || !controls || !groups) return;
    overlay.style.display = authorized ? 'none' : 'flex';
    controls.setAttribute('aria-hidden', String(!authorized));
    groups.setAttribute('aria-hidden', String(!authorized));
    if(authorized) sessionStorage.setItem('pk_admin_auth', '1');
    else sessionStorage.removeItem('pk_admin_auth');
}

document.addEventListener('DOMContentLoaded', ()=>{
    // admin auth elements (if present)
    const overlay = document.getElementById('admin-auth-overlay');
    if(overlay){
        const loginBtn = document.getElementById('admin-login-btn');
        const pwdInput = document.getElementById('admin-password');
        // if previously authenticated in sessionStorage, show controls
        if(sessionStorage.getItem('pk_admin_auth') === '1'){
            showAdminControls(true);
        }
        loginBtn.addEventListener('click', ()=>{
            const v = pwdInput.value || '';
            if(v === ADMIN_PASSWORD){
                showAdminControls(true);
                showToast('Selamat datang, Admin', 'success');
            } else {
                showToast('Kata sandi salah', 'error');
            }
        });
    }

    // theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const saved = localStorage.getItem('pk_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(saved === 'dark' || (saved === null && prefersDark)) root.setAttribute('data-theme','dark');
    if(themeToggle){
        themeToggle.addEventListener('click', ()=>{
            // Check for the new data-theme attribute set by our CSS Dark Mode handler
            const isDark = root.getAttribute('data-theme') === 'dark'; 
            const next = isDark ? 'light' : 'dark';

            if(next === 'dark') root.setAttribute('data-theme','dark'); else root.removeAttribute('data-theme');

            localStorage.setItem('pk_theme', next);
            showToast('Tema diubah ke ' + next, 'info');
        });

        // Ensure the theme icon reflects the current state (optional, can be done with CSS/JS)
        if(root.getAttribute('data-theme') === 'dark') themeToggle.textContent = '☀️'; // Sun icon for light mode
        else themeToggle.textContent = '🌙'; // Moon icon for dark mode

        // Listen to changes to update icon
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'data-theme') {
                    const currentTheme = root.getAttribute('data-theme');
                    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
                }
            });
        });
        observer.observe(root, { attributes: true });
    }
});
