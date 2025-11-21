const dbName = 'localdisco';
const dbVersion = 2.2;
let db = null;

// build a request to connect to the db
var request = indexedDB.open(dbName, dbVersion);

request.onsuccess = function (event) {
    console.log("idxbd succesfully initialized");
    db = request.result;

    db.onerror = function (event) {
        console.error("Error creating/accessing idxbd database");
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
    console.log("idxbd upgrading ...");
    const db = event.target.result;
    createObjectStore(db);
};

//
function createObjectStore(db) {
    let tableName;

    //
    tableName = "covers";
    console.log("Creating objectStore", tableName);
    try {
        db.deleteObjectStore(tableName);
    }
    catch(err) {
        console.log(`Warning: cannot delete object store ${tableName} during upgrade. Skipping ...`);
    }
    const coversObjectStore = db.createObjectStore(tableName, { keyPath: "id" });
    coversObjectStore.createIndex("name", "name", { unique: false });
    coversObjectStore.transaction.oncomplete = (event) => {
        console.log(`${tableName} store ready ...`);
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
            // console.log("idxDB get success", event);
            resolve(event.target.result?.data); // all records are { data, id }. Returns undefined if not found
        };
        transaction.onerror = (event) => {
            console.error("idxDB get error:", event);
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
            console.error("idxDB put error:", event);
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