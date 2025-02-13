function toBase64(buffer) {
    if (buffer) {
        const arr = new Uint8Array(buffer);
        const str = String.fromCharCode.apply(null, arr);
        const base64 = btoa(str);
        return `data:image/png;base64, ${base64}`;
    }
    return null;
}

export default {
    install: (app, options) => {
        app.provide("ImageData", {
            toBase64
        });
    }
}