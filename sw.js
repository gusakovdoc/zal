/* Офлайн-режим. Версию поднимать при каждом изменении набора файлов —
   иначе старый кэш переживёт обновление. */
var V='zal-v2';
var CORE=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(V)
      /* addAll падает целиком, если хоть один файл не отдался; кладём поштучно */
      .then(function(c){return Promise.all(CORE.map(function(u){return c.add(u).catch(function(){});}));})
      .then(function(){return self.skipWaiting();})
  );
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){return k===V?null:caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});

self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET')return;
  var u;
  try{u=new URL(r.url);}catch(err){return;}
  /* Синхронизация всегда идёт в сеть: закэшированный ответ означал бы потерю данных */
  if(u.hostname==='api.github.com')return;
  /* Проба связи тоже мимо кэша — иначе она всегда отвечала бы «сеть есть» */
  if(u.searchParams.get('net')==='1')return;

  /* Страница: сначала сеть, чтобы обновление приложения доезжало сразу,
     кэш — только когда сети нет */
  if(r.mode==='navigate'||(r.headers.get('accept')||'').indexOf('text/html')>-1){
    e.respondWith(
      fetch(r).then(function(res){
        var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp);});
        return res;
      }).catch(function(){
        return caches.match(r).then(function(m){return m||caches.match('./index.html');});
      })
    );
    return;
  }

  /* Шрифты, иконки: сначала кэш, сеть только при промахе */
  e.respondWith(
    caches.match(r).then(function(m){
      if(m)return m;
      return fetch(r).then(function(res){
        /* opaque — ответ со шрифтового CDN без CORS: класть можно, читать нельзя */
        if(res&&(res.status===200||res.type==='opaque')){
          var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp);});
        }
        return res;
      }).catch(function(){return m;});
    })
  );
});

self.addEventListener('notificationclick',function(e){
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type:'window'}).then(function(ls){
      for(var i=0;i<ls.length;i++){if('focus' in ls[i])return ls[i].focus();}
      if(self.clients.openWindow)return self.clients.openWindow('./');
    })
  );
});
