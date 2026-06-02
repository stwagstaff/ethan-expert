
import subprocess, json

r = subprocess.run(
    ["curl", "-s", "https://ethan-expert-proxy.threedwag.workers.dev/config"],
    capture_output=True, text=True
)
prompt = json.loads(r.stdout).get("config", {}).get("system_prompt", "")

kb_marker = "═══════════════════════════════════════════════\nVERIFIED KNOWLEDGE BASE"
rules_marker = "═══════════════════════════════════════════════\nRULES"

kb_pos    = prompt.find(kb_marker)
rules_pos = prompt.find(rules_marker)

# Behavior prompt = intro character section + USER MODES + RULES
behavior  = prompt[:kb_pos].rstrip() + "\n\n" + prompt[rules_pos:].rstrip()
knowledge = prompt[kb_pos:rules_pos].rstrip()

print(f"Behavior: {len(behavior)} chars")
print(f"Knowledge: {len(knowledge)} chars")

# Save both to JSON files for curl upload
json.dump({"system_prompt": behavior},    open("C:/Users/swags/Documents/ethan_expert/behavior_payload.json",  "w", encoding="utf-8"), ensure_ascii=False)
json.dump({"knowledge_base": knowledge}, open("C:/Users/swags/Documents/ethan_expert/knowledge_payload.json", "w", encoding="utf-8"), ensure_ascii=False)
print("Payloads written")
