#!/usr/bin/env node
/**
 * Screenshot using puppeteer with the system Chrome installation
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const outputPath = 'C:\\Users\\swags\\Documents\\ethan_expert\\site_screenshot.png';
const url = 'https://ethan-expert.pages.dev/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Make sure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Try using puppeteer with the system Chrome
try {
  const puppeteer = require('puppeteer');
  (async () => {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: outputPath, fullPage: true });
    await browser.close();
    console.log('SUCCESS: ' + outputPath);
    process.exit(0);
  })().catch(e => {
    console.error('Puppeteer error:', e.message);
    process.exit(1);
  });
} catch(e) {
  console.error('Cannot load puppeteer:', e.message);
  process.exit(1);
}
