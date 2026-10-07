'use strict';
/* ============================================================
   AGEZIM — definições de dados (balanceamento fica aqui)
   ============================================================ */

const TW = 64, TH = 32, HW = 32, HH = 16;   // tamanho do tile isométrico
const MAP_N = 96;                            // mapa MAP_N x MAP_N tiles

/* dispositivo de toque: terreno em resolução menor (limite de canvas do iOS) e DPR menor */
const IS_TOUCH = (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window && navigator.maxTouchPoints > 0);
const TERRAIN_SCALE = IS_TOUCH ? 0.7 : 1;

const T_DEEP = 0, T_SHALLOW = 1, T_SAND = 2, T_GRASS = 3;

const TEAM_COLORS = [
  { name: 'Reino Azul', main: [46, 112, 222], dark: [20, 58, 138], light: [128, 176, 255], css: '#3d7be0' },
  { name: 'Reino Vermelho', main: [214, 54, 44], dark: [124, 24, 22], light: [255, 136, 112], css: '#d8453a' },
];
const GAIA = -1;

const RES_TYPES = ['food', 'wood', 'gold', 'stone'];
const RES_NAMES = { food: 'Comida', wood: 'Madeira', gold: 'Ouro', stone: 'Pedra' };

const RULES = {
  maxPop: 100,
  start: { food: 200, wood: 200, gold: 100, stone: 100 },
  startVillagers: 5,
  startWarriors: 1,
  armorMin: 1,          // dano mínimo contra unidades
  armorMinBuilding: 0.5,
};

/* taxas de coleta (por segundo) e capacidade de carga */
const GATHER = {
  tree:    { res: 'wood',  rate: 1.0,  cap: 10 },
  bush:    { res: 'food',  rate: 1.15, cap: 10 },
  farm:    { res: 'food',  rate: 0.8,  cap: 10 },
  carcass: { res: 'food',  rate: 1.9,  cap: 20 },
  gold:    { res: 'gold',  rate: 0.85, cap: 10 },
  stone:   { res: 'stone', rate: 0.85, cap: 10 },
};

/* nós de recurso (árvores, minas, arbustos) */
const NODE_DEFS = {
  tree:  { name: 'Árvore',           amount: 100, sub: 'tree', block: true },
  pine:  { name: 'Pinheiro',         amount: 110, sub: 'tree', block: true },
  palm:  { name: 'Palmeira',         amount: 80,  sub: 'tree', block: true },
  bush:  { name: 'Arbusto de frutas', amount: 200, sub: 'bush', block: true },
  gold:  { name: 'Mina de ouro',     amount: 600, sub: 'gold', block: true },
  stone: { name: 'Mina de pedra',    amount: 450, sub: 'stone', block: true },
  carcass: { name: 'Carcaça',        amount: 0,   sub: 'carcass', block: false },
};

