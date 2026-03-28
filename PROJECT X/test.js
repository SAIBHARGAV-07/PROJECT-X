const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    const fileUrl = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
    console.log("Loading", fileUrl);
    await page.goto(fileUrl);
    
    // Simulate Mobile
    await page.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true });
    
    // Wait for load
    await page.waitForTimeout(500);
    
    // Start Game
    await page.click('#btnPlay');
    await page.waitForTimeout(500);
    
    console.log("Pressing shoot button");
    await page.evaluate(() => {
      const btn = document.getElementById('btnShoot');
      if(btn) {
        console.log("btnShoot visibility:", window.getComputedStyle(btn).display);
        const rect = btn.getBoundingClientRect();
        console.log("Rect:", rect.x, rect.y, rect.width, rect.height);
        
        // Dispatch touch event manually since page.touchscreen might be tricky
        btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
      } else {
        console.log("btnShoot not found!");
      }
    });
    
    await page.waitForTimeout(500);
    
    const shots = await page.evaluate(() => bullets.length);
    console.log("Bullets count after pressing shoot:", shots);
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();
