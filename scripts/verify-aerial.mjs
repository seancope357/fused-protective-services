// Run against python3 serve.py. Uses an external Playwright install, no root deps.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/cope/.hermes/hermes-agent/node_modules/playwright/index.mjs');
import { mkdir, writeFile, stat } from 'node:fs/promises';
const BASE=process.env.AERIAL_PREVIEW_URL || 'http://127.0.0.1:5050';
const PAGE=process.env.AERIAL_PAGE_PATH || '/aerial.html';
const OUT=process.env.AERIAL_QA_DIR || 'output/playwright/aerial-refinement';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch();
const results={checks:[],errors:[],network:[],renders:[],limitations:['Real phone/GPU performance not measured','Visual acceptance remains a human judgment']};
const check=(name,ok,details={})=>{results.checks.push({name,pass:Boolean(ok),...details});if(!ok)console.error('FAIL',name,details);};
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.on('pageerror',e=>results.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
page.on('requestfailed',r=>results.network.push({url:r.url(),failure:r.failure()}));
async function ready(p){await p.waitForFunction(()=>window.__aerial?.ready,{timeout:60000});}
async function pixels(){return page.evaluate(()=>{
    const qa=window.__aerial;qa.render();const gl=qa.context,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,b=new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);
    const sample=[];let lit=0;for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=12){const i=(y*w+x)*4;sample.push(b[i],b[i+1],b[i+2]);if(Math.max(b[i],b[i+1],b[i+2])>25)lit++;}
    return {sample,litRatio:lit/(sample.length/3)};
});}
const diff=(a,b)=>a.sample.reduce((sum,v,i)=>sum+Math.abs(v-b.sample[i]),0)/a.sample.length;
try {
    await page.goto(BASE+PAGE+'?verify=1',{waitUntil:'networkidle'});await ready(page);
    check('real WebGL and aircraft loaded',await page.evaluate(()=>!window.__aerial.context.isContextLost()&&window.__aerial.stats().modelLoaded));
    check('MSAA enabled',await page.evaluate(()=>window.__aerial.context.getContextAttributes().antialias));
    check('Day is selected by default',await page.locator('[data-action=day]').getAttribute('aria-pressed')==='true');
    check('only Day and Night viewing controls',await page.locator('.aerial-toolbar button').count()===2 && await page.locator('[data-action=sensor],[data-action=pause],[data-action=inspect]').count()===0);
    console.log('Checking Day/Night renders');
    for(const mode of ['day','night']) {
        await page.locator(`[data-action=${mode}]`).focus();await page.keyboard.press('Enter');
        check(`${mode}: keyboard selection and pressed state`,await page.locator(`[data-action=${mode}]`).getAttribute('aria-pressed')==='true');
        for(const u of [0,.33,.66,1]) {
            await page.evaluate(u=>{const t=document.getElementById('aerial-track');scrollTo({top:t.offsetTop+u*(t.offsetHeight-innerHeight),behavior:'instant'});window.__aerial.setProgress(u);},u);
            const stats=await page.evaluate(()=>window.__aerial.stats()),px=await pixels();results.renders.push({u,...stats});
            check(`${mode}/${u}: rendered property stays visible`,px.litRatio>.1,{litRatio:px.litRatio});
            check(`${mode}/${u}: selection survives scroll`,stats.timeOfDay===mode);
            await page.screenshot({path:`${OUT}/${mode}-chapter-${u}.png`});
        }
    }
    await page.evaluate(()=>{window.__aerial.setProgress(.33);window.__aerial.setTimeOfDay('day');});
    const day=await pixels(),before=await page.evaluate(()=>window.__aerial.stats().camera);
    await page.locator('[data-action=night]').focus();await page.keyboard.press('Enter');
    const night=await pixels(),after=await page.evaluate(()=>window.__aerial.stats().camera);
    check('Day/Night visibly changes rendered pixels',diff(day,night)>5,{meanChannelDelta:diff(day,night)});
    check('lighting selection preserves camera composition',JSON.stringify(before)===JSON.stringify(after));
    await page.locator('[data-action=day]').focus();await page.keyboard.press('Enter');
    check('return to Day restores illumination',diff(day,await pixels())<1);
    check('scene has no sensor overlay in any chapter',await page.evaluate(()=>window.__aerial.stats().effectiveSensor===undefined));
    const maxCalls=Math.max(...results.renders.map(r=>r.calls));check('main-pass draw calls <=35',maxCalls<=35,{maxCalls});
    const maxTriangles=Math.max(...results.renders.map(r=>r.triangles));check('rendered triangles <=350k',maxTriangles<=350000,{maxTriangles});
    for(const width of [320,375,414,768,1440]) {
        await page.setViewportSize({width,height:900});
        const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.aerial-toolbar button')].map(e=>{const r=e.getBoundingClientRect();return {h:r.height,w:r.width,x:r.x,right:r.right};})}));
        check(`${width}px: no overflow and 44px controls`,sizes.scroll<=width&&sizes.controls.every(r=>r.h>=44&&r.w>=44&&r.x>=0&&r.right<=width));
    }
    console.log('Checking phone rendering and native scroll');
    const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    await phone.goto(BASE+PAGE+'?verify=1');await ready(phone);
    const phoneStats=await phone.evaluate(()=>window.__aerial.stats());
    check('phone retains higher-resolution detail with a bounded DPR',phoneStats.pixelRatio===1.75&&phoneStats.shadowMapSize===2048);
    for(const mode of ['day','night']) {
        await phone.locator(`[data-action=${mode}]`).tap();
        await phone.evaluate(()=>{const t=document.getElementById('aerial-track');scrollTo({top:.45*(t.offsetHeight-innerHeight),behavior:'instant'});window.__aerial.setProgress(.45);});
        check(`phone ${mode}: touch selects and scroll stays native`,await phone.evaluate(mode=>scrollY>0&&window.__aerial.stats().timeOfDay===mode,mode));
        await phone.screenshot({path:`${OUT}/phone-${mode}.png`});
    }
    await phone.close();
    await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>window.__aerial.setProgress(0));const reducedA=await page.evaluate(()=>window.__aerial.stats().camera);
    await page.evaluate(()=>window.__aerial.setProgress(1));const reducedB=await page.evaluate(()=>window.__aerial.stats().camera);
    check('reduced motion fixes camera',JSON.stringify(reducedA)===JSON.stringify(reducedB));
    for(const mode of ['day','night']) {
        await page.locator(`[data-action=${mode}]`).click();const a=await pixels();
        await page.waitForTimeout(250);const b=await pixels();
        check(`reduced ${mode}: no autonomous movement`,diff(a,b)<.01,{delta:diff(a,b)});
        check(`reduced ${mode}: lighting still selectable`,await page.evaluate(mode=>window.__aerial.stats().timeOfDay===mode,mode));
    }
    await page.emulateMedia({reducedMotion:'no-preference'});
    const positions=[];
    for(const bottom of [false,true,false]) {
        // scrollTo returns before the native scroll event reaches the controller.
        // Await that event so a settled camera from the previous endpoint cannot pass.
        await page.evaluate(bottom=>new Promise(resolve=>{
            const top=bottom?document.documentElement.scrollHeight-innerHeight:0;
            if(Math.abs(scrollY-top)<1){resolve();return;}
            window.addEventListener('scroll',resolve,{once:true});
            scrollTo({top,behavior:'instant'});
        }),bottom);
        await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});
        positions.push(await page.evaluate(()=>window.__aerial.stats().camera.position));
    }
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    check('native scroll forward/reverse',distance(positions[0],positions[1])>1&&distance(positions[0],positions[2])<.1,{positions});
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/aerial/')).map(r=>({name:r.name,bytes:r.encodedBodySize})));
    results.deferredAssetBytes=resources.reduce((s,r)=>s+r.bytes,0);
    check('deferred assets remain <=8MB',results.deferredAssetBytes<=8e6,{bytes:results.deferredAssetBytes});
    const sizes={};for(const name of ['aircraft.glb','blue-hour.hdr'])sizes[BASE+'/assets/aerial/'+name]=(await stat('assets/aerial/'+name)).size;
    const unresolved=results.network.filter(item=>!(item.failure?.errorText==='net::ERR_ABORTED'&&sizes[item.url]&&resources.some(r=>r.name===item.url&&r.bytes===sizes[item.url])));
    check('no partial/missing normal assets',unresolved.length===0,{unresolved});
    check('HDR actually decoded',await page.evaluate(()=>window.__aerial.stats().lighting==='hdr'));
    check('normal-load console and shaders clean',results.errors.length===0,{errors:results.errors});
    console.log('Checking graphics/asset fallback and Retry');
    const plain=await browser.newPage();await plain.goto(BASE+PAGE);check('no QA globals on normal URL',await plain.evaluate(()=>!('__aerial' in window)));await plain.close();
    const fallback=await browser.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});
    await fallback.goto(BASE+PAGE);await fallback.waitForFunction(()=>document.documentElement.dataset.aerialState==='fallback');
    await fallback.locator('[data-action=night]').click();
    check('no-WebGL fallback retains content, theme choice and retry',await fallback.locator('h1').isVisible()&&await fallback.locator('[data-action=retry]').isVisible()&&await fallback.locator('[data-action=night]').getAttribute('aria-pressed')==='true');await fallback.close();
    const failed=await browser.newPage();await failed.route('**/assets/aerial/aircraft.glb',r=>r.abort());await failed.goto(BASE+PAGE+'?verify=1');
    await failed.waitForFunction(()=>document.documentElement.dataset.aerialState==='error');
    check('required asset failure remains honest',(await failed.locator('#aerial-status').textContent()).includes('could not load'));
    await failed.locator('[data-action=night]').click();await failed.unroute('**/assets/aerial/aircraft.glb');await failed.locator('[data-action=retry]').click();await ready(failed);
    check('asset retry recovers and preserves Night selection',await failed.evaluate(()=>window.__aerial.stats().modelLoaded&&window.__aerial.stats().timeOfDay==='night'));await failed.close();
    const hdrFallback=await browser.newPage();await hdrFallback.route('**/assets/aerial/blue-hour.hdr',r=>r.abort());await hdrFallback.goto(BASE+PAGE+'?verify=1');await ready(hdrFallback);
    check('optional HDR failure keeps useful studio lighting',await hdrFallback.evaluate(()=>window.__aerial.stats().lighting==='studio-fallback'));await hdrFallback.close();
    await page.evaluate(()=>window.__aerial.context.getExtension('WEBGL_lose_context').loseContext());await page.waitForFunction(()=>document.documentElement.dataset.aerialState==='error');
    check('context loss offers retry',await page.locator('[data-action=retry]').isVisible());await page.locator('[data-action=retry]').click();await ready(page);
    check('context-loss retry creates working context',await page.evaluate(()=>!window.__aerial.context.isContextLost()&&window.__aerial.stats().modelLoaded));
    results.pass=results.checks.every(c=>c.pass);await writeFile(OUT+'/verification.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify({pass:results.pass,checks:results.checks.length,failed:results.checks.filter(c=>!c.pass),maxCalls,maxTriangles,deferredAssetBytes:results.deferredAssetBytes},null,2));
    process.exitCode=results.pass?0:1;
} finally { await browser.close(); }
