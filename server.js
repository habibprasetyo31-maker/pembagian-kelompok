const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ===== DATA SESSION =====
let SESSION = {
  id: uuidv4(),
  groups: []
};

// ===== API: AMBIL DATA =====
app.get("/api/session", (req, res) => {
  res.json(SESSION);
});

// ===== USER JOIN KELOMPOK =====
app.post("/api/join", (req, res) => {
  const { name, groupId } = req.body;
  if (!name || !groupId) return res.status(400).json({ error: "Nama dan groupId harus diisi" });

  const group = SESSION.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: "Kelompok tidak ditemukan" });

  if (group.members.some(m => m.name === name)) {
    return res.status(400).json({ error: "Nama sudah terdaftar dalam kelompok ini" });
  }

  if (group.members.length >= group.capacity) {
    return res.status(400).json({ error: "Kelompok penuh" });
  }

  group.members.push({ id: uuidv4(), name });

  io.emit("session_update", SESSION);

  res.json({ success: true });
});

// ===== ADMIN CREATE SESSION =====
app.post("/api/create-session", (req, res) => {
  const { groupCount, capacity } = req.body;
  if (!groupCount || !capacity) return res.status(400).json({ error: "groupCount dan capacity wajib" });

  SESSION = { id: uuidv4(), groups: [] };
  for (let i = 1; i <= groupCount; i++) {
    SESSION.groups.push({ id: uuidv4(), name: `Kelompok ${i}`, capacity, members: [] });
  }

  io.emit("session_update", SESSION);
  res.json(SESSION);
});

// ===== ADMIN UPDATE SETTINGS =====
app.post("/api/update-settings", (req, res) => {
  const { groupCount, capacity } = req.body;
  if (!groupCount || !capacity) return res.status(400).json({ error: "groupCount dan capacity wajib" });

  const newGroups = [];
  for (let i = 0; i < groupCount; i++) {
    if (SESSION.groups[i]) {
      const g = SESSION.groups[i];
      if (g.members.length > capacity) g.members = g.members.slice(0, capacity);
      newGroups.push({ ...g, capacity });
    } else {
      newGroups.push({ id: uuidv4(), name: `Kelompok ${i+1}`, capacity, members: [] });
    }
  }
  SESSION.groups = newGroups;
  io.emit("session_update", SESSION);
  res.json(SESSION);
});

// ===== ADMIN RESET ANGGOTA =====
app.post("/api/reset-members", (req, res) => {
  SESSION.groups.forEach(g => (g.members = []));
  io.emit("session_update", SESSION);
  res.json({ success: true });
});

// ===== ADMIN REMOVE ANGGOTA =====
app.post("/api/remove-member", (req, res) => {
  const { groupId, memberId } = req.body;
  const group = SESSION.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: "Kelompok tidak ditemukan" });
  group.members = group.members.filter(m => m.id !== memberId);
  io.emit("session_update", SESSION);
  res.json({ success: true });
});

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, 'client')));

server.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});
