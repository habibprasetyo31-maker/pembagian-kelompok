const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// === Session contoh (bisa dibuat dinamis nanti) ===
let SESSION = {
  id: "s1",
  groups: [
    { id: "g1", name: "Kelompok 1", capacity: 3, members: [] },
    { id: "g2", name: "Kelompok 2", capacity: 3, members: [] },
    { id: "g3", name: "Kelompok 3", capacity: 3, members: [] }
  ]
};

// === API: Ambil seluruh data sesi ===
app.get("/api/session", (req, res) => {
  res.json(SESSION);
});

// === API: User bergabung ke kelompok ===
app.post("/api/join", (req, res) => {
  const { name, groupId } = req.body;

  const group = SESSION.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: "Kelompok tidak ditemukan" });

  if (group.members.length >= group.capacity) {
    return res.status(400).json({ error: "Kelompok sudah penuh" });
  }

  const user = { id: uuidv4(), name };
  group.members.push(user);

  // Kirim update realtime ke semua client
  io.emit("session_update", SESSION);

  res.json({ success: true });
});

// === WebSocket ===
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Kirim data awal
  socket.emit("session_update", SESSION);
});
// ===========================
// ==== ADMIN — API BARU =====
// ===========================

// 1. CREATE SESSION (jumlah kelompok & kapasitas)
app.post("/api/create-session", (req, res) => {
  try {
    const { groupCount, capacity } = req.body;

    if (!groupCount || !capacity) {
      return res.status(400).json({ error: "Parameter tidak lengkap" });
    }

    // Membuat sesi baru
    SESSION = {
      id: uuidv4(),
      groups: []
    };

    for (let i = 1; i <= groupCount; i++) {
      SESSION.groups.push({
        id: uuidv4(),
        name: `Kelompok ${i}`,
        capacity: capacity,
        members: []
      });
    }

    io.emit("session_update", SESSION);
    res.json(SESSION);

  } catch (err) {
    res.status(500).json({ error: "Gagal membuat session" });
  }
});


// 2. UPDATE SETTINGS (ubah jumlah kelompok)
app.post("/api/update-settings", (req, res) => {
  try {
    const { groupCount, capacity } = req.body;

    if (!groupCount || !capacity) {
      return res.status(400).json({ error: "Parameter tidak lengkap" });
    }

    // Update jumlah kelompok
    const newGroups = [];

    for (let i = 1; i <= groupCount; i++) {
      // Jika kelompok lama ada, pakai datanya
      if (SESSION.groups[i - 1]) {
        newGroups.push({
          ...SESSION.groups[i - 1],
          capacity: capacity
        });
      } else {
        // Jika kelompok baru
        newGroups.push({
          id: uuidv4(),
          name: `Kelompok ${i}`,
          capacity: capacity,
          members: []
        });
      }
    }

    SESSION.groups = newGroups;

    io.emit("session_update", SESSION);
    res.json(SESSION);

  } catch (err) {
    res.status(500).json({ error: "Gagal update settings" });
  }
});


// 3. RESET SEMUA ANGGOTA
app.post("/api/reset-members", (req, res) => {
  try {
    SESSION.groups.forEach(g => g.members = []);

    io.emit("session_update", SESSION);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Gagal reset anggota" });
  }
});
// 4. REMOVE MEMBER DARI KELOMPOK TERTENTU
app.post("/api/remove-member", (req, res) => {
  try {
    const { groupId, memberId } = req.body;

    const group = SESSION.groups.find(g => g.id === groupId);
    if (!group) {
      return res.status(404).json({ error: "Kelompok tidak ditemukan" });
    }

    // Filter anggota
    group.members = group.members.filter(m => m.id !== memberId);

    io.emit("session_update", SESSION);
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus anggota" });
  }
});

app.use(express.static("client"));

server.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});
