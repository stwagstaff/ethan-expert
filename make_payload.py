
import json

with open('C:/Users/swags/Documents/ethan_expert/full_system_prompt.txt', encoding='utf-8') as f:
    prompt = f.read()

payload = {"system_prompt": prompt}
with open('C:/Users/swags/Documents/ethan_expert/prompt_payload.json', 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False)

print(f"Written payload: {len(json.dumps(payload))} bytes")
