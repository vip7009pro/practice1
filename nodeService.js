const Service = require('node-windows').Service
const svc = new Service({
    name: 'CMSServerService',
    description: 'Service backend CMS',
    script: 'D:\\NODEJS\\practice1\\app.js',

})
/* svc.on('install', function() {
    svc.start();
})
svc.install() */
svc.uninstall();