const {chromium}=require('playwright');
const ids=['marquee','still','control','aurora','washi','sora','summit','loadout','studio','phulkari','callus','forge','pace','engine','datenight'];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
const errs=[];p.on('pageerror',e=>errs.push(p.url().split('=')[1]+': '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const base='file://'+require('path').resolve(__dirname,'..')+'/app/src/main/assets/web/home.html?theme=';
for(const id of ids){await p.goto(base+id);await p.waitForTimeout(600);
  const r=await p.evaluate(()=>{const vis=[...document.querySelectorAll('.screen')].filter(s=>!s.hidden);return {vis:vis.length,tiles:vis[0]?vis[0].querySelectorAll('[data-tile]').length:0,ready:document.body.classList.contains('ready')}});
  await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');
  const f=await p.evaluate(()=>{const on=document.querySelector('.screen:not([hidden]) [data-tile].on');return on?on.textContent.trim().slice(0,40):null});
  console.log(id,JSON.stringify(r),'focus:',f);
  if(['phulkari','callus','datenight'].includes(id)) await p.screenshot({path:require('path').join(require('os').tmpdir(),`tv-${id}.png`)});
}
await p.goto(base+'pace');await p.waitForTimeout(500);await p.evaluate(()=>TvHome.emit('menu'));await p.waitForTimeout(200);await p.keyboard.press('ArrowRight');await p.screenshot({path:''+require('os').tmpdir()+'/tv-menu.png'});
console.log('errors:',errs);await b.close();})();
