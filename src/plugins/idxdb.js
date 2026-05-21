import logger from '@/plugins/logger'

const dbName = 'localdisco';
const dbVersion = 4;
let db = null;

// build a request to connect to the db
var request = indexedDB.open(dbName, dbVersion);

// ready promise: resolves when db is initialized, so callers can await it
// before running transactions (fixes races at app mount time)
let resolveReady;
const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    request.onerror = (event) => {
        logger.error("idxDB open error:", event);
        reject(event);
    };
});

request.onsuccess = function (event) {
    logger.log("idxbd succesfully initialized");
    db = request.result;

    db.onerror = function (event) {
        logger.error("Error creating/accessing idxbd database");
    };

    // Interim solution for Google Chrome to create an objectStore. Will be deprecated
    /*if (db.setVersion) {
        if (db.version != dbVersion) {
            var setVersion = db.setVersion(dbVersion);
            setVersion.onsuccess = function () {
                createObjectStore(db);
            };
        }
    }*/
    resolveReady();
}

request.onupgradeneeded = function (event) {
    logger.log("idxbd upgrading ...");
    const db = event.target.result;
    createObjectStore(db);
};

//
function createObjectStore(db) {
    let tableName;

    //
    tableName = "covers";
    logger.log("Creating objectStore", tableName);
    try {
        db.deleteObjectStore(tableName);
    }
    catch(err) {
        logger.log(`Warning: cannot delete object store ${tableName} during upgrade. Skipping ...`);
    }
    const coversObjectStore = db.createObjectStore(tableName, { keyPath: "id" });
    coversObjectStore.createIndex("name", "name", { unique: false });
    coversObjectStore.transaction.oncomplete = (event) => {
        logger.log(`${tableName} store ready ...`);
    }

    //
    tableName = "chunks";
    logger.log("Creating objectStore", tableName);
    try {
        db.deleteObjectStore(tableName);
    }
    catch(err) {
        logger.log(`Warning: cannot delete object store ${tableName} during upgrade. Skipping ...`);
    }
    const chunksObjectStore = db.createObjectStore(tableName, { keyPath: "id" });
    chunksObjectStore.transaction.oncomplete = (event) => {
        logger.log(`${tableName} store ready ...`);
    }
    // here the init for other tables
}

//
async function get(tableName, id) {
    await ready;
    return new Promise((resolve, reject) => {
        const store = db
            .transaction([tableName], "readwrite")
            .objectStore(tableName);
        const req = store.get(id);
        req.onsuccess = (event) => {
            const record = event.target.result;
            if (record?.data?.expiresAt && record.data.ttlMs) {
                record.data.expiresAt = Date.now() + record.data.ttlMs;
                store.put(record);
            }
            resolve(record?.data); // all records are { data, id }. Returns undefined if not found
        };
        req.onerror = (event) => {
            logger.error("idxDB get error:", event);
            reject(event);
        };
    });
}

//
async function upsert(tableName, id, data) {
    await ready;
    return new Promise((resolve, reject) => {
        const transaction = db
            .transaction([tableName], "readwrite")
            .objectStore(tableName)
            .put({ data, id });
        transaction.onsuccess = () => {
            resolve(data);
        };
        transaction.onerror = (event) => {
            logger.error("idxDB put error:", event);
            reject(event);
        };
    });
}

//
async function getAll(tableName) {
    await ready;
    return new Promise((resolve, reject) => {
        const store = db
            .transaction([tableName], "readonly")
            .objectStore(tableName);
        const req = store.getAll();
        req.onsuccess = (event) => resolve(event.target.result);
        req.onerror = (event) => {
            logger.error("idxDB getAll error:", event);
            reject(event);
        };
    });
}

//
async function remove(tableName, id) {
    await ready;
    return new Promise((resolve, reject) => {
        const req = db
            .transaction([tableName], "readwrite")
            .objectStore(tableName)
            .delete(id);
        req.onsuccess = () => resolve();
        req.onerror = (event) => {
            logger.error("idxDB remove error:", event);
            reject(event);
        };
    });
}

//
async function sweepExpired(tableName) {
    await ready;
    return new Promise((resolve, reject) => {
        const store = db
            .transaction([tableName], "readwrite")
            .objectStore(tableName);
        const req = store.openCursor();
        const now = Date.now();
        let removed = 0;
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const expiresAt = cursor.value?.data?.expiresAt;
                if (expiresAt && expiresAt < now) {
                    cursor.delete();
                    removed += 1;
                }
                cursor.continue();
            }
            else {
                if (removed > 0) {
                    logger.log(`idxDB sweep ${tableName}: removed ${removed} expired entries`);
                }
                resolve(removed);
            }
        };
        req.onerror = (event) => {
            logger.error("idxDB sweep error:", event);
            reject(event);
        };
    });
}

//
function createDB() {
    return {
        get: get,
        put: upsert,
        sweep: sweepExpired,
        getAll: getAll,
        remove: remove,
    }
}

//
export default {
    install: (app, options) => {
        app.provide("idxDB", createDB());
    }
}