# As Minas Esquecidas

Terror em primeira pessoa feito só de texto ASCII, pensado para jogar no celular deitado (horizontal).
Poucas balas, uma lanterna e uma fortaleza anã que não termina. Quatro fases desenhadas à mão e um chefe.

## Jogar

Abra `index.html` no navegador (celular ou computador). Para ter um link, ative o GitHub Pages
(Settings > Pages > Deploy from a branch > `main` / root).

## Controles

- **Celular:** esquerda arrasta para andar (bem longe = correr); direita arrasta para olhar; botões ATIRAR, CORRER, RECAR.
- **Teclado:** WASD andar, setas/Q/E girar, Espaço atirar, Shift correr, R recarregar, Esc pausa.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `levels.js` | mapas, notas e configuração das fases |
| `core.js` | estado, colisão, inimigos, luz |
| `render.js`, `art.js` | raycaster ASCII, paleta, sprites |
| `logic.js` | jogador, combate, IA, fim de fase |
| `audio.js` | sons sintetizados (WebAudio) |
| `input.js`, `main.js`, `shell.html` | controles, interface, página |

## Desenvolvimento

```
python3 build.py        # gera index.html (arquivo único) a partir das partes
node tests/test_levels.js   # valida mapas e se tudo é alcançável
node tests/test_sim.js      # robô joga as 4 fases até o fim
```
