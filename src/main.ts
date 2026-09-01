import fs from 'node:fs';
import path from 'node:path';

import { Elysia, t } from 'elysia';

import cacheStore from './stores/CacheStore.ts';
import sessionStore from './stores/SessionStore.ts';
const appDir = path.join(import.meta.dirname, 'app');

const app = new Elysia({ serve: { maxRequestBodySize: (2 * 1024 * 1024) + 4096 } }); // 2MB + 4KB for metadata
app.get('/createAccTutorial.html', () => new Response(fs.readFileSync(path.join(appDir, 'createAccTutorial.html'), 'utf8'), { headers: { 'Content-Type': 'text/html' } }));
app.get('/', async ({ cookie: { auth, shimmy } }) => {
    //     // If not authenticated, serve the simple login UI
    if (!auth || !auth.value) {
        const loginHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login</title>
<style>body{background:#0f0f0f;color:#fff;font-family:Arial, sans-serif}#box{width:360px;margin:100px auto;padding:20px;background:#1b1b1b;border-radius:10px;box-shadow:0 0 20px rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center}input{width:100%;padding:8px;margin:6px 0;box-sizing:border-box}button{width:100%;margin-top:10px;padding:8px}a.create{display:block;width:100%;text-align:center;margin-top:8px;color:#9bd;}</style>
</head><body>
<div id="box">
  <h2 style="text-align:center;margin-bottom:10px">Login</h2>
  <input id="zmc-user" placeholder="Username">
  <input id="zmc-pass" type="password" placeholder="Password">
  <button id="zmc-login">Login</button>
  <a href="createAccTutorial.html" id="create-link" target="_blank" class="create">No account? Create One</a>
  <div id="zmc-msg" style="margin-top:10px;font-size:14px;text-align:center"></div>
</div>
<script>
document.getElementById('zmc-login').onclick = async () => {
  const user = document.getElementById('zmc-user').value.trim();
  const pass = document.getElementById('zmc-pass').value;
  const msg = document.getElementById('zmc-msg');
  if (!user || !pass) { msg.textContent = 'Fill all fields'; msg.style.color='red'; return; }
  try {
    const res = await fetch('/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: user, password: pass }) });
    const j = await res.json().catch(()=>null);
    if (res.ok && j && j.username === user) {
      // unlocked
      location.reload();
    } else {
      msg.textContent = (j && j.error) ? j.error : 'username or password is incorrect';
      msg.style.color = 'red';
    }
  } catch (e) {
    msg.textContent = 'Server error'; msg.style.color='red';
  }
};

// ensure create-link opens a new tab/window
document.getElementById('create-link').addEventListener('click', (e) => { e.preventDefault(); window.open('/createAccTutorial.html', '_blank', 'noopener'); });
</script>
</body></html>`;

        return new Response(loginHtml, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
    }

    // authenticated: proxy shellshock.io and inject scripts (existing behavior)
    const req = await fetch('https://shellshock.io');
    const res = await req.text();

    const getScripts = fs.readFileSync(path.join(appDir, 'getScripts.js'), 'utf8');

    // credit: op7
    const socketFix = fs.readFileSync(path.join(import.meta.dirname, 'util', 'socketFix.js'), 'utf8');

    let gmInject = fs.readFileSync(path.join(import.meta.dirname, 'util', 'gm.js'), 'utf8');

    let inject = socketFix + '(() => {' + getScripts + `(() => {
        const loadShimScripts = window.loadShimScripts;
        const pushToCookie = window.pushToCookie;

        delete window.loadShimScripts;
        delete window.pushToCookie;

        loadShimScripts().then((scripts) => {
            if (scripts.length !== ${sessionStore.size(shimmy.value)}) pushToCookie(scripts).then(() => location.reload());
        });
    })();`;

    if (shimmy && shimmy.value && sessionStore.has(shimmy.value)) {
        const data = sessionStore.get(shimmy.value);
        data?.forEach((e) => {
            let realInject = gmInject;

            const metaString = e.split('==UserScript==')[1]?.split('==/UserScript==')[0] || '';
            const metaLines = metaString.split('\n').map(line => line.trim()).filter(line => line.startsWith('// @'));
            const metaObj: any = {};
            metaLines.forEach(line => {
                const [key, ...rest] = line.split(/[ \t]+/).slice(1);
                metaObj[key.slice(1)] = rest.filter(e => e).join(' ');
            });

            realInject = realInject.replace('__META_STR__', () => metaString);
            realInject = realInject.replace('__SCRIPT_OBJ__', () => JSON.stringify(metaObj));
            // same thing, lightspeed will block shell shockers either, click cancel and it can do nothing about it :)
            inject += `\n;(() => {${realInject};window.addEventListener('beforeunload', (e) => e.preventDefault());try{\n${e}\n}catch(e){console.error('error in injected userscript:\\n', e)}})();\n`
        });
    }

    inject += `})();`;

    const final = res.replace('<body>', () => `<head><script>${inject}</script></head><body>`);

    return new Response(final, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}, { cookie: t.Object({ shimmy: t.Optional(t.String()) }) });

app.get('/inject', () => new Response(fs.readFileSync(path.join(appDir, 'index.html'), 'utf8'), { headers: { 'Content-Type': 'text/html' } }));
app.get('/inject/getScripts.js', () => new Response(fs.readFileSync(path.join(appDir, 'getScripts.js'), 'utf8'), { headers: { 'Content-Type': 'text/javascript' } }));

app.post('/inject/push', ({ cookie: { shimmy }, body }) => {
    if (shimmy.value && sessionStore.has(shimmy.value)) sessionStore.delete(shimmy.value);

    const newSession = crypto.randomUUID();
    sessionStore.set(newSession, body);

    shimmy.value = newSession;
    shimmy.sameSite = 'lax';
    shimmy.maxAge = 60 * 60 * 1000 * 24; // 24h

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}, { body: t.Array(t.String()), cookie: t.Object({ shimmy: t.Optional(t.String()) }) });

app.post('/auth', async ({ body }) => {
  try {
    const remote = await fetch('https://define.mathvariables.xyz/server/zmcd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await remote.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = text; }

    if (remote.ok && parsed && typeof parsed === 'object' && parsed.username === body.username) {
      return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': `auth=${encodeURIComponent(body.username)}; Path=/; Max-Age=${60*60*24}` } });
    }

    return new Response(JSON.stringify(parsed), { status: 401, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}, { body: t.Object({ username: t.String(), password: t.String() }) });

app.get('/*', async ({ request }) => {
    if (cacheStore.has(request.url)) {
        const cachedResponse = cacheStore.get(request.url);
        if (cachedResponse) return new Response(cachedResponse[0], { headers: { 'Content-Type': cachedResponse[1] || 'text/plain' } });
    }

    const url = new URL(request.url, 'https://shellshock.io');
    url.host = 'shellshock.io';
    url.port = '';
    url.protocol = 'https:';

    const req = await fetch(url.href);
    const res = await req.arrayBuffer();

    const contentType = req.headers.get('Content-Type') || 'text/plain';
    cacheStore.set(request.url, [res, contentType]);

    return new Response(res, { headers: { 'Content-Type': contentType } });
});

app.listen({ port: 6602 }, () => console.log('shim -> http://localhost:6602'));