const axios = require("axios");

const options = {
  method: 'GET',
  url: 'https://tiktok-video-no-watermark2.p.rapidapi.com/',
  params: {url: 'https://www.tiktok.com/@tiktok/video/7106658991907802411', hd: '0'},
  headers: {
    'X-RapidAPI-Key': '61589e20e2mshb2cca6f1d125c02p1581b7jsn9ecd0bdd49c1',
    'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
  }
};

axios.request(options).then(function (response) {
	console.log(response.data);
}).catch(function (error) {
	console.error(error);
});