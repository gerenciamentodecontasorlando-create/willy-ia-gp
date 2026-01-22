# willy-ia-gp
# Agenda Zen (PWA)

## Como publicar no GitHub Pages
1. Crie um repositório (ou use um existente)
2. Envie TODOS os arquivos (index.html, style.css, app.js, manifest.webmanifest, service-worker.js, pasta icons/)
3. Settings → Pages → Deploy from branch → Branch: main (/) → Save
4. Abra o link do Pages. No Android/Chrome: ⋮ → Instalar app

## Offline
- O app funciona offline (tarefas/notas/backup).
- PDF usa jsPDF via CDN: se estiver totalmente offline e a lib não carregar, use Ctrl+P como alternativa.
