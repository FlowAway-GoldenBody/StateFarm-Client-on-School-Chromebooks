(() => {
    const DB_NAME = 'shim-db';
    const DB_STORE = 'files';
    const LS_KEY = 'shim-urls';

    const openDB = () => new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE, { keyPath: 'name' });
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej(req.error);
    });

    const dbGetAll = (db) => new Promise((res, rej) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });

    const loadStoredURLs = () => {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    const fetchURLs = async (urlEntries) => {
        const results = await Promise.allSettled(urlEntries.map(entry =>
            fetch(entry.url).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} for ${entry.url}`);
                return r.text();
            }).then(content => ({ name: entry.name, url: entry.url, content, source: 'url' }))
        ));

        const scripts = [];
        for (const result of results) {
            if (result.status === 'fulfilled') scripts.push(result.value);
            else console.warn('[shim] failed to fetch url:', result.reason?.message);
        }
        return scripts;
    }

    const loadShimScripts = async () => {
        const db = await openDB();

        const [fileRecords, urlEntries] = await Promise.all([
            dbGetAll(db),
            Promise.resolve(loadStoredURLs()),
        ]);

        const fileScripts = fileRecords.map(f => ({
            name: f.name,
            content: f.content,
            source: 'file',
        }));

        const urlScripts = await fetchURLs(urlEntries);
        const scripts = [...fileScripts, ...urlScripts];

        await Promise.all(scripts.map(async (script) => {
            if (script.content.includes('==UserScript==')) {
                const requires = [...script.content.matchAll(/@require(?:s?)\s*([^\s]+)/g)].map(m => m[1]);
                if (requires.length) {
                    const requiredScripts = await fetchURLs(requires.map((url, i) => ({ name: `${script.name}-require-${i}`, url })));
                    script.content = requiredScripts.map(s => s.content).join('\n') + '\n' + script.content;
                }
            }
        }));

        return scripts;
    }

    const pushToCookie = async (scripts) => {
        if (!scripts) scripts = await loadShimScripts();

        try {
            const req = await fetch('/inject/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scripts.map(e => e.content))
            });

            const res = await req.json();
            return res;
        } catch (e) {
            console.error('failed to push scripts:', e);
            return false;
        }
    }

    window.loadShimScripts = loadShimScripts;
    window.pushToCookie = pushToCookie;
})();