
// cache/urlToRegex.js
function urlToRegex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = `^${escaped.replace(/\*/g, '.*')}$`;

    return new RegExp(regexStr);
}


// cache/cacheStrategy.js
function cacheStrategy(event, strategies) {
    let selectStrategy;
    let maxIterations = 0;

     for (const strategy of strategies) {
        const splitPath = event.request.url.split("/");

        for (const strategyUrl of strategy.urls) {
            const strategyUrlSplit = strategy.split("/");
            let iterations = 0;

            let urlIsCorrect = true;

            for (const i in strategyUrlSplit) {
                if (strategyUrlSplit[i] !== splitPath[i] && strategyUrlSplit[i] !== "*") {
                    urlIsCorrect = false;
                    break;
                }

                iterations++;
            }

            if (urlIsCorrect && maxIterations < iterations) {
                selectStrategy = strategy;
                maxIterations = iterations;
            }
        }
    }

    if (selectStrategy) {
        if (selectStrategy.ttl) {
            return selectStrategy.callback(selectStrategy.ttl, event);
        }
        return selectStrategy.callback(event);
    }

    return fetch(event.request);
}


// cache/cache.js
class Cache {
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.connectionCount = 0;
    }

    async _getDB() {
        if (this.db) {
            this.connectionCount++;
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'request' });
                }
            };

            request.onsuccess = event => {
                this.db = event.target.result;
                this.connectionCount = 1;

                this.db.onerror = () => this._closeDB();
                resolve(this.db);
            };

            request.onerror = event => {
                reject(`DB open error: ${event.target.error}`);
            };
        });
    }

    _closeDB() {
        if (this.db && this.connectionCount <= 0) {
            this.db.close();
            this.db = null;
        }
    }

    async _executeOperation(operation) {
        try {
            const db = await this._getDB();
            const result = await operation(db);
            return result;
        } finally {
            this.connectionCount--;
            this._closeDB();
        }
    }

    async set(request, response, ttl) {
        return this._executeOperation(db => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);

                const data = { request, response };

                if (ttl) {
                    const date = new Date();

                    ttl.split(" ").forEach(el => {
                        const
                            type = el.slice(-1),
                            value = +el.slice(0, el.length - 1);

                        if (type === "s") {
                            date.setSeconds(date.getSeconds() + value);
                        } else if (type === "m") {
                            date.setMinutes(date.getMinutes() + value);
                        } else if (type === "h") {
                            date.setHours(date.getHours() + value);
                        } else if (type === "d") {
                            date.setDate(date.getDate() + value);
                        } else if (type === "M") {
                            date.setMonth(date.getMonth() + value);
                        } else if (type === "y") {
                            date.setFullYear(date.getFullYear() + value);
                        }
                    });

                    data.ttl = date;
                }

                const requestDB = store.put(data);

                requestDB.onsuccess = () => resolve();
                requestDB.onerror = () => reject(`Set error: ${requestDB.error}`);
            });
        });
    }

    async get(request) {
        return this._executeOperation(async (db) => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);

                const requestDB = store.get(request);

                requestDB.onsuccess = () => resolve(requestDB.result?.response);
                requestDB.onerror = () => reject(`Get error: ${requestDB.error}`);
            });
        });
    }

    async delete(request) {
        return this._executeOperation(async (db) => {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);

                const requestDB = store.delete(request);

                requestDB.onsuccess = () => resolve();
                requestDB.onerror = () => reject(`Delete error: ${requestDB.error}`);
            });
        });
    }
}

const cache = new Cache("beauty-cache", "cache");


// cache/cacheOnly.js
async function cacheOnly(ttl, event) {
    try {
        const cachedResponse = await cache.set(event.request);
        if (cachedResponse && cachedResponse.ttl < new Date()) {
            return cachedResponse;
        }

        const networkResponse = await fetch(event.request);

        if (networkResponse.ok) {
            const clone = networkResponse.clone();
            event.waitUntil(cache.set(event.request, clone, ttl));
        }

        return networkResponse;

    } catch (_) {
        return fetch(event.request);
    }
}

// Call module: cache
self.addEventListener('fetch', event => {
    event.respondWith(
       cacheStrategy(event, [{urls: ["/index.html","/icons/*"], ttl: '1h', callback: cacheOnly}, ])
    );
});