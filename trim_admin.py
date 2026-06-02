import sys

lines = open('C:/Users/swags/Documents/ethan_expert/index.html', encoding='utf-8').readlines()
print(f'Input: {len(lines)} lines', file=sys.stderr)

def find(text, start=0):
    for i in range(start, len(lines)):
        if text in lines[i]:
            return i
    return -1

# 1. Second <style> block (admin CSS)
first_style_end   = find('</style>')
admin_style_start = find('<style>', first_style_end + 1)
admin_style_end   = find('</style>', admin_style_start + 1)

# 2. Admin JS: from the === comment before "ADMIN" section through line before "// Start"
admin_comment = find('// ADMIN')
js_block_start = find('// ══', admin_comment - 2) if admin_comment > 2 else admin_comment
start_init     = find('// Start', admin_comment)

# 3. Admin HTML overlay
html_start = find('<!-- ADMIN OVERLAY -->')
body_close = find('</body>', html_start)

print(f'CSS block:  lines {admin_style_start+1}–{admin_style_end+1}', file=sys.stderr)
print(f'JS block:   lines {js_block_start+1}–{start_init} (start_init={start_init+1} kept)', file=sys.stderr)
print(f'HTML block: lines {html_start+1}–{body_close} (body_close={body_close+1} kept)', file=sys.stderr)

# Sanity checks
assert admin_style_start > 0 and admin_style_end > admin_style_start
assert js_block_start > 0 and start_init > js_block_start
assert html_start > 0 and body_close > html_start

# Build output skipping the three dead ranges
skip = set(
    list(range(admin_style_start, admin_style_end + 1)) +
    list(range(js_block_start, start_init)) +
    list(range(html_start, body_close))
)

result = [lines[i] for i in range(len(lines)) if i not in skip]
open('C:/Users/swags/Documents/ethan_expert/index.html', 'w', encoding='utf-8').writelines(result)
print(f'Output: {len(result)} lines', file=sys.stderr)
