// Typescript stack traces
require('source-map-support').install();

require('./dist/app').App
    .initialize()
    .catch(err => {
        console.error('Exception in main thread:', err);
        process.exit(1);
    });