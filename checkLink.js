const axios = require('axios');

let url = 'https://drive.google.com/uc?export=download&id=10dJDjoOhkW9aFkim2f0-TeUTLiptcA7i';
let data = axios.get(url).then((response)=>{
    console.log(response.data);
}).catch((error)=> {
    console.log(error);
});

