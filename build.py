#!/usr/bin/env python3
"""Bundle index.html + style.css + scripts + images/*.jpg into one self-contained animal-logic.html."""
import base64, glob, os, re

os.chdir(os.path.dirname(os.path.abspath(__file__)))
read = lambda p: open(p, encoding='utf-8').read()

html = read('index.html')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + read('style.css') + '</style>')

images = {os.path.basename(p)[:-4]: 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
          for p in sorted(glob.glob('images/*.jpg'))}
# One statement per line: some hosts 500 on a single multi-megabyte line.
img_js = 'const IMAGES = {};\n' + ''.join('IMAGES["%s"] = "%s";\n' % kv for kv in images.items())

game = read('game.js')
old = 'src="images/${a.id}.jpg"'
assert old in game
game = game.replace(old, 'src="${IMAGES[a.id] || \'\'}"')

def inline(m):
    name = m.group(1)
    code = game if name == 'game.js' else read(name)
    if name == 'game.js':
        code = img_js + code
    return '<script>\n' + code + '\n</script>'

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
open('animal-logic.html', 'w', encoding='utf-8').write(html)
print('animal-logic.html', round(len(html) / 1e6, 2), 'MB')