/* unidades e criaturas */
const UNIT_DEFS = {
  villager: {
    name: 'Aldeão', hp: 25, speed: 1.9, attack: 4, attackType: 'melee', range: 0.35, rof: 1.0,
    armor: { melee: 0, pierce: 0 }, cost: { food: 50 }, time: 20, pop: 1, sight: 6.5, radius: 0.27,
    builder: true, desc: 'Constrói, coleta, caça, minera e planta. Luta mal.',
  },
  archer: {
    name: 'Arqueiro', hp: 30, speed: 1.85, attack: 4, attackType: 'pierce', range: 5.5, rof: 1.4,
    armor: { melee: 0, pierce: 0 }, cost: { wood: 25, gold: 45 }, time: 25, pop: 1, sight: 8.5, radius: 0.27,
    military: true, projectile: 'arrow', desc: 'Ataque à distância. Frágil de perto e fraco contra construções.',
  },
  warrior: {
    name: 'Guerreiro', hp: 55, speed: 2.05, attack: 6, attackType: 'melee', range: 0.4, rof: 1.1,
    armor: { melee: 1, pierce: 1 }, cost: { food: 50, gold: 20 }, time: 22, pop: 1, sight: 6.5, radius: 0.29,
    military: true, desc: 'Infantaria corpo a corpo. Resistente; derruba construções.',
  },
  /* criaturas */
  rabbit: {
    name: 'Coelho', animal: true, hp: 3, speed: 0.55, flee: 3.2, fleeTime: 2.2, food: 25, radius: 0.15,
    armor: { melee: 0, pierce: 0 }, sight: 4, size: 0.5,
  },
  chicken: {
    name: 'Galinha', animal: true, hp: 4, speed: 0.6, flee: 2.0, fleeTime: 1.6, food: 40, radius: 0.17,
    armor: { melee: 0, pierce: 0 }, sight: 4, size: 0.6,
  },
  cow: {
    name: 'Vaca', animal: true, hp: 32, speed: 0.55, flee: 0, fleeTime: 0, food: 150, radius: 0.4,
    armor: { melee: 0, pierce: 0 }, sight: 4, size: 1.0,
  },
  horse: {
    name: 'Cavalo', animal: true, hp: 48, speed: 0.9, flee: 3.6, fleeTime: 2.6, food: 200, radius: 0.42,
    armor: { melee: 0, pierce: 0 }, sight: 5, size: 1.1,
  },
};

/* construções */
const BUILD_DEFS = {
  towncenter: {
    name: 'Centro da Cidade', w: 4, d: 4, cost: { wood: 275, stone: 100 }, hp: 2400, time: 90, pop: 8, sight: 10,
    dropoff: true, trains: ['villager'], techs: ['wheel'], armor: { melee: 4, pierce: 14 },
    attack: { dmg: 7, range: 7.5, rof: 2.0 }, smoke: true, hotkeySlot: 6,
    desc: 'Coração do reino. Treina aldeões, recebe recursos, +8 população e dispara flechas contra invasores.',
  },
  house: {
    name: 'Casa', fem: true, w: 2, d: 2, cost: { wood: 30 }, hp: 450, time: 25, pop: 5, sight: 4,
    armor: { melee: 2, pierce: 6 }, smoke: true, hotkeySlot: 0,
    desc: 'Aumenta o limite de população em 5.',
  },
  farm: {
    name: 'Fazenda', fem: true, w: 3, d: 3, cost: { wood: 60 }, hp: 120, time: 18, sight: 3, walkable: true,
    farm: true, food: 300, armor: { melee: 0, pierce: 0 }, hotkeySlot: 1, maxWorkers: 2,
    desc: 'Campo de cultivo. Fornece comida (300) enquanto houver plantação. Unidades podem caminhar sobre ela.',
  },
  depot: {
    name: 'Depósito', w: 2, d: 2, cost: { wood: 40 }, hp: 600, time: 20, sight: 5, dropoff: true,
    techs: ['axe', 'plow', 'pick'], armor: { melee: 2, pierce: 6 }, hotkeySlot: 2,
    desc: 'Ponto de entrega de qualquer recurso. Construa perto de árvores, minas e fazendas.',
  },
  barracks: {
    name: 'Quartel', w: 3, d: 3, cost: { wood: 150 }, hp: 1300, time: 45, sight: 6, trains: ['warrior', 'archer'],
    armor: { melee: 3, pierce: 10 }, hotkeySlot: 3,
    desc: 'Treina guerreiros e arqueiros.',
  },
  blacksmith: {
    name: 'Ferreiro', w: 3, d: 3, cost: { wood: 100 }, hp: 1100, time: 40, sight: 5,
    techs: ['forge1', 'bow1', 'armor1', 'forge2', 'bow2', 'armor2'], armor: { melee: 3, pierce: 10 },
    smoke: true, hotkeySlot: 4,
    desc: 'Pesquisa melhorias de ataque, alcance e armadura para o exército.',
  },
  market: {
    name: 'Mercado', w: 3, d: 3, cost: { wood: 175 }, hp: 1100, time: 40, sight: 5, market: true,
    armor: { melee: 3, pierce: 10 }, hotkeySlot: 5,
    desc: 'Compre e venda recursos. Os preços variam conforme o uso.',
  },
  wall: {
    name: 'Muro', w: 1, d: 1, cost: { stone: 5 }, hp: 500, time: 5, sight: 1, wall: true,
    armor: { melee: 4, pierce: 14 }, hotkeySlot: 7,
    desc: 'Bloqueia a passagem. Arraste para construir uma linha de muros.',
  },
  gate: {
    name: 'Portão', w: 1, d: 1, cost: { stone: 25 }, hp: 700, time: 9, sight: 2, wall: true, gate: true,
    armor: { melee: 4, pierce: 14 }, hotkeySlot: 8,
    desc: 'Abre para suas unidades, fecha para inimigos. Pode ser colocado sobre um muro (R gira).',
  },
};

