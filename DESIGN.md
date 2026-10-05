# AGEZIM — Documento de Design (prompt aprimorado)

> Versão refinada do pedido original. É o "contrato" do jogo: tudo o que está aqui existe no código,
> e o que está em **Roadmap** é o que vamos incluindo juntos.

## 1. Visão

Clone enxuto de **Age of Empires** em HTML5 (Canvas 2D), visão **isométrica 2:1**, com gráficos 100% procedurais
(sem arquivos de imagem): terreno suave com praias e águas rasas, construções com volume e sombra, unidades
articuladas com animações por ação (cortar, minerar, plantar, construir, atirar, lutar), partículas, fog of war e
iluminação suave. Uma civilização (**Reino Azul / Reino Vermelho**, tema medieval europeu), partidas curtas (15–30 min).

## 2. Mapa

* **Ilha** única, gerada por semente (ruído + queda radial), costa irregular, praia de areia, águas rasas e oceano profundo.
* Água é intransponível (sem barcos nesta versão).
* Dois pontos de partida em lados opostos da ilha (jogador e inimigo), cada um com recursos garantidos por perto
  (bosque, frutas, ouro, pedra, galinhas), e recursos disputados no centro (ouro, cavalos).
* Fog of war: preto = inexplorado, escurecido = explorado, claro = visível.

## 3. Recursos e economia

| Recurso | Fonte | Como coleta |
|---|---|---|
| Comida | Arbustos de frutas, caça (galinha, coelho, vaca, cavalo), **Fazendas** | Aldeão |
| Madeira | Árvores (carvalho, pinheiro, palmeira) | Aldeão |
| Ouro | Minas de ouro | Aldeão |
| Pedra | Minas de pedra | Aldeão |

* Aldeão carrega 10 unidades (20 de carne) e **precisa levar ao depósito mais próximo** (Centro da Cidade ou Depósito).
* Recurso esgotado → o aldeão procura o mais próximo do mesmo tipo automaticamente.
* Fazendas têm comida finita (300); ao esgotar, **replantam sozinhas** por 60 de madeira (se faltar madeira, somem e o aldeão procura outra).
* Cada recurso aceita um número limitado de coletores ao mesmo tempo (árvore 3, fazenda 2…); o excedente vai para o mais próximo.
* Início: 5 aldeões, 1 guerreiro, 200 comida, 200 madeira, 100 ouro, 100 pedra.
* **População** limitada por casas (+5) e Centro da Cidade (+8). Teto: 100.

## 4. Criaturas (gaia)

| Criatura | Comida | Comportamento |
|---|---|---|
| Coelho | 25 | Rápido, foge ao ser atacado |
| Galinha | 40 | Anda perto da base inicial, foge um pouco |
| Vaca | 150 | Lenta, resistente, não foge |
| Cavalo | 200 | Muito resistente, foge em disparada |

Caçar = atacar o animal; ao morrer vira carcaça que pode ser coletada. Arqueiros caçam de longe.

## 5. Unidades

| Unidade | Custo | Papel |
|---|---|---|
| **Aldeão** | 50 comida | Constrói, coleta, caça, minera, planta, repara; luta fracamente |
| **Arqueiro** | 25 madeira, 45 ouro | Ataque à distância (alcance 5.5), frágil, fraco contra construções |
| **Guerreiro** | 50 comida, 20 ouro | Corpo a corpo, resistente, derruba construções |

Contra-jogo: guerreiros vencem arqueiros no corpo a corpo; arqueiros protegidos por guerreiros vencem tudo;
construções têm armadura de perfuração alta (flechas quase não adiantam).

## 6. Construções

| Construção | Tamanho | Custo | Função |
|---|---|---|---|
| **Centro da Cidade** | 4×4 | 275 madeira, 100 pedra | Treina aldeões, depósito, +8 pop, atira flechas |
| **Casa** | 2×2 | 30 madeira | +5 população |
| **Quartel** | 3×3 | 150 madeira | Treina guerreiros e arqueiros |
| **Ferreiro** | 3×3 | 100 madeira | Pesquisa melhorias militares |
| **Mercado** | 3×3 | 175 madeira | Compra/venda de recursos (preço varia com o uso) |
| **Fazenda** | 3×3 | 60 madeira | Comida renovável (caminhável) |
| **Depósito** | 2×2 | 40 madeira | Ponto de entrega de qualquer recurso + melhorias de coleta |
| **Muro** | 1×1 | 5 pedra | Bloqueia passagem; arrastar para fazer linhas |
| **Portão** | 1×1 | 25 pedra | Abre para aliados, fecha para inimigos; pode ser colocado sobre um muro |

Construção: aldeões chegam, constroem (mais aldeões = mais rápido, com retorno decrescente).
Construção em andamento mostra andaime e sobe aos poucos. Edifícios danificados pegam fogo e podem ser reparados.

## 7. Controles (padrão AoE)

* **Clique esquerdo**: seleciona. **Arrastar**: caixa de seleção em grupo. **Shift**: soma/remove. **Duplo clique**: todos do mesmo tipo na tela.
* **Clique direito**: comando contextual — mover, coletar, caçar, construir/reparar, atacar, entregar recursos.
  Com um prédio selecionado, define o **ponto de reunião**.
* **Ctrl+1..9** cria grupo, **1..9** seleciona, duplo toque centraliza.
* **Setas / bordas da tela / botão do meio**: câmera. **Roda**: zoom. **Minimapa**: clique/arraste move a câmera, clique direito comanda.
* **Q W E R T / A S D F G / Z X C V B**: atalhos da grade de comandos (igual ao AoE II).
* **.** (ponto): próximo aldeão ocioso · **H**: Centro da Cidade · **Del**: demolir · **Esc**: cancelar · **P**: pausa · **M**: som · **F1**: ajuda.

## 8. Inimigo (IA)

IA que joga com as mesmas regras (sem trapaça de recursos): coleta de verdade, constrói casas, depósitos perto dos
recursos, fazendas, quartéis e ferreiro, treina exército misto, pesquisa melhorias e ataca em ondas crescentes
(1ª onda por volta de 5:30 com 8 soldados; +4 a cada onda, no mínimo 110 s entre elas). Defende a base quando há
invasores. Se um muro/portão bloqueia o caminho, as tropas atacam o obstáculo. Pode ser desligada para modo livre
(opção na tela inicial ou `?ia=0`). Ajustes em `AI_CFG` (`js/data.js`).

## 9. Vitória / Derrota

* **Vitória**: destruir todas as construções do inimigo (exceto muros/portões).
* **Derrota**: perder todas as suas construções (exceto muros/portões).

## 10. Roadmap sugerido (próximos passos juntos)

1. Eras e tecnologias (Idade Média → Castelo), novas unidades (cavalaria, catapulta, monge).
2. Torres, castelo, portões duplos, armadilhas de muro.
3. Barcos, pesca, portos, mapa com várias ilhas.
4. Mais civilizações com bônus próprios.
5. Campanha/cenários, editor de mapas, salvar/carregar partida.
6. Multiplayer (WebRTC/WebSocket), replay.
7. Música dinâmica, ciclo dia/noite, clima.
