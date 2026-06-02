#!/usr/bin/env python3
"""
Screenshot utility - tries multiple backends
"""
import os
import sys

OUTPUT = r"C:\Users\swags\Documents\ethan_expert\site_screenshot.png"
URL = "https://ethan-expert.pages.dev/"

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

def try_playwright():
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(URL, wait_until="networkidle", timeout=30000)
            page.screenshot(path=OUTPUT, full_page=True)
            browser.close()
        return True, OUTPUT
    except Exception as e:
        return False, str(e)

def try_selenium():
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        import time
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1280,900")
        driver = webdriver.Chrome(options=options)
        driver.set_window_size(1280, 900)
        driver.get(URL)
        time.sleep(4)
        driver.save_screenshot(OUTPUT)
        driver.quit()
        return True, OUTPUT
    except Exception as e:
        return False, str(e)

for name, fn in [("Playwright", try_playwright), ("Selenium", try_selenium)]:
    print(f"Trying {name}...")
    ok, result = fn()
    if ok:
        print(f"SUCCESS with {name}: {result}")
        sys.exit(0)
    else:
        print(f"{name} failed: {result}")

print("All methods failed")
sys.exit(1)
