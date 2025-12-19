const debugLog = console.log;

export default  {
    log: function() {
        const href = window.location.href;
        const isDebug = href.indexOf("http://localhost.") === 0;
        if (isDebug) {
            console.log.apply(console, arguments);
        }
        //var args = Array.from(arguments); // OR you can use: Array.prototype.slice.call( arguments );
        // console.log.apply(console, args);
    },
    info: console.log,
    error: console.error,
}