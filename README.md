# AGEZIM â€” Era dos Reinos

Clone enxuto de **Age of Empires** feito em HTML5 Canvas (JavaScript puro, sem dependÃªncias, sem imagens: todos os
grÃ¡ficos sÃ£o desenhados por cÃ³digo). O documento de design e o roadmap estÃ£o em [DESIGN.md](DESIGN.md).

## Jogar online

**<https://mqzgames.github.io/Agezim/>** â€” publicado automaticamente pelo GitHub Pages a cada push na branch `main`.

## Como jogar

* **OpÃ§Ã£o 0:** pelo link online acima (nÃ£o precisa instalar nada).
* **OpÃ§Ã£o 1 (rodar localmente):** dÃª duplo clique em `Jogar Agezim.bat` â€” sobe um servidor local e abre o navegador.
* **OpÃ§Ã£o 2:** `node devserver.js` e abra <http://127.0.0.1:8123>.
* **OpÃ§Ã£o 3:** abra `index.html` direto no navegador (Chrome/Edge/Firefox atuais).

Na tela inicial escolha a semente da ilha e se o reino inimigo (IA) fica ligado. A primeira geraÃ§Ã£o do terreno leva
alguns segundos (barra de carregamento). ParÃ¢metros de URL Ãºteis: `?seed=123`, `?ia=0`, `?auto=1` (pula a tela inicial).

### Controles rÃ¡pidos

| AÃ§Ã£o | Como |
|---|---|
| Selecionar / grupo | clique / arrastar (Shift soma, duplo clique = todos do tipo) |
| Comandar | botÃ£o direito (mover, coletar, caÃ§ar, construir, reparar, atacar, entregar) |
| Construir | selecione aldeÃµes â†’ botÃ£o no painel (ou atalhos Q W E R T / A S D F G / Z X C V B) |
| Muro | arraste para fazer uma linha; PortÃ£o pode ficar sobre um muro (R gira) |
| Ponto de reuniÃ£o | prÃ©dio selecionado + botÃ£o direito |
| CÃ¢mera | setas, bordas da tela, botÃ£o do meio, roda (zoom), minimapa |
| Celular | toque seleciona/comanda · arrastar = câmera · pinça = zoom · segurar e arrastar = seleção em grupo · duplo toque = todos do tipo · ✔ confirma a construção |
| Outros | `.` aldeÃ£o ocioso Â· `H` Centro da Cidade Â· `Ctrl+1..9` grupos Â· `Del` demolir Â· `P` pausa Â· `M` som Â· `F1` ajuda |

## Estrutura do cÃ³digo

```
index.html, css/style.css      interface (DOM) e telas
js/util.js                     RNG, ruÃ­do, heap, cores
js/data.js                     TODO o balanceamento: unidades, construÃ§Ãµes, tecnologias, regras, IA
js/map.js                      geraÃ§Ã£o da ilha, recursos iniciais, terreno prÃ©-renderizado, minimapa
js/art_core.js                 primitivas de desenho isomÃ©trico (caixas, telhados, torres) e mini-3D
js/art_units.js                aldeÃ£o/arqueiro/guerreiro (esqueleto 3D -> sprites em 8 direÃ§Ãµes)
js/art_nature.js               Ã¡rvores, minas, arbustos, decalques, criaturas
js/art_buildings.js            construÃ§Ãµes, muros/portÃµes, andaimes, fundaÃ§Ãµes, entulho
js/art_ui.js                   Ã­cones procedurais
js/path.js                     A* + suavizaÃ§Ã£o por linha de visÃ£o
js/game.js                     estado do jogo, entidades, visÃ£o, dano, economia, produÃ§Ã£o
js/units.js                    comportamento (mover, coletar, construir, combater, criaturas) e comandos
js/fx.js                       partÃ­culas, flechas, textos flutuantes e som sintetizado (WebAudio)
js/render.js                   cÃ¢mera, Ã¡gua, nÃ©voa de guerra, desenho ordenado por profundidade
js/ai.js                       IA do reino inimigo
js/ui.js                       painÃ©is, minimapa, entrada do mouse/teclado
js/main.js                     arranque e laÃ§o principal
devserver.js                   servidor estÃ¡tico de desenvolvimento
```

## Como evoluir (receitas)

* **Nova unidade:** adicione em `UNIT_DEFS` (`data.js`), inclua o id em `trains` do prÃ©dio que a treina e desenhe-a em
  `art_units.js` (`HUMAN_STYLE` + poses em `humanPose`/`drawHuman`).
* **Nova construÃ§Ã£o:** `BUILD_DEFS` (`data.js`) + funÃ§Ã£o `_nome(ctx, tm, opts)` em `art_buildings.js` (e altura em `hpx`).
  Se tiver atalho no painel, defina `hotkeySlot`.
* **Nova tecnologia:** `TECHS` (`data.js`) com `fx` (ataque, alcance, armadura, coleta, carga) e liste o id em `techs`
  do prÃ©dio; Ã­cone em `art_ui.js` (`Icons.tech`).
* **Novo recurso/criatura:** `NODE_DEFS`/`GATHER` e `UNIT_DEFS` (`animal: true`) + sprites em `art_nature.js`.
* **Balanceamento da IA:** `AI_CFG` em `data.js` e `js/ai.js`.

## LimitaÃ§Ãµes conhecidas (candidatas ao roadmap)

Sem barcos (Ã¡gua Ã© intransponÃ­vel), sem eras/tecnologias avanÃ§adas, sem guarniÃ§Ã£o em prÃ©dios, sem salvar/carregar,
um Ãºnico mapa de ilha por semente e uma Ãºnica civilizaÃ§Ã£o (cores azul/vermelha).

> Dica de desenvolvimento: `window.snap('nome')` (com `devserver.js`) grava o canvas do jogo em PNG no servidor.
