# AGEZIM — Era dos Reinos

Clone enxuto de **Age of Empires** feito em HTML5 Canvas (JavaScript puro, sem dependências, sem imagens: todos os
gráficos são desenhados por código). O documento de design e o roadmap estão em [DESIGN.md](DESIGN.md).

## Como jogar

* **Opção 1 (recomendada):** dê duplo clique em `Jogar Agezim.bat` — sobe um servidor local e abre o navegador.
* **Opção 2:** `node devserver.js` e abra <http://127.0.0.1:8123>.
* **Opção 3:** abra `index.html` direto no navegador (Chrome/Edge/Firefox atuais).

Na tela inicial escolha a semente da ilha e se o reino inimigo (IA) fica ligado. A primeira geração do terreno leva
alguns segundos (barra de carregamento). Parâmetros de URL úteis: `?seed=123`, `?ia=0`, `?auto=1` (pula a tela inicial).

### Controles rápidos

| Ação | Como |
|---|---|
| Selecionar / grupo | clique / arrastar (Shift soma, duplo clique = todos do tipo) |
| Comandar | botão direito (mover, coletar, caçar, construir, reparar, atacar, entregar) |
| Construir | selecione aldeões → botão no painel (ou atalhos Q W E R T / A S D F G / Z X C V B) |
| Muro | arraste para fazer uma linha; Portão pode ficar sobre um muro (R gira) |
| Ponto de reunião | prédio selecionado + botão direito |
| Câmera | setas, bordas da tela, botão do meio, roda (zoom), minimapa |
| Outros | `.` aldeão ocioso · `H` Centro da Cidade · `Ctrl+1..9` grupos · `Del` demolir · `P` pausa · `M` som · `F1` ajuda |

## Estrutura do código

```
index.html, css/style.css      interface (DOM) e telas
js/util.js                     RNG, ruído, heap, cores
js/data.js                     TODO o balanceamento: unidades, construções, tecnologias, regras, IA
js/map.js                      geração da ilha, recursos iniciais, terreno pré-renderizado, minimapa
js/art_core.js                 primitivas de desenho isométrico (caixas, telhados, torres) e mini-3D
js/art_units.js                aldeão/arqueiro/guerreiro (esqueleto 3D -> sprites em 8 direções)
js/art_nature.js               árvores, minas, arbustos, decalques, criaturas
js/art_buildings.js            construções, muros/portões, andaimes, fundações, entulho
js/art_ui.js                   ícones procedurais
js/path.js                     A* + suavização por linha de visão
js/game.js                     estado do jogo, entidades, visão, dano, economia, produção
js/units.js                    comportamento (mover, coletar, construir, combater, criaturas) e comandos
js/fx.js                       partículas, flechas, textos flutuantes e som sintetizado (WebAudio)
js/render.js                   câmera, água, névoa de guerra, desenho ordenado por profundidade
js/ai.js                       IA do reino inimigo
js/ui.js                       painéis, minimapa, entrada do mouse/teclado
js/main.js                     arranque e laço principal
devserver.js                   servidor estático de desenvolvimento
```

## Como evoluir (receitas)

* **Nova unidade:** adicione em `UNIT_DEFS` (`data.js`), inclua o id em `trains` do prédio que a treina e desenhe-a em
  `art_units.js` (`HUMAN_STYLE` + poses em `humanPose`/`drawHuman`).
* **Nova construção:** `BUILD_DEFS` (`data.js`) + função `_nome(ctx, tm, opts)` em `art_buildings.js` (e altura em `hpx`).
  Se tiver atalho no painel, defina `hotkeySlot`.
* **Nova tecnologia:** `TECHS` (`data.js`) com `fx` (ataque, alcance, armadura, coleta, carga) e liste o id em `techs`
  do prédio; ícone em `art_ui.js` (`Icons.tech`).
* **Novo recurso/criatura:** `NODE_DEFS`/`GATHER` e `UNIT_DEFS` (`animal: true`) + sprites em `art_nature.js`.
* **Balanceamento da IA:** `AI_CFG` em `data.js` e `js/ai.js`.

## Limitações conhecidas (candidatas ao roadmap)

Sem barcos (água é intransponível), sem eras/tecnologias avançadas, sem guarnição em prédios, sem salvar/carregar,
um único mapa de ilha por semente e uma única civilização (cores azul/vermelha).

> Dica de desenvolvimento: `window.snap('nome')` (com `devserver.js`) grava o canvas do jogo em PNG no servidor.
