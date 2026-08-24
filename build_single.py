# -*- coding: utf-8 -*-
"""把多文件版本打包成单个自包含 HTML：CSS/JS 内联，背景音乐转 base64 内嵌。"""
import base64
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

html = read('index.html')
css = read('css/style.css')
djs = read('js/data.js')
cjs = read('js/core.js')
ujs = read('js/ui.js')

with open(os.path.join(ROOT, 'bgm.wav'), 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')
audio_src = 'data:audio/wav;base64,' + b64

# 1) CSS 内联
old_css = '<link rel="stylesheet" href="css/style.css?v=25">'
assert old_css in html, '未找到 CSS 链接'
html = html.replace(old_css, '<style>\n' + css + '\n</style>')

# 2) 音频内联
old_audio = '<audio id="bgm" src="bgm.wav" loop preload="none"></audio>'
assert old_audio in html, '未找到 audio 标签'
html = html.replace(old_audio, '<audio id="bgm" src="%s" loop preload="auto"></audio>' % audio_src)

# 3) JS 内联
for tag in ['<script src="js/data.js?v=25"></script>',
            '<script src="js/core.js?v=25"></script>',
            '<script src="js/ui.js?v=25"></script>']:
    assert tag in html, '未找到脚本: ' + tag
    html = html.replace(tag, '')
js = djs + '\n' + cjs + '\n' + ujs
assert '</script' not in js, 'JS 中含 </script> 需处理'
# 必须在 body 内容之后执行，放到 </body> 前
html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')

out = os.path.join(ROOT, '菜鸡修仙传.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print('已生成:', out, '  %.2f MB' % (os.path.getsize(out) / 1e6))
