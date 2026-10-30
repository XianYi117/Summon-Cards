-- 召喚 Summon Cards｜D1 資料表（資料庫 summon-cards 已建立並套用）
CREATE TABLE IF NOT EXISTS decks (no INTEGER PRIMARY KEY, name TEXT NOT NULL, leader TEXT, cards TEXT NOT NULL, owner TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, mode TEXT, build TEXT, deck0 TEXT, leader0 TEXT, deck1 TEXT, leader1 TEXT, winner INTEGER, turns INTEGER, s0 INTEGER, s1 INTEGER);
CREATE INDEX IF NOT EXISTS idx_results_t ON results(t);
CREATE INDEX IF NOT EXISTS idx_decks_upd ON decks(deleted, updated);
