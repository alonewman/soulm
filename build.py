import os
d = os.path.dirname(os.path.abspath(__file__))
parts = ['levels.js', 'core.js', 'audio.js', 'art.js', 'render.js', 'logic.js', 'input.js', 'main.js']
js = '\n'.join(open(os.path.join(d, p), encoding='utf-8').read() for p in parts)
open(os.path.join(d, 'game.js'), 'w', encoding='utf-8').write(js)
shell = open(os.path.join(d, 'shell.html'), encoding='utf-8').read()
assert '/*SCRIPT*/' in shell
assert '</script>' not in js
out = shell.replace('/*SCRIPT*/', js)
open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out), 'bytes')
