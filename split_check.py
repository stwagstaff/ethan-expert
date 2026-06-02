
import json

with open("C:/Users/swags/Documents/ethan_expert/full_prompt_backup.txt", "w", encoding="utf-8") as f:
    pass  # will write below

import subprocess, json as j

r = subprocess.run(
    ["curl", "-s", "https://ethan-expert-proxy.threedwag.workers.dev/config"],
    capture_output=True, text=True
)
config = j.loads(r.stdout).get("config", {})
prompt = config.get("system_prompt", "")

# Find the split point
kb_marker = "═══════════════════════════════════════════════\nVERIFIED KNOWLEDGE BASE"
rules_marker = "═══════════════════════════════════════════════\nRULES"
user_modes = "USER MODES"

kb_pos = prompt.find(kb_marker)
rules_pos = prompt.find(rules_marker)
user_modes_pos = prompt.find(user_modes)

print(f"Total: {len(prompt)} chars")
print(f"VERIFIED KNOWLEDGE BASE at: {kb_pos}")
print(f"RULES at: {rules_pos}")
print(f"USER MODES at: {user_modes_pos}")

# Behavior = everything BEFORE the knowledge base
# Knowledge = everything FROM the knowledge base marker onward (minus the rules at the end)
behavior = prompt[:kb_pos].rstrip()
knowledge = prompt[kb_pos:rules_pos].rstrip() if rules_pos > 0 else prompt[kb_pos:]
# Rules/modes are behavior too — keep at end of behavior
tail = prompt[rules_pos:] if rules_pos > 0 else ""

print(f"\nBehavior section: {len(behavior)} chars")
print(f"Knowledge section: {len(knowledge)} chars")
print(f"Rules/tail section: {len(tail)} chars")
print("\n--- Behavior ends with ---")
print(behavior[-200:])
print("\n--- Knowledge starts with ---")
print(knowledge[:200])
print("\n--- Tail starts with ---")
print(tail[:200])
