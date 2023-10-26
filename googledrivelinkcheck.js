const axios = require('axios');
const moment = require("moment");
const fetch =require('node-fetch');

let CURRENT_API_URL = 'https://script.google.com/macros/s/AKfycbyD_LRqVLETu8IvuiqDSsbItdmzRw3p_q9gCv12UOer0V-5OnqtbJvKjK86bfgGbUM1NA/exec'
/* axios.get(CURRENT_API_URL)
  .then((response) => {
    //console.log(response.data)
    let resp = response.data;
    //console.log(resp)
    let fil = resp.filter((e) => e[0] === 'PVN')
    console.log(fil[0][1]);
    let now =moment();
    let exp_date = moment(fil[0][1])
  
    if(now >= exp_date) {
      console.log('het han');
    }
    else {
      console.log('con han')
    }
    
  })
  .catch((e) => {
  }) 
 */



  let asfunction = async () => {
    await fetch(CURRENT_API_URL)    
    .then(res => res.json())
    .then(body => {
      let resp = body;
    //console.log(resp)
    let fil = resp.filter((e) => e[0] === 'PVN')
    console.log(fil[0][1]);
    let now =moment();
    let exp_date = moment(fil[0][1])
  
    if(now >= exp_date) {
      console.log('het han');
    }
    else {
      console.log('con han')
    }
 
    });


  }
   

asfunction();