import fs from 'node:fs';
import path from 'node:path';

import { Elysia, t } from 'elysia';

import cacheStore from './stores/CacheStore.ts';
import sessionStore from './stores/SessionStore.ts';
const appDir = path.join(import.meta.dirname, 'app');

const app = new Elysia({ serve: { maxRequestBodySize: (2 * 1024 * 1024) + 4096 } }); // 2MB + 4KB for metadata

app.get('/', async ({ cookie: { shimmy } }) => {
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

            inject += `\n;(() => {${realInject};try{\n${e}\n}catch(e){console.error('error in injected userscript:\\n', e)}})();\n`
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