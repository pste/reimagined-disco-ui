const dbName = 'localdisco';
const dbVersion = 2.2;
let db = null;

//
const logger = console; // PSTE TODO REF LOGGER PLUGIN

// build a request to connect to the db
var request = indexedDB.open(dbName, dbVersion);

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
    // here the init for other tables
}

//
async function get(tableName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db
            .transaction(tableName)
            .objectStore(tableName)
            .get(id);
        transaction.onsuccess = (event) => {
            // logger.log("idxDB get success", event);
            resolve(event.target.result?.data); // all records are { data, id }. Returns undefined if not found
        };
        transaction.onerror = (event) => {
            logger.error("idxDB get error:", event);
            reject(event);
        };
    });
}

//
async function upsert(tableName, id, data) {
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
function createDB() {
    return {
        get: get,
        put: upsert,
    }
}

//
export default {
    install: (app, options) => {
        app.provide("idxDB", createDB());
    }
}