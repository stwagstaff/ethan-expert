
import subprocess, json

result = subprocess.run(
    ['git', 'show', '867644a:index.html'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    cwd='C:/Users/swags/Documents/ethan_expert'
)
# This commit doesn't have knowledge_base separately — go back to the full prompt split
# Use the payload we know works: extract from old full prompt
result2 = subprocess.run(
    ['git', 'show', 'e2a7d82:index.html'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    cwd='C:/Users/swags/Documents/ethan_expert'
)
c = result2.stdout

kb_marker    = "═══════════════════════════════════════════════\nVERIFIED KNOWLEDGE BASE"
rules_marker = "═══════════════════════════════════════════════\nRULES"

kb_pos    = c.find(kb_marker)
rules_pos = c.find(rules_marker)

knowledge = c[kb_pos:rules_pos].rstrip()
print(f"Knowledge base: {len(knowledge)} chars")
print("Starts with:", knowledge[:80])

json.dump({"knowledge_base": knowledge},
    open("C:/Users/swags/Documents/ethan_expert/kb_restore.json", "w", encoding="utf-8"),
    ensure_ascii=False)
print("Written.")
