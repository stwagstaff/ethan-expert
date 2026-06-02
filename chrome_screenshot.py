import subprocess
import os
import sys
import shutil
import time

OUTPUT = r"C:\Users\swags\Documents\ethan_expert\site_screenshot.png"
URL = "https://ethan-expert.pages.dev/"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

# Chrome headless --screenshot saves to a file named 'screenshot.png' in the current dir
# unless you specify a path. Let's use a temp dir.
import tempfile
tmpdir = tempfile.mkdtemp()
screenshot_tmp = os.path.join(tmpdir, "screenshot.png")

print(f"Running Chrome headless screenshot...")
print(f"Output target: {OUTPUT}")

cmd = [
    CHROME,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    f"--screenshot={screenshot_tmp}",
    "--window-size=1280,900",
    "--hide-scrollbars",
    "--virtual-time-budget=5000",
    URL
]

try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    print(f"Chrome stdout: {result.stdout[:500]}")
    print(f"Chrome stderr: {result.stderr[:500]}")
    print(f"Return code: {result.returncode}")
    
    # Check if screenshot was created at the specified path
    if os.path.exists(screenshot_tmp):
        shutil.copy2(screenshot_tmp, OUTPUT)
        print(f"SUCCESS: Screenshot saved to {OUTPUT}")
        size = os.path.getsize(OUTPUT)
        print(f"File size: {size} bytes")
    elif os.path.exists(OUTPUT):
        print(f"SUCCESS: Screenshot already at {OUTPUT}")
        size = os.path.getsize(OUTPUT)
        print(f"File size: {size} bytes")
    else:
        # Chrome may have saved to current directory
        cwd_screenshot = os.path.join(os.getcwd(), "screenshot.png")
        if os.path.exists(cwd_screenshot):
            shutil.copy2(cwd_screenshot, OUTPUT)
            print(f"SUCCESS (from cwd): Screenshot saved to {OUTPUT}")
        else:
            print(f"Screenshot not found at {screenshot_tmp} or {cwd_screenshot}")
            print(f"Listing tmpdir: {os.listdir(tmpdir)}")
            sys.exit(1)
except subprocess.TimeoutExpired:
    print("Chrome timed out")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
finally:
    # Cleanup
    try:
        shutil.rmtree(tmpdir)
    except:
        pass
