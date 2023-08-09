const axios = require('axios');

let data = axios.get('http://222.252.1.63/banve/af.txt').then((response)=>{
    console.log(response.data);
}).catch((error)=> {
    console.log(error);
});
