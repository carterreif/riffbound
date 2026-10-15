/* Shared validation for linked background videos and their portable backups. */
(function(root){
  'use strict';
  function youtubeId(value){
    let url;try{url=new URL(value);}catch{return null;}
    const host=url.hostname.toLowerCase();let id=null;
    if(host==='youtu.be'||host==='www.youtu.be')id=url.pathname.split('/')[1];
    else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
      const parts=url.pathname.split('/').filter(Boolean);id=parts[0]==='watch'?url.searchParams.get('v'):['embed','shorts','live'].includes(parts[0])?parts[1]:null;
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
  }
  function videoUrl(value){
    if(typeof value!=='string'||!value.trim()||value.length>4096)throw Error('Paste a YouTube link or direct HTTPS MP4/WebM video link.');
    let url;try{url=new URL(value.trim());}catch{throw Error('Enter a complete video link starting with https://.');}
    if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('Use an HTTPS video link without a username or password in the address.');
    const id=youtubeId(url.href);if(id)return 'https://www.youtube.com/watch?v='+id;
    if(/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|dailymotion\.com|tiktok\.com)$/i.test(url.hostname)||/\.(html?|php|aspx?)$/i.test(url.pathname))throw Error('Use a valid YouTube video link or a direct MP4 or WebM video link. Other video-page links are not supported here; you can also upload a video file.');
    url.hash='';return url.href;
  }
  function name(value){const url=new URL(videoUrl(value)),id=youtubeId(url.href);if(id)return 'YouTube video ('+id+')';let label=url.pathname.split('/').pop()||'Linked video';try{label=decodeURIComponent(label);}catch{}return label.slice(0,500);}
  function isLink(value){try{return !!value&&videoUrl(value)===value;}catch{return false;}}
  const api={videoUrl,name,isLink,youtubeId};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RiffBackgroundSource=api;
})(typeof window!=='undefined'?window:globalThis);
