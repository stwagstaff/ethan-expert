
import subprocess, sys

# Extract old index.html from git
result = subprocess.run(
    ['git', 'show', 'e2a7d82:index.html'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    cwd='C:/Users/swags/Documents/ethan_expert'
)
c = result.stdout

marker = 'const SYSTEM_PROMPT = `'
s = c.find(marker) + len(marker)
e = c.find('`;', s)
prompt = c[s:e]
print(f"Prompt length: {len(prompt)}")
print("First 200:", prompt[:200])

with open('C:/Users/swags/Documents/ethan_expert/full_system_prompt.txt', 'w', encoding='utf-8') as out:
    out.write(prompt)
print("Written!")
