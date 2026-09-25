#!/usr/bin/env python3
"""
Génère src/room_names.json : noms d'affichage des salles. Trois couches :

1. FIELD - corrections terrain d'un joueur, priment sur tout. Le jeu se trompe
   parfois sur lui-même : la descr de room2scps2 annonce SCP-500, mais son
   confinement est VIDE en jeu ; seule SCP-1499 y est réellement.
2. AUTO - rooms.ini : les descr au motif de PROPRIÉTÉ de salle
   (« SCP-X's containment chamber / hallway / spawn area »). Une simple mention
   (« SCP-682's document ») ne nomme pas la salle. Les salles multi-SCP donnent
   un nom composite (« SCP-714 · 860 · 1025 »).
3. COMMUNITY - nomenclature de la communauté pour les salles sans SCP, sourcée :
   https://scp-anomaly-breach-2.fandom.com/wiki/Entrance_Zone (mapping explicite)
   https://undertowgames.com/forum/viewtopic.php?t=58 (forum officiel, 2012)
"""
import re, json, sys, pathlib

INI = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "../scpcb/Data/rooms.ini")

FIELD = {
    "room2scps2": "SCP-1499",  # la descr annonce aussi SCP-500 : confinement vide en jeu
}

COMMUNITY = {
    "room2ccont": "Electrical Center",
    "medibay": "Medical Bay",
    "gateaentrance": "Gate A",
    "exit1": "Gate B",
    "room2sroom": "Head Office",
    "room2nuke": "Warhead Room",
    "lockroom": "Lockroom",
    "checkpoint1": "Checkpoint",
    "checkpoint2": "Checkpoint",
    "room2cafeteria": "Cafeteria",
    "room2sl": "Surveillance Room",
    "room3servers": "Server Farm",
    "room1archive": "Archive Room",
    "testroom": "SCP-682 Test Chamber",
    "room2tunnel": "Maintenance Tunnels",  # confirmé par la descr du jeu
    "pocketdimension": "Pocket Dimension",
    "dimension1499": "SCP-1499 Dimension",
    "gatea": "Gate A (surface)",
}

# Motifs de PROPRIÉTÉ de salle. « chamber » seul ne suffit pas : la descr de
# room2tunnel cite « SCP-372's chamber » comme référence externe, pas comme contenu.
ROOM_WORDS = ("containment chamber", "hallway", "spawn area")
OWNER = re.compile(r"SCP-(\d+(?:-\d+)?)'s")

def auto_name(descr: str) -> str | None:
    low = descr.lower()
    if not any(w in low for w in ROOM_WORDS):
        return None
    ids = OWNER.findall(descr)
    if not ids:
        return None
    if len(ids) == 1:
        return f"SCP-{ids[0]}"
    return "SCP-" + " · ".join(ids)

rooms, cur = {}, None
for line in INI.read_text(errors="ignore").splitlines():
    l = line.strip()
    m = re.match(r"^\[(.+)\]$", l)
    if m: cur = m.group(1); continue
    if cur and l.lower().startswith("descr"):
        rooms[cur] = l.split("=", 1)[1].strip()

names = {}
for n, d in rooms.items():
    a = auto_name(d)
    if a: names[n] = a
for n, disp in COMMUNITY.items():
    names.setdefault(n, disp)
names.update(FIELD)  # les corrections terrain priment sur tout

out = {
    "_sources": [
        "field corrections (in-game verification by a runner)",
        "rooms.ini descr, ownership patterns: containment chamber / hallway / spawn area",
        "https://scp-anomaly-breach-2.fandom.com/wiki/Entrance_Zone",
        "https://undertowgames.com/forum/viewtopic.php?t=58",
    ],
    "names": dict(sorted(names.items())),
}
pathlib.Path("src/room_names.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
print(f"{len(names)} noms")
