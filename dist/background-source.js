/* Shared validation for linked background videos and their portable backups. */
(function(root){
  'use strict';
  function videoUrl(value){
    if(typeof value!=='string'||!value.trim()||value.length>4096)throw Error('Paste a direct HTTPS video link, such as an MP4 or WebM file.');
    let url;try{url=new URL(value.trim());}catch{throw Error('Enter a complete video link starting with https://.');}
    if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('Use an HTTPS video link without a username or password in the address.');
    if(/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|dailymotion\.com|tiktok\.com)$/i.test(url.hostname)||/\.(html?|php|aspx?)$/i.test(url.pathname))throw Error('Use a direct MP4 or WebM video link. YouTube and other video-page links are not supported here; you can also upload a video file.');
    url.hash='';return url.href;
  }
  function name(value){const url=new URL(videoUrl(value));let label=url.pathname.split('/').pop()||'Linked video';try{label=decodeURIComponent(label);}catch{}return label.slice(0,500);}
  function isLink(value){try{return !!value&&videoUrl(value)===value;}catch{return false;}}
  const api={videoUrl,name,isLink};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffBackgroundSource=api;
})(typeof window!=='undefined'?window:globalThis);
