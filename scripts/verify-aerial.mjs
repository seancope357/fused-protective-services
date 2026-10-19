const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/cope/.hermes/hermes-agent/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir,writeFile,stat} from 'node:fs/promises';
const BASE=process.env.AERIAL_PREVIEW_URL || 'http://127.0.0.1:5050';
const PAGE=process.env.AERIAL_PAGE_PATH || '/aerial.html';
const OUT=process.env.AERIAL_QA_DIR || '/Users/cope/.hermes/cache/scratch/fused-aerial-qa';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const results={checks:[],errors:[],screens:[],viewports:[],renders:[],network:[],limitations:['Real mobile GPU performance not measured','Photorealism and taste require human review','Aircraft rights unresolved: local evaluation only']};
const check=(name,condition,details={})=>{results.checks.push({name,pass:Boolean(condition),...details});if(!condition) console.error('FAIL',name,details);};
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.on('pageerror',e=>results.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')results.errors.push(m.text());});
page.on('requestfailed',r=>results.network.push({url:r.url(),failure:r.failure()}));
await page.goto(BASE+PAGE+'?verify=1',{waitUntil:'networkidle',timeout:60000});
await page.waitForFunction(()=>window.__aerial?.ready,{timeout:60000});
await page.waitForTimeout(1600);
const context=await page.evaluate(()=>{const gl=window.__aerial.context;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};});
results.hardware={browser:browser.version(),viewport:{width:1440,height:1000},dpr:1,...context};
check('real WebGL context and aircraft loaded',await page.evaluate(()=>!window.__aerial.context.isContextLost()&&window.__aerial.stats().modelLoaded));
async function pixels(){return page.evaluate(()=>{const qa=window.__aerial;qa.render();const gl=qa.context;const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,b=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);const sample=[];let lit=0;for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=12){const i=(y*w+x)*4;const rgb=[b[i],b[i+1],b[i+2]];sample.push(...rgb);if(Math.max(...rgb)>25)lit++;}return{sample,litRatio:lit/(sample.length/3)};});}
const diff=(a,b)=>a.sample.reduce((sum,x,i)=>sum+Math.abs(x-b.sample[i]),0)/a.sample.length;
for(const u of [0,.33,.66,1]){
 await page.evaluate(u=>{const t=document.getElementById('aerial-track');window.scrollTo({top:t.offsetTop+u*(t.offsetHeight-innerHeight),behavior:'instant'});window.__aerial.setProgress(u);},u);
 await page.waitForTimeout(250);
 const stats=await page.evaluate(()=>window.__aerial.stats());const px=await pixels();
 results.renders.push({u,...stats,litRatio:px.litRatio});
 check('nonblank rendered scene '+u,px.litRatio>.1,{litRatio:px.litRatio});
 const path=OUT+`/chapter-${u}.png`;await page.screenshot({path});results.screens.push(path);
}
const maxCalls=Math.max(...results.renders.map(s=>s.calls));check('desktop draw-call budget <=100',maxCalls<=100,{maxCalls});
await page.locator('[data-action="pause"]').click();
await page.evaluate(()=>{window.__aerial.setProgress(.66);window.__aerial.setSensor(false);});
const cinematic=await pixels();await page.locator('[data-action="sensor"]').click();await page.waitForTimeout(1400);const sensor=await pixels();
check('sensor changes rendered world',diff(cinematic,sensor)>1,{meanChannelDelta:diff(cinematic,sensor)});
check('sensor state exposed',await page.locator('[data-action="sensor"]').getAttribute('aria-pressed')==='true');
await page.screenshot({path:OUT+'/sensor.png'});
await page.locator('[data-action="sensor"]').click();await page.waitForTimeout(1400);
await page.evaluate(()=>window.__aerial.setProgress(0));
const beforeInspect=await page.evaluate(()=>window.__aerial.stats().camera.position);
await page.locator('[data-action="inspect"]').click();
await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});
const inspectionBase=await page.evaluate(()=>window.__aerial.stats().camera.position);
await page.keyboard.press('ArrowLeft');
await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});
const afterInspect=await page.evaluate(()=>window.__aerial.stats().camera.position);
check('inspection keyboard changes camera',Math.hypot(...afterInspect.map((v,i)=>v-inspectionBase[i]))>.01);
await page.keyboard.press('Escape');const afterExit=await page.evaluate(()=>window.__aerial.stats().camera.position);
const expectedExit=await page.evaluate(async()=>{const m=await import('/js/aerial/state.mjs');return m.cameraPose(0,false,innerWidth/innerHeight).position;});
check('Escape exits and restores scroll camera',await page.locator('[data-action="inspect"]').getAttribute('aria-pressed')==='false'&&Math.hypot(...afterExit.map((v,i)=>v-expectedExit[i]))<.001,{expectedExit,afterExit});
await page.locator('[data-action="inspect"]').click();await page.locator('[data-action="rotate-right"]').click();await page.locator('[data-action="reset"]').click();await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});const reset=await page.evaluate(()=>window.__aerial.stats().camera.position);check('inspection reset restores pose',Math.hypot(...reset.map((v,i)=>v-inspectionBase[i]))<.001);await page.keyboard.press('Escape');
for(const width of [320,375,414,768,1440]){
 await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);
 const measures=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,controls:[...document.querySelectorAll('.aerial-toolbar button:not([hidden])')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,width:r.width,height:r.height,x:r.x,right:r.right};}),stats:window.__aerial.stats()}));
 results.viewports.push(measures);check('no horizontal overflow at '+width,measures.scrollWidth<=width&&measures.bodyWidth<=width);check('usable toolbar at '+width,measures.controls.every(c=>c.height>=44&&c.x>=0&&c.right<=width));
 if(width===375)await page.screenshot({path:OUT+'/mobile-375.png'});
}
await page.setViewportSize({width:1440,height:1000});
await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
await page.evaluate(()=>window.__aerial.setProgress(0));const reducedA=await page.evaluate(()=>window.__aerial.stats().camera);
await page.evaluate(()=>window.__aerial.setProgress(1));const reducedB=await page.evaluate(()=>window.__aerial.stats().camera);
check('reduced-motion fixes camera composition',JSON.stringify(reducedA)===JSON.stringify(reducedB));
const redFrameA=await pixels();await page.waitForTimeout(450);const redFrameB=await pixels();check('reduced-motion has no autonomous pixel movement',diff(redFrameA,redFrameB)<.01,{delta:diff(redFrameA,redFrameB)});
await page.emulateMedia({reducedMotion:'no-preference'});
// Native scroll round-trip, not only QA setters.
await page.evaluate(()=>{scrollTo({top:80,behavior:'instant'});});await page.waitForTimeout(250);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});const nativeA=await page.evaluate(()=>window.__aerial.stats().camera.position);await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:'instant'}));await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});const nativeB=await page.evaluate(()=>window.__aerial.stats().camera.position);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>window.__aerial.stats().cameraSettled,{timeout:15000});const nativeC=await page.evaluate(()=>window.__aerial.stats().camera.position);check('native scroll forward and reverse',Math.hypot(...nativeA.map((v,i)=>v-nativeB[i]))>1&&Math.hypot(...nativeA.map((v,i)=>v-nativeC[i]))<.1);
const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/aerial/')).map(r=>({name:r.name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})));
results.resources=resources;results.deferredAssetBytes=resources.reduce((s,r)=>s+r.encodedBodySize,0);check('deferred asset target <=8MB',results.deferredAssetBytes<=8e6,{bytes:results.deferredAssetBytes});
const inquiry=await page.locator('.aerial-inquiry').getAttribute('href');const home=await browser.newPage();await home.goto(BASE+inquiry,{waitUntil:'domcontentloaded'});check('inquiry targets real existing form',await home.locator('#quote form').count()>0);await home.close();
check('clean main page console',results.errors.length===0,{errors:results.errors});
const decodedState=await page.evaluate(()=>window.__aerial.stats());
const expectedAssetBytes={
 [BASE+'/assets/aerial/aircraft.glb']:(await stat('assets/aerial/aircraft.glb')).size,
 [BASE+'/assets/aerial/blue-hour.hdr']:(await stat('assets/aerial/blue-hour.hdr')).size
};
// Some Chromium streaming fetches report ERR_ABORTED after the complete body
// was consumed. Accept ONLY these two known decoded assets with exact body
// sizes; any missing/partial/unknown request still fails and remains recorded.
results.decodedStreamCancellations=[];
const unresolvedRequests=results.network.filter(item=>{
 const consumed=item.failure?.errorText==='net::ERR_ABORTED'&&expectedAssetBytes[item.url]&&resources.some(r=>r.name===item.url&&r.encodedBodySize===expectedAssetBytes[item.url])&&(item.url.endsWith('aircraft.glb')?decodedState.modelLoaded:decodedState.lighting==='hdr');
 if(consumed)results.decodedStreamCancellations.push(item);
 return !consumed;
});
check('no missing or partial normal asset requests',unresolvedRequests.length===0,{failed:unresolvedRequests,decodedStreamCancellations:results.decodedStreamCancellations.length});
check('HDR image-based lighting actually decoded',decodedState.lighting==='hdr');
const perf=await page.evaluate(async()=>{const times=[];let last;const start=performance.now();await new Promise(resolve=>{function step(t){if(last)times.push(t-last);last=t;if(t-start>=3000)resolve();else requestAnimationFrame(step);}requestAnimationFrame(step);});times.sort((a,b)=>a-b);return{durationMs:performance.now()-start,samples:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]};});results.frameTiming={...perf,note:'3-second headless sample, not a real-device 20-second acceptance measurement'};
const plain=await browser.newPage();await plain.goto(BASE+PAGE+'',{waitUntil:'networkidle'});check('QA handle absent on normal URL',await plain.evaluate(()=>!('__aerial' in window)));await plain.close();
const fallback=await browser.newPage();await fallback.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return /webgl/i.test(type)?null:old.call(this,type,...rest);};});await fallback.goto(BASE+PAGE+'',{waitUntil:'networkidle'});await fallback.waitForFunction(()=>document.documentElement.dataset.aerialState==='fallback');check('no-WebGL useful fallback',await fallback.locator('h1').isVisible()&&await fallback.locator('[data-action="retry"]').isVisible());await fallback.screenshot({path:OUT+'/fallback.png'});await fallback.close();
const failed=await browser.newPage();await failed.route('**/assets/aerial/aircraft.glb',r=>r.abort());await failed.goto(BASE+PAGE+'?verify=1',{waitUntil:'networkidle'});await failed.waitForFunction(()=>document.documentElement.dataset.aerialState==='error');check('missing aircraft reports real error',await failed.locator('#aerial-status').innerText().then(t=>t.includes('could not load')));await failed.unroute('**/assets/aerial/aircraft.glb');await failed.locator('[data-action="retry"]').click();await failed.waitForFunction(()=>window.__aerial?.ready,{timeout:60000});check('asset Retry actually recovers',await failed.evaluate(()=>window.__aerial.stats().modelLoaded));await failed.close();
await page.evaluate(()=>window.__aerial.context.getExtension('WEBGL_lose_context').loseContext());await page.waitForFunction(()=>document.documentElement.dataset.aerialState==='error');check('context loss exposes fallback and retry',await page.locator('[data-action="retry"]').isVisible());await page.locator('[data-action="retry"]').click();await page.waitForFunction(()=>window.__aerial?.ready,{timeout:60000});check('context-loss Retry creates working scene',await page.evaluate(()=>!window.__aerial.context.isContextLost()&&window.__aerial.stats().modelLoaded));
results.pass=results.checks.every(c=>c.pass);results.checkCount=results.checks.length;results.failedChecks=results.checks.filter(c=>!c.pass);
await writeFile(OUT+'/verification.json',JSON.stringify(results,null,2));console.log(JSON.stringify({pass:results.pass,checks:results.checkCount,failed:results.failedChecks,hardware:results.hardware,frameTiming:results.frameTiming,deferredAssetBytes:results.deferredAssetBytes,maxCalls},null,2));await browser.close();process.exitCode=results.pass?0:1;
