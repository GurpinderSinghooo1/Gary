const {chromium}=require('playwright');
const fake=`(function(){
 const now=Date.now();
 const R={
  'settings.get':{theme:'x',homeName:'Ottawa',secondName:'Amritsar',secondLat:31.6,secondLon:74.8,smartthingsConfigured:true,stravaConfigured:true,tmdbConfigured:true,region:'CA'},
  'apps':[{id:'netflix',packageName:'com.netflix.ninja',label:'Netflix',installed:true},{id:'youtube',packageName:'com.google.android.youtube.tv',label:'YouTube',installed:true},{id:'disney',packageName:'com.disney.disneyplus',label:'Disney+',installed:true},{id:'prime',packageName:'com.amazon.amazonvideo.livingroom',label:'Prime Video',installed:true},{id:'paramount',packageName:'com.cbs.ott',label:'Paramount+',installed:false}],
  'continueWatching':{permission:true,items:[{title:'Stranger Things',episodeTitle:'Chapter Four',season:'4',episode:'4',packageName:'com.netflix.ninja',progress:41,durationMs:4800000,positionMs:1968000,posterUrl:null,intentUri:'intent://netflix#Intent;end',lastEngagementMs:now},{title:'The Mandalorian',season:'3',episode:'2',packageName:'com.disney.disneyplus',progress:80,durationMs:2400000,positionMs:1920000,posterUrl:null,intentUri:null,lastEngagementMs:now-5000}]},
  'soundbar.status':{configured:true,method:'smartthings',power:true,volume:22,mute:false},
  'system':{wifi:{connected:true,linkSpeedMbps:866,signalLevel:3,ethernet:false},storage:{freeBytes:4e9,totalBytes:8e9}},
  'stats':{granted:true,todayMs:30*60000,weekMs:5*3600000,yearMs:150*3600000,last7Days:[0,20,30,0,50,60,30].map(m=>m*60000),streakDays:3,topApp:'disney'},
  'store.get':{'callus.goals':[{text:'Deadlift 140 kg',done:true},'Sleep by 11'],'callus.wins':['Ran 30 km'],'pace.race':{name:'Toronto Waterfront',date:'2027-10-17',bib:'777',goal:'3:30:00'},'datenight.anniversary':'2019-02-14'},
  'weather':{name:'Ottawa',current:{temp:-4.4,feelsLike:-9.6,code:71,text:'Snow',windKmh:22,windDir:290,cloud:100,isDay:true},daily:[{date:'2026-11-15',max:-1,min:-7,sunrise:'2026-11-15T07:01',sunset:'2026-11-15T16:31'}]},
  'weatherMulti':[{name:'Amritsar',current:{temp:13,text:'Clear'},daily:[]}],
  'strava.summary':{configured:true,today:{minutes:40},week:{runKm:28.4,runs:3,minutes:190,startDate:'2026-11-09'},weeks:[{km:30,minutes:200},{km:35,minutes:240},{km:20,minutes:150},{km:40,minutes:260},{km:42,minutes:280},{km:28,minutes:190}],lastRun:{name:'Morning Run',date:'2026-11-14T06:30:00Z',km:12.1,movingS:3720,paceSPerKm:307,splits:[320,315,310,305,300,298,302,299,296,294,290,288]},streakDays:5},
  'tmdb.picks':[{title:'Past Lives',overview:'Two childhood friends reunite decades later. It is quiet and moving.',runtimeMin:106,genres:['Romance'],posterUrl:null,provider:'Amazon Prime Video',appId:'prime'}],
 };
 window.__calls=[];
 window.TvBridge={isNative:()=>true,version:()=>'0.1.0',request:(m,a,id)=>{window.__calls.push([m,a]);setTimeout(()=>TvHome.resolve(id,m in R?{ok:true,data:JSON.parse(JSON.stringify(R[m]))}:{ok:true,data:true}),5)}};
})();`;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
await p.addInitScript(fake);
const errs=[];p.on('pageerror',e=>errs.push(e.message));
const base='file://'+require('path').resolve(__dirname,'..')+'/app/src/main/assets/web/home.html?theme=';
for(const id of ['washi','marquee','control','phulkari','callus','pace','engine','loadout','datenight','summit']){
 await p.goto(base+id);await p.waitForTimeout(700);
 const info=await p.evaluate(()=>{const s=document.querySelector('.screen:not([hidden])');return {binds:[...s.querySelectorAll('[data-b]')].map(e=>e.getAttribute('data-b')+'='+e.textContent).slice(0,6).join(' | '),first:s.querySelector('[data-tile]')?.textContent.replace(/\s+/g,' ').trim().slice(0,60)}});
 await p.keyboard.press('Enter');await p.waitForTimeout(50);
 const last=await p.evaluate(()=>JSON.stringify(window.__calls.filter(c=>c[0].startsWith('launch')).pop()||null));
 console.log(id,'|',info.first,'|',info.binds,'| OK→',last);
 if(['callus','pace','datenight','control'].includes(id)) await p.screenshot({path:`'+require('os').tmpdir()+'/nat-${id}.png`});
}
console.log('errors',errs);await b.close();})();
