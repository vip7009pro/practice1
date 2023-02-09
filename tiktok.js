const ttdl =  require("tiktok-video-downloader");

const link = "https://www.tiktok.com/@hungnguyenpage/video/7192553339689667867"

ttdl.getInfo(link)
  .then((result) => {
    console.log(result);
  })