/* tecnologias (pesquisadas em ferreiro, depósito e centro) */
const TECHS = {
  forge1: { name: 'Forja de Espadas', cost: { food: 100, gold: 60 }, time: 35, desc: '+2 de ataque para guerreiros.', fx: { atk: { warrior: 2 } }, icon: 'sword' },
  forge2: { name: 'Aço Temperado', cost: { food: 200, gold: 120 }, time: 50, req: 'forge1', desc: '+2 de ataque para guerreiros.', fx: { atk: { warrior: 2 } }, icon: 'sword2' },
  bow1: { name: 'Arcos Reforçados', cost: { wood: 100, gold: 75 }, time: 35, desc: '+1 de ataque e +1 de alcance para arqueiros.', fx: { atk: { archer: 1 }, range: { archer: 1 } }, icon: 'bow' },
  bow2: { name: 'Arco Longo', cost: { wood: 200, gold: 125 }, time: 50, req: 'bow1', desc: '+1 de ataque e +1 de alcance para arqueiros.', fx: { atk: { archer: 1 }, range: { archer: 1 } }, icon: 'bow2' },
  armor1: { name: 'Armadura de Couro', cost: { food: 100, gold: 100 }, time: 40, desc: '+1 armadura corpo a corpo e +1 perfurante (exército).', fx: { armor: { melee: 1, pierce: 1 } }, icon: 'shield' },
  armor2: { name: 'Cota de Malha', cost: { food: 200, gold: 150 }, time: 55, req: 'armor1', desc: '+1 armadura corpo a corpo e +2 perfurante (exército).', fx: { armor: { melee: 1, pierce: 2 } }, icon: 'shield2' },
  axe: { name: 'Machado de Ferro', cost: { food: 100, wood: 50 }, time: 30, desc: 'Lenhadores coletam madeira 25% mais rápido.', fx: { gather: { wood: 1.25 } }, icon: 'axe' },
  plow: { name: 'Arado Pesado', cost: { food: 100, wood: 75 }, time: 30, desc: 'Fazendeiros produzem 25% mais comida.', fx: { gather: { farm: 1.25 } }, icon: 'plow' },
  pick: { name: 'Picareta de Aço', cost: { food: 100, gold: 50 }, time: 30, desc: 'Mineradores coletam ouro e pedra 25% mais rápido.', fx: { gather: { gold: 1.25, stone: 1.25 } }, icon: 'pick' },
  wheel: { name: 'Carrinho de Mão', cost: { food: 150, wood: 100 }, time: 40, desc: 'Aldeões carregam +5 recursos.', fx: { carry: 5 }, icon: 'wheel' },
};

/* grade de atalhos (igual ao AoE II) */
const HOTKEY_GRID = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'];

/* comportamento da IA inimiga */
const AI_CFG = {
  villagerTarget: 22,
  firstWave: 8,
  waveGrowth: 4,
  waveInterval: 110,     // s mínimos entre ondas
  firstWaveTime: 330,    // s antes da primeira onda
};
