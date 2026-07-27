# On Mars — version web

Morpion multijoueur en ligne : lobby public, jeu synchronisé (WebSocket), chat vocal (WebRTC).

## Stack

- **client/** — React + Vite + TypeScript
- **server/** — Rust (Axum) : lobby, rooms, règles du jeu, signaling WebRTC
- Déploiement prévu : Docker sur **Hostinger VPS** (SPA + `/ws` same-origin)
- **Supabase** : prévu pour auth/DB plus tard, non utilisé au MVP

## Prod actuelle

- VPS Hostinger : `82.25.112.116`
- URL temporaire HTTPS : https://82.25.112.116.sslip.io
- Fichiers sur le serveur : `/opt/on-mars`
- Jeux : **On Mars** (2–4 joueurs) + morpion (test)
- Stack : `docker compose up -d --build` (game + Caddy)

Pour un vrai domaine plus tard : pointer un enregistrement A vers l’IP, mettre à jour `Caddyfile`, puis `docker compose up -d`.

## Dev local

Terminal 1 — serveur :

```bash
cd server
cargo run
```

Terminal 2 — client (proxy `/ws` → `:8080`) :

```bash
cd client
pnpm install
pnpm dev
```

Ouvre http://localhost:5173

Sandbox UI (sans lobby / WS) : http://localhost:5173/test

## Docker (prod-like)

```bash
docker compose up --build
```

Puis http://localhost:8080

## Déploiement Hostinger VPS

1. Copier le dossier `web/` sur le VPS
2. Installer Docker
3. `docker compose up -d --build`
4. Placer Caddy ou Nginx devant avec TLS et upgrade WebSocket vers `127.0.0.1:8080`

Exemple Caddy :

```
ton-domaine.com {
  reverse_proxy localhost:8080
}
```

## Variables

| Variable | Défaut | Rôle |
|----------|--------|------|
| `SERVER_ADDR` | `0.0.0.0:8080` | Bind HTTP/WS |
| `STATIC_DIR` | `../client/dist` | Fichiers SPA |
| `VITE_WS_URL` | same-origin `/ws` | Override WS en dev si besoin |
