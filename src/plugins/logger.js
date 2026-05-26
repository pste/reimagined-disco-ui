const isDebug = window.location.href.indexOf("http://localhost.") === 0;

export default {
    log: (...args) => { if (isDebug) { console.log(...args); } },
    info: console.log,
    error: console.error,
}