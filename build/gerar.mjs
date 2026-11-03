#!/usr/bin/env node
// Gera as artes animadas do perfil (assets/*.svg).
// Fotos e capturas: build/imagens · ícones: build/icones.json · fontes: Google Fonts, baixadas
// só com as letras de cada arte e embutidas no próprio SVG (o GitHub não deixa um SVG buscar
// nada fora dele). Mesma paleta, fonte e marca do portfólio.
// Rode com: node build/gerar.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (arq) => readFile(path.join(RAIZ, arq));
const icones = JSON.parse(await ler('build/icones.json'));
const imagem = async (arq) => 'data:image/webp;base64,' + (await ler('build/imagens/' + arq)).toString('base64');

// paleta do portfólio (Portfolio-Gabriel-B/css/style.css)
const C = {
  laranja: '#f26b1d', laranja2: '#ff9536', pessego: '#ffd2a8', pessego50: '#fff6ef', pessego100: '#ffe9d8',
  ferrugem: '#c4520f', brasa950: '#1a0803', brasa900: '#240a03', brasa800: '#3a1406', brasa700: '#5c210a',
  tinta: '#111111', cinza: '#3b3b3b', painel: '#f7f6f4',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const desfaz = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// largura aproximada de um texto em Inter Tight, para pílulas, linhas e botões
function largura(txt, tam, peso = 500) {
  let u = 0;
  for (const ch of txt) {
    if (ch === ' ') u += .25;
    else if ('il.,:;\'|!'.includes(ch)) u += .24;
    else if ('fjtr()[]'.includes(ch)) u += .33;
    else if ('mwMW'.includes(ch)) u += .8;
    else if (/[A-ZÀ-Ý]/.test(ch)) u += .64;
    else if (/[0-9]/.test(ch)) u += .56;
    else u += .52;
  }
  return u * tam * (peso >= 600 ? 1.04 : 1);
}

// ---------- fontes ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const FAMILIAS = { inter: 'Inter+Tight', mono: 'JetBrains+Mono' };

// baixa, para cada família, só os pesos e as letras que a arte usa
async function fontes(corpo) {
  const uso = { inter: { pesos: new Set(), letras: new Set(' ') }, mono: { pesos: new Set(), letras: new Set(' ') } };
  for (const [, attrs, miolo] of corpo.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const u = uso[/class="mono"/.test(attrs) ? 'mono' : 'inter'];
    u.pesos.add((attrs.match(/font-weight="(\d+)"/) || [, '400'])[1]);
    for (const ch of desfaz(miolo.replace(/<[^>]+>/g, ''))) u.letras.add(ch);
  }
  let saida = '';
  for (const [fam, u] of Object.entries(uso)) {
    if (!u.pesos.size) continue;
    const pesos = [...u.pesos].sort().join(';');
    const url = `https://fonts.googleapis.com/css2?family=${FAMILIAS[fam]}:wght@${pesos}&text=${encodeURIComponent([...u.letras].join(''))}`;
    const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
    const blocos = [...css.matchAll(/@font-face\s*{([^}]*)}/g)];
    if (!blocos.length) throw new Error('O Google Fonts não devolveu fontes para ' + url);
    for (const [, bloco] of blocos) {
      const familia = bloco.match(/font-family:\s*'([^']+)'/)[1];
      const peso = bloco.match(/font-weight:\s*(\d+)/)[1];
      const arq = bloco.match(/url\(([^)]+)\)/)[1];
      const b64 = Buffer.from(await (await fetch(arq)).arrayBuffer()).toString('base64');
      saida += `@font-face{font-family:'${familia}';font-weight:${peso};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
    }
  }
  return saida;
}

// ---------- base comum ----------
const BASE =
  `text{font-family:'Inter Tight',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}` +
  `.mono{font-family:'JetBrains Mono',ui-monospace,Consolas,monospace}` +
  `@keyframes sobe{from{opacity:0;transform:translateY(18px)}}@keyframes surge{from{opacity:0}}` +
  `@keyframes desenha{from{stroke-dashoffset:100}}@keyframes pisca{50%{opacity:0}}` +
  `@keyframes pulso{75%,100%{transform:scale(2.6);opacity:0}}` +
  `.sobe{animation:sobe .9s cubic-bezier(.2,.7,.2,1) var(--d,0s) both}` +
  `.surge{animation:surge 1.1s ease var(--d,0s) both}` +
  `.desenha{stroke-dasharray:100;animation:desenha 1.8s cubic-bezier(.6,0,.2,1) var(--d,0s) both}` +
  `.pisca{animation:pisca 1.1s steps(1) infinite}` +
  `.pulso{transform-box:fill-box;transform-origin:center;animation:pulso 1.8s cubic-bezier(0,0,.2,1) infinite}` +
  `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

async function arte(nome, { w, h, titulo, css = '', defs = '', corpo }) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(titulo)}">` +
    `<title>${esc(titulo)}</title><style>${await fontes(corpo)}${BASE}${css}</style><defs>${defs}</defs>${corpo}</svg>`;
  await writeFile(path.join(RAIZ, 'assets', nome + '.svg'), svg);
  console.log(`assets/${nome}.svg`.padEnd(40), (svg.length / 1024).toFixed(0).padStart(4), 'KB');
}

// ---------- peças ----------
const pontos = (id, cor, op) =>
  `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${cor}" fill-opacity="${op}"/></pattern>`;

const gradMarca = (id) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="4" y1="6" x2="44" y2="34"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${C.pessego}"/><stop offset="1" stop-color="${C.laranja2}"/></linearGradient>`;

// marca GR ligada com o cursor de terminal (a mesma do rodapé e do favicon do portfólio)
const MARCA = 'M21.9 10.2A12 12 0 1 0 27 20M27 32V8h5.5a6 6 0 0 1 0 12H17M31 20l7 12';
const marca = ({ x, y, s, traco, espessura = 4.2, desenha = false, d = '0s', cursor = C.laranja2, opacidade = 1 }) =>
  `<g transform="translate(${x} ${y}) scale(${s})" opacity="${opacidade}"><path d="${MARCA}" pathLength="100" fill="none" stroke="${traco}" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round"${desenha ? ` class="desenha" style="--d:${d}"` : ''}/><rect x="42" y="27" width="6" height="5" rx="1" fill="${cursor}" class="pisca"/></g>`;

// seta ↗ desenhada (não depende de a fonte ter o caractere)
const seta = (x, y, tam, cor, esp = 2) =>
  `<path d="M${x} ${y + tam}L${x + tam} ${y}M${x + tam * .3} ${y}H${x + tam}V${y + tam * .7}" fill="none" stroke="${cor}" stroke-width="${esp}" stroke-linecap="round" stroke-linejoin="round"/>`;

const pino = (x, y, cor) =>
  `<path transform="translate(${x} ${y}) scale(.75)" d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11zM12 12.4a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z" fill="none" stroke="${cor}" stroke-width="2"/>`;

