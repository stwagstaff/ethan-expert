
import json, urllib.request

with open('C:/Users/swags/Documents/ethan_expert/full_system_prompt.txt', encoding='utf-8') as f:
    prompt = f.read()

print(f"Prompt length: {len(prompt)} chars")

payload = json.dumps({"system_prompt": prompt}).encode('utf-8')

req = urllib.request.Request(
    'https://ethan-expert-proxy.threedwag.workers.dev/admin',
    data=payload,
    headers={
        'Content-Type': 'application/json',
        'Admin-Password': 'jeepers'
    },
    method='POST'
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print("Save result:", result)
