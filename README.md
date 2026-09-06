# 🚴 MeuPedal

**Gravador de ciclismo e treino com GPS ao vivo**, estilo Strava — funciona direto no celular como PWA (Progressive Web App), sem precisar instalar nada da loja.

## ✨ Funcionalidades

- 📍 **Mapa ao vivo** com traçado do percurso em tempo real (Leaflet + CartoDB)
- 📊 **HUD de métricas** no guidão: velocidade, distância, tempo, subida, calorias
- 🎧 **Áudio Coach por voz** nos fones Bluetooth (anuncia km, tempo e ritmo)
- ⏸ **Auto-pausa inteligente** em semáforos e paradas
- 🗺️ **Resumo pós-treino** estilo Strava com mapa por gradiente de velocidade
- 📈 **Gráfico de altimetria** interativo com scrub no gráfico → ponto no mapa
- 📥 **Exportação GPX** compatível com Strava, Garmin, Komoot
- 🚲 **Garagem da Bike** com controle de quilometragem e desgaste de peças
- 📱 **PWA instalável** na tela inicial do Android e iPhone
- 🔋 **Wake Lock** — mantém a tela acesa durante o pedal

## 🚀 Como rodar localmente

```bash
# Clonar o repositório
git clone https://github.com/RhaonyFerraz/meupedal.git
cd meupedal

# Iniciar o servidor local (Node.js puro, sem dependências)
node server.js

# Abrir no navegador
# http://localhost:3000
```

> **Requisito:** [Node.js](https://nodejs.org/) instalado na máquina.

## 📱 Como instalar no celular

**Android (Chrome):** Menu ⋮ → *"Instalar aplicativo"* ou *"Adicionar à tela inicial"*

**iPhone (Safari):** Botão de Compartilhar → *"Adicionar à Tela de Início"*

## 🛠️ Tecnologias

| Tech | Uso |
|------|-----|
| HTML + CSS + JavaScript puro | Interface e lógica |
| [Leaflet.js](https://leafletjs.com/) | Mapas interativos |
| CartoDB Tiles | Estilo de mapa (gratuito) |
| Geolocation API | GPS do dispositivo |
| Web Speech API | Áudio coach por voz |
| IndexedDB | Armazenamento local de pedais |
| Service Worker | PWA offline |
| Wake Lock API | Tela sempre ativa |

## 📁 Estrutura do Projeto

```
meupedal/
├── index.html          # App principal (SPA)
├── server.js           # Servidor Node.js simples
├── manifest.json       # Config PWA
├── sw.js               # Service Worker
├── css/
│   ├── main.css        # Estilos principais
│   ├── hud.css         # HUD do gravador
│   └── leaflet-custom.css
├── js/
│   ├── app.js          # Controlador principal
│   ├── tracker.js      # GPS, métricas, simulador
│   ├── map.js          # Leaflet + polylines
│   ├── elevation-chart.js  # Gráfico de altimetria
│   ├── audio-coach.js  # Voz no fone
│   ├── gpx-exporter.js # Export GPX
│   ├── garage.js       # Garagem da bike
│   ├── history.js      # Feed de atividades
│   └── db.js           # IndexedDB
└── assets/
    └── icons/          # Ícones PWA
```

## 📄 Licença

MIT — livre para usar, modificar e distribuir.