const icone = (slug, x, y, tam, cor) => {
  const ic = icones[slug];
  const s = tam / 24;
  return ic.tipo === 'cheio'
    ? `<path transform="translate(${x} ${y}) scale(${s})" d="${ic.d}" fill="${cor}"/>`
    : `<path transform="translate(${x} ${y}) scale(${s})" d="${ic.d}" fill="none" stroke="${cor}" stroke-width="${1.9}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

// linha "digitada": as frases aparecem letra por letra, ficam um tempo e se apagam, em ciclo
function digitacao({ x, y, tam, frases, cor, corCursor, d0 }) {
  const cw = tam * .6; // JetBrains Mono: todo caractere tem 0,6 em
  const T = 4.4, N = frases.length, ciclo = N * T;
  const pc = (t) => (t / ciclo * 100).toFixed(3) + '%';
  let defs = '', css = '', corpo = '';
  const cursor = [];
  frases.forEach((f, i) => {
    const L = [...f].length, W = L * cw, s = i * T;
    const e1 = s + Math.min(L * .055, 2), e3 = s + T - .3, e2 = e3 - Math.min(L * .02, .6);
    css += `@keyframes dg${i}{0%,${pc(s)}{transform:scaleX(0);animation-timing-function:steps(${L},end)}${pc(e1)},${pc(e2)}{transform:scaleX(1);animation-timing-function:steps(${L},end)}${pc(e3)},100%{transform:scaleX(0)}}`;
    css += `.dg${i}{transform-origin:${x}px 0;animation:dg${i} ${ciclo}s linear ${d0}s infinite both}`;
    if (i) css += `@media (prefers-reduced-motion:reduce){.frase${i}{display:none}}`;
    defs += `<clipPath id="corte${i}"><rect class="dg${i}" x="${x}" y="${y - tam}" width="${W + 1}" height="${tam * 1.5}"/></clipPath>`;
    corpo += `<g clip-path="url(#corte${i})" class="frase${i}"><text class="mono" x="${x}" y="${y}" font-size="${tam}" fill="${cor}">${esc(f)}</text></g>`;
    cursor.push([s, 0, `steps(${L},end)`], [e1, W, 'linear'], [e2, W, `steps(${L},end)`], [e3, 0, 'linear']);
  });
  css += `@keyframes dgc{${cursor.map(([t, v, tf]) => `${pc(t)}{transform:translateX(${v.toFixed(1)}px);animation-timing-function:${tf}}`).join('')}100%{transform:translateX(0)}}`;
  css += `.dgc{animation:dgc ${ciclo}s linear ${d0}s infinite both}`;
  corpo += `<g class="dgc"><rect class="pisca" x="${x + 2}" y="${y - tam * .85}" width="${Math.round(tam * .14)}" height="${tam * 1.05}" rx="1" fill="${corCursor}"/></g>`;
  return { defs, css, corpo };
}

// pílulas lado a lado (quebrando linha quando passa da largura)
function pilulas(lista, { x, y, max, tam = 16, alt = 34, gap = 10, cor, fundo, borda }) {
  let cx = x, cy = y, svg = '';
  for (const t of lista) {
    const w = Math.round(largura(t, tam) + 30);
    if (cx + w > x + max) { cx = x; cy += alt + gap; }
    svg += `<rect x="${cx}" y="${cy}" width="${w}" height="${alt}" rx="${alt / 2}" fill="${fundo}" stroke="${borda}"/><text x="${cx + w / 2}" y="${cy + alt / 2 + tam * .36}" font-size="${tam}" font-weight="500" text-anchor="middle" fill="${cor}">${esc(t)}</text>`;
    cx += w + gap;
  }
  return { svg, fim: cy + alt };
}

// notebook com o site rolando sozinho na tela (como no carrossel do portfólio)
function notebook({ id, x, y, larg = 520, alt = 325, img, altImg, dur = 26 }) {
  const b = 20, desl = (altImg - alt).toFixed(1);
  const tampa = { x: x - b, y: y - b - 2, w: larg + 2 * b, h: alt + 2 * b + 2 };
  const by = tampa.y + tampa.h, bw = larg + 120, bx = x + larg / 2 - bw / 2;
  const css =
    `@keyframes rola${id}{0%,7%{transform:translateY(0);animation-timing-function:cubic-bezier(.45,0,.55,1)}84%,90%{transform:translateY(-${desl}px);animation-timing-function:cubic-bezier(.65,0,.35,1)}100%{transform:translateY(0)}}` +
    `.rola${id}{animation:rola${id} ${dur}s infinite}`;
  const defs =
    `<clipPath id="tela${id}"><rect x="${x}" y="${y}" width="${larg}" height="${alt}" rx="4"/></clipPath>` +
    `<linearGradient id="reflexo${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="tampa${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2e"/><stop offset="1" stop-color="#121214"/></linearGradient>` +
    `<linearGradient id="base${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a50"/><stop offset=".25" stop-color="#2c2c31"/><stop offset="1" stop-color="#151518"/></linearGradient>` +
    `<filter id="sombra${id}" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="12"/></filter>`;
  const corpo =
    `<ellipse cx="${x + larg / 2}" cy="${by + 30}" rx="${bw / 2 - 10}" ry="13" fill="#000" opacity=".55" filter="url(#sombra${id})"/>` +
    `<rect x="${tampa.x}" y="${tampa.y}" width="${tampa.w}" height="${tampa.h}" rx="18" fill="url(#tampa${id})" stroke="#3c3c42" stroke-width="1.5"/>` +
    `<circle cx="${x + larg / 2}" cy="${y - b / 2 - 1}" r="2.6" fill="#3a3a40"/>` +
    `<g clip-path="url(#tela${id})"><rect x="${x}" y="${y}" width="${larg}" height="${alt}" fill="#fff"/>` +
    `<image class="rola${id}" href="${img}" x="${x}" y="${y}" width="${larg}" height="${altImg}"/>` +
    `<rect x="${x}" y="${y}" width="${larg}" height="${alt}" fill="url(#reflexo${id})"/></g>` +
    `<path d="M${bx} ${by}H${bx + bw}V${by + 6}Q${bx + bw} ${by + 18} ${bx + bw - 22} ${by + 20}H${bx + 22}Q${bx} ${by + 18} ${bx} ${by + 6}Z" fill="url(#base${id})"/>` +
    `<rect x="${x + larg / 2 - 60}" y="${by}" width="120" height="7" rx="3.5" fill="#0d0d0f"/>`;
  return { css, defs, corpo };
}

// ---------- artes ----------

async function cabecalho() {
  const W = 1200, H = 460;
  const dg = digitacao({
    x: 96, y: 366, tam: 22, cor: C.pessego100, corCursor: C.laranja2, d0: 1.7,
    frases: ['lojas virtuais que vendem', 'sites institucionais sob medida', 'sistemas com painel e banco de dados', 'automações com IA que poupam horas', 'animações com GSAP e Three.js'],
  });
  const pilula = 'Sites  •  Lojas virtuais  •  Sistemas  •  IA';
  const wPil = Math.round(largura(pilula, 16) + 36);
  const status = 'Disponível para novos projetos';
  const wStatus = Math.round(largura(status, 16) + 62);
  const local = 'Ilhabela, SP · Brasil';
  await arte('cabecalho', {
    w: W, h: H,
    titulo: 'Gabriel Ribeiro, desenvolvedor web full stack. Sites que vendem. Sistemas que funcionam.',
    css: dg.css +
      `.flutua{transform-box:fill-box;transform-origin:center;animation:flutua 14s ease-in-out infinite alternate}@keyframes flutua{to{transform:translate(-50px,26px) scale(1.08)}}` +
      `.gira{transform-origin:950px 250px;animation:gira 70s linear infinite}@keyframes gira{to{transform:rotate(360deg)}}`,
    defs:
      `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="28"/></clipPath>` +
      `<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.brasa950}"/><stop offset=".55" stop-color="${C.brasa900}"/><stop offset="1" stop-color="${C.brasa700}"/></linearGradient>` +
      `<radialGradient id="brilho"><stop offset="0" stop-color="${C.laranja}" stop-opacity=".9"/><stop offset=".45" stop-color="${C.laranja}" stop-opacity=".3"/><stop offset="1" stop-color="${C.laranja}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="brilho2"><stop offset="0" stop-color="${C.pessego}" stop-opacity=".3"/><stop offset="1" stop-color="${C.pessego}" stop-opacity="0"/></radialGradient>` +
      pontos('pontos', C.pessego, .1) +
      `<radialGradient id="somePontos" cx=".2" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<mask id="mascaraPontos"><rect width="${W}" height="${H}" fill="url(#somePontos)"/></mask>` +
      `<linearGradient id="destaque" gradientUnits="userSpaceOnUse" x1="220" y1="0" x2="740" y2="0"><stop offset="0" stop-color="${C.pessego}"/><stop offset="1" stop-color="${C.laranja2}"/></linearGradient>` +
      gradMarca('gr') + dg.defs,
    corpo:
      `<g clip-path="url(#cartao)">` +
      `<rect width="${W}" height="${H}" fill="url(#fundo)"/>` +
      `<rect width="${W}" height="${H}" fill="url(#pontos)" mask="url(#mascaraPontos)"/>` +
      `<g class="flutua"><circle cx="950" cy="250" r="430" fill="url(#brilho)"/></g>` +
      `<circle cx="1140" cy="60" r="240" fill="url(#brilho2)"/>` +
      `<g fill="none" stroke="${C.pessego}" stroke-opacity=".1"><circle cx="950" cy="250" r="180"/><circle cx="950" cy="250" r="265"/><circle cx="950" cy="250" r="350"/></g>` +
      `<g class="gira"><circle cx="950" cy="250" r="222" fill="none" stroke="${C.laranja2}" stroke-opacity=".4" stroke-width="1.6" stroke-dasharray="2 14" stroke-linecap="round"/></g>` +
      `<g class="sobe" style="--d:.55s"><image href="${await imagem('foto-recorte.webp')}" x="800" y="14" width="300" height="450"/></g>` +
      // marca e nome
      marca({ x: 60, y: 40, s: 1.15, traco: 'url(#gr)', espessura: 4.4, desenha: true, d: '.1s' }) +
      `<g class="surge" style="--d:.35s"><line x1="134" y1="50" x2="134" y2="84" stroke="${C.pessego}" stroke-opacity=".3"/>` +
      `<text x="150" y="63" font-size="15" font-weight="600" letter-spacing="3.6" fill="#fff">GABRIEL</text>` +
      `<text x="150" y="83" font-size="15" font-weight="500" letter-spacing="3.6" fill="${C.pessego}" fill-opacity=".75">RIBEIRO</text></g>` +
      // pílula e título
      `<g class="sobe" style="--d:.4s"><rect x="64" y="118" width="${wPil}" height="38" rx="19" fill="#fff" fill-opacity=".05" stroke="${C.pessego}" stroke-opacity=".35"/>` +
      `<text x="${64 + wPil / 2}" y="143" font-size="16" font-weight="500" text-anchor="middle" fill="${C.pessego50}" xml:space="preserve">${esc(pilula)}</text></g>` +
      `<g class="sobe" style="--d:.55s"><text x="62" y="232" font-size="60" font-weight="500" letter-spacing="-1.4" fill="#fff">Sites que <tspan fill="url(#destaque)">vendem.</tspan></text></g>` +
      `<g class="sobe" style="--d:.7s"><text x="62" y="302" font-size="60" font-weight="500" letter-spacing="-1.4" fill="#fff">Sistemas que <tspan fill="url(#destaque)">funcionam.</tspan></text></g>` +
      // linha digitada
      `<g class="surge" style="--d:1.4s"><text class="mono" x="64" y="366" font-size="22" font-weight="700" fill="${C.laranja2}">›</text></g>` + dg.corpo +
      // disponível + cidade
      `<g class="sobe" style="--d:1.1s"><rect x="64" y="398" width="${wStatus}" height="38" rx="19" fill="#fff" fill-opacity=".06" stroke="${C.pessego}" stroke-opacity=".2"/>` +
      `<circle cx="88" cy="417" r="5" fill="${C.laranja2}"/><circle class="pulso" cx="88" cy="417" r="5" fill="${C.laranja2}"/>` +
      `<text x="104" y="423" font-size="16" font-weight="500" fill="${C.pessego100}">${status}</text>` +
      pino(64 + wStatus + 18, 408, C.pessego) +
      `<text x="${64 + wStatus + 42}" y="423" font-size="16" font-weight="500" fill="${C.pessego}" fill-opacity=".8">${local}</text></g>` +
      `</g>`,
  });
}

async function botoes() {
  const H = 60;
  // Ver portfólio (escuro)
  const t1 = 'Ver portfólio', w1 = Math.round(largura(t1, 20, 600) + 118);
  const brilho = (w) =>
    `<linearGradient id="luz" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<clipPath id="pilula"><rect width="${w}" height="${H}" rx="${H / 2}"/></clipPath>`;
  const passaLuz = (w) => `@keyframes luz{0%,62%{transform:translateX(-120px) skewX(-20deg)}100%{transform:translateX(${w + 40}px) skewX(-20deg)}}.luz{animation:luz 4.5s ease-in-out 1s infinite}`;
  await arte('botao-portfolio', {
    w: w1, h: H, titulo: 'Ver portfólio', css: passaLuz(w1),
    defs: brilho(w1) + gradMarca('gr'),
    corpo:
      `<rect x=".75" y=".75" width="${w1 - 1.5}" height="${H - 1.5}" rx="${H / 2 - .75}" fill="${C.brasa950}" stroke="${C.laranja2}" stroke-opacity=".55" stroke-width="1.5"/>` +
      marca({ x: 22, y: 15, s: .66, traco: 'url(#gr)', espessura: 4.6 }) +
      `<text x="66" y="37" font-size="20" font-weight="600" fill="#fff">${t1}</text>` +
      seta(w1 - 42, 24, 12, C.laranja2, 2.2) +
      `<g clip-path="url(#pilula)"><rect class="luz" x="0" y="0" width="70" height="${H}" fill="url(#luz)"/></g>`,
  });
  // WhatsApp (laranja)
  const t2 = 'Chamar no WhatsApp', w2 = Math.round(largura(t2, 20, 600) + 116);
  await arte('botao-whatsapp', {
    w: w2, h: H, titulo: 'Chamar no WhatsApp', css: passaLuz(w2),
    defs: brilho(w2) + `<linearGradient id="laranja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.laranja}"/><stop offset="1" stop-color="${C.laranja2}"/></linearGradient>`,
    corpo:
      `<rect width="${w2}" height="${H}" rx="${H / 2}" fill="url(#laranja)"/>` +
      icone('whatsapp', 24, 18, 24, C.brasa950) +
      `<text x="62" y="37" font-size="20" font-weight="600" fill="${C.brasa950}">${t2}</text>` +
      seta(w2 - 42, 24, 12, C.brasa950, 2.2) +
      `<g clip-path="url(#pilula)"><rect class="luz" x="0" y="0" width="70" height="${H}" fill="url(#luz)"/></g>`,
  });
}

// títulos de seção no estilo "(01) Sobre mim ——— Quem está por trás dos projetos", nos temas claro e escuro
async function titulos() {
  const lista = [
    ['sobre', '01', 'Sobre mim', 'Quem está por trás dos projetos'],
    ['projetos', '02', 'Projetos', 'Sites no ar, do design ao deploy'],
    ['stack', '03', 'Stack', 'Ferramentas do dia a dia'],
    ['entrego', '04', 'O que eu entrego', 'Do primeiro esboço ao site no ar'],
  ];
  const temas = {
    claro: { num: C.ferrugem, nome: C.tinta, linha: '#d8d2cb', sub: '#6b6560' },
    escuro: { num: C.laranja2, nome: '#f0f6fc', linha: '#30363d', sub: '#8b949e' },
  };
  for (const [arq, n, nome, sub] of lista) {
    for (const [tema, t] of Object.entries(temas)) {
      const xNome = 66, fimNome = xNome + largura(nome, 40, 600) + 26;
      const iniSub = 1200 - largura(sub, 18) - 26;
      await arte(`titulo-${arq}-${tema}`, {
        w: 1200, h: 90, titulo: `(${n}) ${nome}: ${sub}`,
        css: `.fio{transform-origin:${fimNome}px 0;animation:fio 1.4s cubic-bezier(.6,0,.2,1) .3s both}@keyframes fio{from{transform:scaleX(0)}}`,
        corpo:
          `<text class="mono" x="0" y="58" font-size="19" font-weight="500" fill="${t.num}">(${n})</text>` +
          `<text x="${xNome}" y="60" font-size="40" font-weight="600" letter-spacing="-.8" fill="${t.nome}">${esc(nome)}</text>` +
          `<line class="fio" x1="${fimNome.toFixed(0)}" y1="52" x2="${iniSub.toFixed(0)}" y2="52" stroke="${t.linha}" stroke-width="1.5"/>` +
          `<circle cx="${iniSub.toFixed(0)}" cy="52" r="3" fill="${t.num}"/>` +
          `<text x="1200" y="58" font-size="18" font-weight="500" text-anchor="end" fill="${t.sub}">${esc(sub)}</text>`,
      });
    }
  }
}

async function sobre() {
  const W = 1200, H = 570;
  // gabriel.ts, em tokens [cor, texto]
  const linhas = [
    [['kw', 'const'], ['', ' '], ['var', 'gabriel'], ['pun', ' = {']],
    [['', '  '], ['prop', 'cargo'], ['pun', ': '], ['str', '"Desenvolvedor Web Full Stack"'], ['pun', ',']],
    [['', '  '], ['prop', 'base'], ['pun', ': '], ['str', '"Ilhabela, SP · Brasil"'], ['pun', ',']],
    [['', '  '], ['prop', 'idade'], ['pun', ': '], ['num', '22'], ['pun', ',']],
    [['', '  '], ['prop', 'entrego'], ['pun', ': ['], ['str', '"sites"'], ['pun', ', '], ['str', '"lojas virtuais"'], ['pun', ',']],
    [['', '            '], ['str', '"sistemas"'], ['pun', ', '], ['str', '"automações com IA"'], ['pun', '],']],
    [['', '  '], ['prop', 'stack'], ['pun', ': ['], ['str', '"React"'], ['pun', ', '], ['str', '"TypeScript"'], ['pun', ', '], ['str', '"Supabase"'], ['pun', '],']],
    [['', '  '], ['prop', 'lema'], ['pun', ': '], ['str', '"Design que emociona. Código que entrega."'], ['pun', ',']],
    [['', '  '], ['prop', 'status'], ['pun', ': '], ['str', '"disponível para novos projetos"'], ['pun', ',']],
    [['pun', '};']],
    [],
    [['com', '// tem uma ideia? vamos tirar do papel.']],
    [['var', 'gabriel'], ['pun', '.'], ['fn', 'criar'], ['pun', '('], ['str', '"o seu próximo projeto"'], ['pun', ');']],
  ];
  const cores = { kw: C.laranja2, var: C.pessego50, prop: C.pessego, str: '#b9e39d', num: '#ffd479', pun: '#b08f7f', fn: '#8fc8ff', com: '#8d6b5b', '': '#fff' };
  const ex = 450, ey = 50, ew = 700, eh = 474; // janela do editor
  const cx = ex + 76, cw = 18 * .6, y0 = ey + 98, lh = 28.5;
  let codigo = '';
  linhas.forEach((toks, i) => {
    let col = 0, tsp = '';
    for (const [k, t] of toks) {
      const lead = t.length - t.trimStart().length;
      col += lead;
      const txt = t.trimStart();
      if (txt) tsp += `<tspan x="${(cx + col * cw).toFixed(1)}" fill="${cores[k]}"${k === 'com' ? ' font-style="italic"' : ''}>${esc(txt)}</tspan>`;
      col += [...txt].length;
    }
    const y = (y0 + i * lh).toFixed(1);
    codigo += `<g class="linha" style="--d:${(.5 + i * .09).toFixed(2)}s"><text class="mono" x="${ex + 52}" y="${y}" font-size="15" text-anchor="end" fill="#6e4b3b">${i + 1}</text>` +
      (tsp ? `<text class="mono" y="${y}" font-size="18">${tsp}</text>` : '') + `</g>`;
    if (i === linhas.length - 1) codigo += `<rect class="pisca" x="${(cx + col * cw + 3).toFixed(1)}" y="${(y0 + i * lh - 16).toFixed(1)}" width="10" height="21" rx="1.5" fill="${C.laranja2}"/>`;
  });
  await arte('sobre', {
    w: W, h: H,
    titulo: 'Crachá do Gabriel Ribeiro, desenvolvedor web full stack de 22 anos, ao lado de um editor de código com o arquivo gabriel.ts: cargo, base em Ilhabela (SP), o que entrega, stack, lema e status.',
    css:
      `.linha{animation:linha .6s cubic-bezier(.2,.7,.2,1) var(--d) both}@keyframes linha{from{opacity:0;transform:translateX(-12px)}}` +
      `.cai{animation:cai 1.1s cubic-bezier(.2,.8,.3,1.15) .1s both}@keyframes cai{from{opacity:0;transform:translateY(-70px)}}` +
      `.balanca{transform-origin:250px -20px;animation:balanca 6s ease-in-out infinite}@keyframes balanca{0%,100%{transform:rotate(-2.4deg)}50%{transform:rotate(2.4deg)}}`,
    defs:
      `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="28"/></clipPath>` +
      `<clipPath id="foto"><rect x="126" y="156" width="248" height="310" rx="14"/></clipPath>` +
      `<linearGradient id="fita" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.laranja}"/><stop offset="1" stop-color="${C.laranja2}"/></linearGradient>` +
      `<filter id="sombra" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${C.brasa700}" flood-opacity=".22"/></filter>` +
      `<filter id="sombraJanela" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="${C.brasa950}" flood-opacity=".28"/></filter>` +
      `<radialGradient id="calor"><stop offset="0" stop-color="${C.laranja}" stop-opacity=".22"/><stop offset="1" stop-color="${C.laranja}" stop-opacity="0"/></radialGradient>` +
      pontos('pontos', C.tinta, .07),
    corpo:
      `<g clip-path="url(#cartao)"><rect width="${W}" height="${H}" fill="${C.painel}"/>` +
      `<rect x="760" y="0" width="440" height="${H}" fill="url(#pontos)"/>` +
      `<circle cx="1050" cy="520" r="360" fill="url(#calor)"/></g>` +
      `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="27.25" fill="none" stroke="#e7e1da" stroke-width="1.5"/>` +
      // crachá pendurado
      `<g class="cai"><g class="balanca">` +
      `<rect x="232" y="-20" width="36" height="122" fill="url(#fita)"/>` +
      `<path d="M236 -20V102M264 -20V102" stroke="#fff" stroke-opacity=".45" stroke-dasharray="4 4"/>` +
      `<rect x="237" y="96" width="26" height="16" rx="4" fill="#d3cdc6" stroke="#aaa39b"/>` +
      `<rect x="242" y="108" width="16" height="24" rx="8" fill="none" stroke="#b9b2aa" stroke-width="3"/>` +
      `<g filter="url(#sombra)"><rect x="110" y="124" width="280" height="412" rx="22" fill="#fff" stroke="#e8e2db"/></g>` +
      `<rect x="226" y="136" width="48" height="9" rx="4.5" fill="#ece6df"/>` +
      `<image href="${await imagem('foto-cracha.webp')}" x="126" y="156" width="248" height="310" clip-path="url(#foto)"/>` +
      `<text x="126" y="496" font-size="22" font-weight="600" letter-spacing="-.3" fill="${C.tinta}">Gabriel Ribeiro</text>` +
      `<text x="126" y="520" font-size="15" font-weight="500" fill="#6b6560">Full Stack · 22 anos</text>` +
      marca({ x: 326, y: 488, s: .9, traco: C.laranja, espessura: 4.4, cursor: C.laranja }) +
      `</g></g>` +
      // editor com gabriel.ts
      `<g class="sobe" style="--d:.25s"><g filter="url(#sombraJanela)"><rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="18" fill="#1c0d06"/></g>` +
      `<rect x="${ex + .75}" y="${ey + .75}" width="${ew - 1.5}" height="${eh - 1.5}" rx="17.25" fill="none" stroke="${C.brasa700}" stroke-opacity=".7" stroke-width="1.5"/>` +
      `<circle cx="${ex + 26}" cy="${ey + 26}" r="6.5" fill="#ff5f57"/><circle cx="${ex + 48}" cy="${ey + 26}" r="6.5" fill="#febc2e"/><circle cx="${ex + 70}" cy="${ey + 26}" r="6.5" fill="#28c840"/>` +
      `<rect x="${ex + 100}" y="${ey + 10}" width="152" height="34" rx="9" fill="#fff" fill-opacity=".06"/>` +
      `<rect x="${ex + 112}" y="${ey + 18}" width="18" height="18" rx="4" fill="#3178c6"/><text x="${ex + 121}" y="${ey + 31}" font-size="9.5" font-weight="700" text-anchor="middle" fill="#fff">TS</text>` +
      `<text class="mono" x="${ex + 140}" y="${ey + 32}" font-size="15" fill="${C.pessego100}">gabriel.ts</text>` +
      `<line x1="${ex}" y1="${ey + 54}" x2="${ex + ew}" y2="${ey + 54}" stroke="${C.brasa700}" stroke-opacity=".7"/>` +
      codigo + `</g>`,
  });
}

async function projetoGrande({ arq, num, titulo, tipo, desc, tags, dominio, img, altImg }) {
  const W = 1200, H = 600;
  const nb = notebook({ id: num, x: 612, y: 112, img: await imagem(img), altImg });
  const yDesc = 276, lhDesc = 30;
  const p = pilulas(tags, { x: 64, y: yDesc + (desc.length - 1) * lhDesc + 30, max: 470, cor: C.pessego100, fundo: 'rgba(255,255,255,.04)', borda: 'rgba(255,210,168,.28)' });
  const yBtn = p.fim + 28, wBtn = 190;
  const xNoAr = 64 + largura(`PROJETO ${num}`, 15, 600) + 3.2 * 10 + 18;
  await arte(arq, {
    w: W, h: H,
    titulo: `Projeto ${num}: ${titulo}, ${tipo.toLowerCase()}. ${desc.join(' ')} Tecnologias: ${tags.join(', ')}. No ar em ${dominio}.`,
    css: nb.css,
    defs:
      `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="28"/></clipPath>` +
      `<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#120804"/><stop offset="1" stop-color="#2a1107"/></linearGradient>` +
      `<radialGradient id="holofote"><stop offset="0" stop-color="${C.laranja}" stop-opacity=".38"/><stop offset="1" stop-color="${C.laranja}" stop-opacity="0"/></radialGradient>` +
      pontos('pontos', C.pessego, .07) + nb.defs,
    corpo:
      `<g clip-path="url(#cartao)"><rect width="${W}" height="${H}" fill="url(#fundo)"/><rect width="${W}" height="${H}" fill="url(#pontos)"/>` +
      `<circle cx="872" cy="280" r="470" fill="url(#holofote)"/>` +
      `<text x="1182" y="${H + 52}" font-size="330" font-weight="700" text-anchor="end" fill="none" stroke="${C.laranja2}" stroke-opacity=".13" stroke-width="2">${num}</text></g>` +
      `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="27.25" fill="none" stroke="${C.pessego}" stroke-opacity=".1" stroke-width="1.5"/>` +
      // texto
      `<g class="sobe" style="--d:.1s"><text x="64" y="118" font-size="15" font-weight="600" letter-spacing="3.2" fill="${C.laranja2}">PROJETO ${num}</text>` +
      `<rect x="${xNoAr.toFixed(0)}" y="99" width="78" height="26" rx="13" fill="${C.laranja2}" fill-opacity=".12"/>` +
      `<circle cx="${(xNoAr + 16).toFixed(0)}" cy="112" r="4" fill="${C.laranja2}"/><circle class="pulso" cx="${(xNoAr + 16).toFixed(0)}" cy="112" r="4" fill="${C.laranja2}"/>` +
      `<text x="${(xNoAr + 28).toFixed(0)}" y="117" font-size="14" font-weight="600" fill="${C.laranja2}">no ar</text></g>` +
      `<g class="sobe" style="--d:.2s"><text x="62" y="186" font-size="54" font-weight="600" letter-spacing="-1.4" fill="#fff">${esc(titulo)}</text>` +
      `<text x="64" y="226" font-size="24" font-weight="500" fill="${C.pessego}">${esc(tipo)}</text></g>` +
      `<g class="sobe" style="--d:.3s">${desc.map((l, i) => `<text x="64" y="${yDesc + i * lhDesc}" font-size="19" fill="${C.pessego100}" fill-opacity=".78">${esc(l)}</text>`).join('')}</g>` +
      `<g class="sobe" style="--d:.4s">${p.svg}</g>` +
      `<g class="sobe" style="--d:.5s"><rect x="64" y="${yBtn}" width="${wBtn}" height="52" rx="26" fill="${C.laranja2}"/>` +
      `<text x="92" y="${yBtn + 32}" font-size="18" font-weight="600" fill="${C.brasa950}">Ver projeto</text>` + seta(64 + wBtn - 44, yBtn + 20, 12, C.brasa950, 2.2) +
      `<text x="${64 + wBtn + 20}" y="${yBtn + 32}" font-size="17" font-weight="500" fill="${C.pessego}" fill-opacity=".6">${esc(dominio)}</text></g>` +
      // notebook
      `<g class="sobe" style="--d:.35s">${nb.corpo}</g>`,
  });
}

async function projetoPequeno({ arq, num, titulo, desc, tec, visual, css = '', defs = '', rotulo }) {
  const W = 600, H = 560;
  await arte(arq, {
    w: W, h: H, titulo: `Projeto ${num}: ${titulo}. ${desc.join(' ')} Tecnologias: ${tec}.`, css,
    defs:
      `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="26"/></clipPath>` +
      `<clipPath id="janela"><rect x="32" y="32" width="536" height="316" rx="14"/></clipPath>` +
      `<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#120804"/><stop offset="1" stop-color="#2a1107"/></linearGradient>` +
      `<radialGradient id="holofote"><stop offset="0" stop-color="${C.laranja}" stop-opacity=".3"/><stop offset="1" stop-color="${C.laranja}" stop-opacity="0"/></radialGradient>` +
      pontos('pontos', C.pessego, .07) + defs,
    corpo:
      `<g clip-path="url(#cartao)"><rect width="${W}" height="${H}" fill="url(#fundo)"/><rect width="${W}" height="${H}" fill="url(#pontos)"/>` +
      `<circle cx="300" cy="190" r="330" fill="url(#holofote)"/></g>` +
      `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="25.25" fill="none" stroke="${C.pessego}" stroke-opacity=".1" stroke-width="1.5"/>` +
      `<g class="sobe" style="--d:.1s"><g clip-path="url(#janela)"><rect x="32" y="32" width="536" height="316" fill="#0f0705"/>${visual}` +
      `<rect x="32" y="32" width="536" height="34" fill="#1d0e07"/></g>` +
      `<circle cx="54" cy="49" r="5" fill="#ff5f57"/><circle cx="71" cy="49" r="5" fill="#febc2e"/><circle cx="88" cy="49" r="5" fill="#28c840"/>` +
      `<rect x="150" y="39" width="300" height="20" rx="10" fill="#fff" fill-opacity=".07"/>` +
      `<text x="300" y="53.5" font-size="13" font-weight="500" text-anchor="middle" fill="${C.pessego}" fill-opacity=".75">${esc(rotulo)}</text>` +
      `<rect x="32.75" y="32.75" width="534.5" height="314.5" rx="13.25" fill="none" stroke="${C.pessego}" stroke-opacity=".14" stroke-width="1.5"/></g>` +
      `<g class="sobe" style="--d:.25s"><text x="34" y="394" font-size="15" font-weight="600" letter-spacing="3.2" fill="${C.laranja2}">PROJETO ${num}</text>` +
      `<text x="32" y="432" font-size="30" font-weight="600" letter-spacing="-.6" fill="#fff">${esc(titulo)}</text>` +
      desc.map((l, i) => `<text x="34" y="${466 + i * 25}" font-size="17.5" fill="${C.pessego100}" fill-opacity=".76">${esc(l)}</text>`).join('') +
      `<text x="34" y="532" font-size="15" font-weight="600" letter-spacing=".4" fill="${C.pessego}">${esc(tec)}</text></g>`,
  });
}

async function projetos() {
  await projetoGrande({
    arq: 'projeto-ph-sports', num: '01', titulo: 'PH Sports', tipo: 'Loja virtual', dominio: 'phsports.com.br',
    desc: ['Do catálogo ao pedido no WhatsApp em', 'poucos cliques. Loja de camisas de futebol', 'com busca, categorias, carrinho e envio', 'para todo o Brasil.'],
    tags: ['React', 'TanStack Start', 'Tailwind CSS', 'Supabase'],
    img: 'ph-sports.webp', altImg: 3929 * 520 / 560,
  });
  await projetoGrande({
    arq: 'projeto-maria-festinha', num: '02', titulo: 'Maria Festinha', tipo: 'Site institucional', dominio: 'maria-festinha.vercel.app',
    desc: ['Da visita ao orçamento em um clique. Site', 'de decoração de festas em Ilhabela (SP),', 'com serviços, galeria de festas e botão', 'direto para o WhatsApp.'],
    tags: ['HTML', 'CSS', 'JavaScript', 'GSAP', 'Lenis'],
    img: 'maria-festinha.webp', altImg: 4191 * 520 / 560,
  });
  await projetoPequeno({
    arq: 'projeto-portfolio', num: '03', titulo: 'Este portfólio', rotulo: 'portfolio-gabriel-b.vercel.app',
    desc: ['Hero animado com GSAP, crachá 3D em Three.js', 'e notebooks que mostram os sites rodando.'],
    tec: 'HTML · CSS · JavaScript · GSAP · Three.js · Lenis',
    css: `.zoom{transform-box:fill-box;transform-origin:center;animation:zoom 16s ease-in-out infinite alternate}@keyframes zoom{to{transform:scale(1.07)}}`,
    visual: `<image class="zoom" href="${await imagem('portfolio.webp')}" x="32" y="66" width="536" height="281.4"/>`,
  });
  // painel ilustrado (sem números inventados): menu, cartões, barras e a linha do gráfico se desenhando
  const alturas = [62, 96, 78, 120, 100, 138, 112, 154, 130];
  const barras = alturas.map((a, i) => {
    const x = 176 + i * 42, y = 330 - a;
    const p = alturas.length - 1 === i;
    return `<rect class="barra" style="--d:${(.4 + i * .07).toFixed(2)}s" x="${x}" y="${y}" width="24" height="${a}" rx="6" fill="${p ? C.laranja2 : C.pessego}" fill-opacity="${p ? .95 : .22}"/>`;
  }).join('');
  const pts = alturas.map((a, i) => [188 + i * 42, 330 - a - 22]);
  const linha = pts.reduce((d, [x, y], i) => d + (i ? ` S${x - 21} ${y} ${x} ${y}` : `M${x} ${y}`), '');
  const cartoes = [0, 1, 2].map((j) => {
    const x = 160 + j * 134;
    return `<rect x="${x}" y="80" width="122" height="66" rx="10" fill="#fff" fill-opacity=".04" stroke="${C.pessego}" stroke-opacity=".1"/>` +
      `<rect x="${x + 14}" y="94" width="${[46, 58, 40][j]}" height="7" rx="3.5" fill="${C.pessego}" fill-opacity=".3"/>` +
      `<rect class="cresce" style="--d:${(.3 + j * .1).toFixed(2)}s" x="${x + 14}" y="112" width="${[64, 52, 70][j]}" height="16" rx="8" fill="${j === 1 ? C.laranja2 : '#fff'}" fill-opacity="${j === 1 ? .9 : .82}"/>`;
  }).join('');
  const menu = [0, 1, 2, 3, 4, 5].map((k) => `<rect x="50" y="${126 + k * 30}" width="${[70, 62, 74, 56, 66, 60][k]}" height="10" rx="5" fill="${k === 1 ? C.laranja2 : C.pessego}" fill-opacity="${k === 1 ? .95 : .16}"/>`).join('');
  await projetoPequeno({
    arq: 'projeto-dashboard', num: '04', titulo: 'Dashboard de gestão', rotulo: 'Dashboard · clientes, funil e financeiro',
    desc: ['Clientes, funil de vendas, propostas, projetos', 'e financeiro num só painel, com login seguro.'],
    tec: 'React · TypeScript · Express · libSQL · Recharts',
    css:
      `.barra{transform-box:fill-box;transform-origin:50% 100%;animation:barra .9s cubic-bezier(.2,.8,.3,1.1) var(--d) both}@keyframes barra{from{transform:scaleY(0)}}` +
      `.cresce{transform-box:fill-box;transform-origin:0 50%;animation:cresce 1s cubic-bezier(.2,.8,.3,1) var(--d) both}@keyframes cresce{from{transform:scaleX(0)}}` +
      `.traco{stroke-dasharray:100;animation:traco 7s cubic-bezier(.6,0,.2,1) 1s infinite both}@keyframes traco{0%{stroke-dashoffset:100}35%,85%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}`,
    defs: gradMarca('gr'),
    visual:
      `<rect x="32" y="66" width="120" height="282" fill="#160a05"/>` +
      marca({ x: 48, y: 80, s: .62, traco: 'url(#gr)', espessura: 4.6 }) + menu + cartoes +
      `<rect x="160" y="160" width="398" height="178" rx="10" fill="#fff" fill-opacity=".03" stroke="${C.pessego}" stroke-opacity=".08"/>` +
      barras + `<path class="traco" pathLength="100" d="${linha}" fill="none" stroke="${C.laranja2}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="5" fill="${C.laranja2}"/><circle class="pulso" cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="5" fill="${C.laranja2}"/>`,
  });
}

async function stack() {
  const linhas = [
    ['Frontend', 'interfaces e lojas', ['react', 'typescript', 'javascript', 'html5', 'css', 'tailwindcss', 'tanstack', 'vite']],
    ['Backend e dados', 'APIs, login e banco', ['nodedotjs', 'express', 'supabase', 'postgresql', 'turso']],
    ['Animação e deploy', 'movimento, 3D e publicação', ['gsap', 'threedotjs', 'lenis', 'vercel', 'git', 'github']],
    ['IA e automação', 'agentes que aceleram', ['claude', 'codex', 'antigravity', 'maestri', 'lovable']],
  ];
  const W = 1200, H = 52 + linhas.length * 138 + 8;
  let corpo = '', n = 0;
  linhas.forEach(([nome, sub, lista], r) => {
    const y0 = 52 + r * 138;
    corpo += `<g class="sobe" style="--d:${(.1 + r * .12).toFixed(2)}s"><text x="56" y="${y0 + 40}" font-size="22" font-weight="600" letter-spacing="-.3" fill="${C.tinta}">${nome}</text>` +
      `<text x="56" y="${y0 + 66}" font-size="16" fill="#6b6560">${sub}</text></g>`;
    lista.forEach((slug, k) => {
      const x = 300 + k * 104, y = y0;
      corpo += `<g class="ladrilho" style="--d:${(.2 + n++ * .045).toFixed(2)}s"><rect x="${x}" y="${y}" width="80" height="80" rx="22" fill="${C.brasa950}"/>` +
        icone(slug, x + 22, y + 22, 36, C.pessego) +
        `<text x="${x + 40}" y="${y + 106}" font-size="15" font-weight="500" text-anchor="middle" fill="${C.cinza}">${esc(icones[slug].nome)}</text></g>`;
    });
    if (r < linhas.length - 1) corpo += `<line x1="56" y1="${y0 + 124}" x2="${W - 56}" y2="${y0 + 124}" stroke="${C.tinta}" stroke-opacity=".07"/>`;
  });
  await arte('stack', {
    w: W, h: H,
    titulo: 'Stack. Frontend: React, TypeScript, JavaScript, HTML, CSS, Tailwind CSS, TanStack e Vite. Backend e dados: Node.js, Express, Supabase, PostgreSQL e libSQL. Animação e deploy: GSAP, Three.js, Lenis, Vercel, Git e GitHub. IA e automação: Claude Code, Codex, Antigravity, Maestri e Lovable.',
    css: `.ladrilho{transform-box:fill-box;transform-origin:center;animation:ladrilho .7s cubic-bezier(.2,.8,.3,1.25) var(--d) both}@keyframes ladrilho{from{opacity:0;transform:scale(.6)}}`,
    defs: `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="28"/></clipPath>`,
    corpo:
      `<rect width="${W}" height="${H}" rx="28" fill="${C.painel}"/>` +
      `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="27.25" fill="none" stroke="#e7e1da" stroke-width="1.5"/>` + corpo,
  });
}

async function entrego() {
  const itens = [
    ['Design e', 'experiência', ['Interfaces modernas,', 'animações e experiências', 'interativas.']],
    ['Desenvolvimento', 'Full Stack', ['Front, back e banco de', 'dados ligados, com', 'funcionalidades reais.']],
    ['IA e', 'automações', ['Automações que poupam', 'horas e eliminam', 'tarefas repetitivas.']],
    ['Performance', 'e qualidade', ['Responsivo, acessível,', 'código organizado e', 'carregamento rápido.']],
    ['Pagamentos', 'online', ['Checkout com cartão,', 'pagamento seguro e', 'pedido na hora.']],
  ];
  const W = 1200, H = 384;
  let corpo = '';
  itens.forEach(([t1, t2, desc], i) => {
    const x = 72 + i * 218;
    corpo += `<circle cx="${x}" cy="86" r="8" fill="${C.brasa900}" stroke="${C.laranja2}" stroke-opacity=".5" stroke-width="2"/>` +
      `<circle class="acende" style="--d:${(i * .55).toFixed(2)}s" cx="${x}" cy="86" r="3.5" fill="${C.laranja2}"/>` +
      `<g class="sobe" style="--d:${(.15 + i * .12).toFixed(2)}s">` +
      `<text x="${x - 3}" y="172" font-size="66" font-weight="700" fill="none" stroke="${C.laranja2}" stroke-width="1.3">0${i + 1}</text>` +
      `<text x="${x}" y="218" font-size="22" font-weight="600" letter-spacing="-.3" fill="#fff">${t1}</text>` +
      `<text x="${x}" y="246" font-size="22" font-weight="600" letter-spacing="-.3" fill="#fff">${t2}</text>` +
      desc.map((l, k) => `<text x="${x}" y="${292 + k * 24}" font-size="16" fill="${C.pessego100}" fill-opacity=".72">${esc(l)}</text>`).join('') + `</g>`;
  });
  await arte('entrego', {
    w: W, h: H,
    titulo: 'O que eu entrego: 01 design e experiência; 02 desenvolvimento full stack; 03 IA e automações; 04 performance e qualidade; 05 pagamentos online.',
    css:
      `.corre{stroke-dasharray:12 100;animation:corre 5s cubic-bezier(.5,0,.5,1) infinite}@keyframes corre{from{stroke-dashoffset:12}to{stroke-dashoffset:-100}}` +
      `.acende{transform-box:fill-box;transform-origin:center;animation:acende 2.75s ease-in-out var(--d) infinite both}@keyframes acende{0%,100%{opacity:.25;transform:scale(.7)}30%{opacity:1;transform:scale(1.25)}}`,
    defs:
      `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="28"/></clipPath>` +
      `<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.brasa950}"/><stop offset="1" stop-color="#2a1107"/></linearGradient>` +
      `<linearGradient id="fioLuz" gradientUnits="userSpaceOnUse" x1="72" y1="0" x2="1128" y2="0"><stop offset="0" stop-color="${C.pessego}"/><stop offset="1" stop-color="${C.laranja2}"/></linearGradient>` +
      `<filter id="brilhoFio" x="-5%" y="-400%" width="110%" height="900%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
      pontos('pontos', C.pessego, .06),
    corpo:
      `<g clip-path="url(#cartao)"><rect width="${W}" height="${H}" fill="url(#fundo)"/><rect width="${W}" height="${H}" fill="url(#pontos)"/></g>` +
      `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="27.25" fill="none" stroke="${C.pessego}" stroke-opacity=".1" stroke-width="1.5"/>` +
      `<line x1="72" y1="86" x2="1128" y2="86" stroke="${C.pessego}" stroke-opacity=".16" stroke-width="2"/>` +
      `<line class="corre" pathLength="100" x1="72" y1="86" x2="1128" y2="86" stroke="url(#fioLuz)" stroke-width="3" stroke-linecap="round" filter="url(#brilhoFio)"/>` +
      corpo,
  });
}

async function chamada() {
  const W = 1200, H = 360;
  const status = 'Disponível para novos projetos';
  await arte('chamada', {
    w: W, h: H,
    titulo: 'Tem uma ideia em mente? Vamos transformá-la em uma solução digital. Quero meu site: fale comigo no WhatsApp. Bônus em todo site: Google Meu Negócio configurado e 2 ajustes grátis.',
    css:
      `.gira{transform-origin:1000px 184px;animation:gira 50s linear infinite}@keyframes gira{to{transform:rotate(360deg)}}` +
      `.respira{animation:respira 5s ease-in-out infinite alternate}@keyframes respira{from{opacity:.55}to{opacity:1}}`,
    defs:
      `<clipPath id="cartao"><rect width="${W}" height="${H}" rx="28"/></clipPath>` +
      `<radialGradient id="canto" cx="0" cy="0" r="1.1"><stop offset="0" stop-color="#1f0902"/><stop offset=".35" stop-color="#1f0902" stop-opacity=".75"/><stop offset="1" stop-color="#1f0902" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="luzCanto" cx="1" cy="1" r=".7"><stop offset="0" stop-color="${C.pessego}" stop-opacity=".55"/><stop offset="1" stop-color="${C.pessego}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="laranja" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.laranja}"/><stop offset="1" stop-color="${C.laranja2}"/></linearGradient>`,
    corpo:
      `<g clip-path="url(#cartao)"><rect width="${W}" height="${H}" fill="url(#laranja)"/>` +
      `<rect width="${W}" height="${H}" fill="url(#canto)"/><rect width="${W}" height="${H}" fill="url(#luzCanto)"/>` +
      `<g class="gira"><circle cx="1000" cy="184" r="150" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-dasharray="2 13" stroke-linecap="round"/></g>` +
      `<circle cx="1000" cy="184" r="214" fill="none" stroke="#fff" stroke-opacity=".14"/>` +
      `<g class="respira">${marca({ x: 870, y: 90, s: 5.6, traco: '#fff', espessura: .55, cursor: '#fff', opacidade: .5 })}</g></g>` +
      `<g class="sobe" style="--d:.1s"><text x="64" y="82" font-size="15" font-weight="600" letter-spacing="3.4" fill="#fff" fill-opacity=".72">VAMOS CONVERSAR</text>` +
      `<text x="62" y="148" font-size="54" font-weight="600" letter-spacing="-1.5" fill="#fff">Tem uma ideia em mente?</text>` +
      `<text x="64" y="194" font-size="25" font-weight="500" fill="${C.pessego50}" fill-opacity=".92">Vamos transformá-la em uma solução digital.</text></g>` +
      `<g class="sobe" style="--d:.3s"><rect x="64" y="226" width="234" height="58" rx="29" fill="#fff"/>` +
      `<text x="94" y="262" font-size="19" font-weight="600" fill="${C.brasa950}">Quero meu site</text>` + seta(256, 249, 12, C.laranja, 2.4) +
      `<circle cx="336" cy="255" r="5" fill="#fff"/><circle class="pulso" cx="336" cy="255" r="5" fill="#fff"/>` +
      `<text x="352" y="261" font-size="18" font-weight="500" fill="#fff">${status}</text></g>` +
      `<g class="surge" style="--d:.6s"><text x="64" y="326" font-size="16" font-weight="500" fill="#fff" fill-opacity=".86">Bônus em todo site: Google Meu Negócio configurado + 2 ajustes grátis.</text></g>`,
  });
}

await mkdir(path.join(RAIZ, 'assets'), { recursive: true });
await cabecalho();
await botoes();
await titulos();
await sobre();
await projetos();
await stack();
await entrego();
await chamada();
