// ==UserScript==
// @name        cutechan
// @namespace   0chan
// @description Improve 0chan user experience.
// @downloadURL https://raw.githubusercontent.com/Kagami/cutechan/master/cutechan.user.js
// @updateURL   https://raw.githubusercontent.com/Kagami/cutechan/master/cutechan.user.js
// @include     https://0chan.hk/*
// @include     http://nullchan7msxi257.onion/*
// @version     0.3.8
// @grant       unsafeWindow
// @grant       GM_xmlhttpRequest
// @grant       GM_setClipboard
// @grant       GM_addStyle
// @connect     safe.moe
// @connect     pomf.space
// @connect     doko.moe
// @connect     null.vg
// @connect     memenet.org
// @connect     mixtape.moe
// @connect     lewd.es
// @connect     gfycat.com
// @connect     2ch.hk
// @connect     brchan.org
// @connect     4chan.org
// ==/UserScript==

(function() {
"use strict";

GM_addStyle([
  ".post-img a{outline:none}",

  ".threads{counter-reset:p}",
  ".threads .post{counter-increment:p}",
  ".post-op,.post-deleted,.post-popup>.post{counter-increment:p 0!important}",
  '.threads .post-id:after{content:"("counter(p)")";color:#16a085}',
  '.threads .post-op .post-id:after{content:"ОП";color:#cd5c5c}',
  '.threads .post-deleted .post-id:after{content:"удалён";color:#cd5c5c}',
  '.post-popup>.post .post-id:after{content:""}',

  ".cute-panel{",
  "  z-index:1000;background:#f1f1f1;",
  "  font-size:15px;line-height:45px;padding-right:10px;",
  "  border-top:1px solid #ccc;border-left:1px solid #ccc;",
  "  position:fixed;right:0;bottom:0;",
  "}",

  ".cute-logo{",
  "  display:inline-block;vertical-align:bottom;",
  "  width:45px;height:45px;margin-right:10px;cursor:pointer;",
  "}",
  ".cute-logo-left{fill:#55bede}",
  ".cute-logo-right{fill:#fb3}",
  ".cute-logo-char{fill:#fff}",

  ".cute-icon{color:#333}",

  ".cute-nposts{padding-right:20px}",
  ".cute-nposts:after{",
  "  content:counter(p);display:inline-block;width:35px;text-align:right;",
  "}",

  ".cute-nsecs{",
  "  display:inline-block;width:35px;text-align:right;",
  "  cursor:default;user-select:none;",
  "  -ms-user-select:none;-moz-user-select:none;-webkit-user-select:none;",
  "}",

  ".cute-settings{",
  "  z-index:1000;background:#f1f1f1;",
  "  border:1px solid #ccc;border-right-width:0;",
  "  position:fixed;right:0;bottom:45px;padding:5px;",
  "}",
  ".cute-checkbox{margin-top:0!important;cursor:pointer}",

  ".cute-backdrop{position:fixed;z-index:2000;left:0;right:0;top:0;bottom:0}",
  ".cute-sticker-popup{",
  "  position:fixed;left:50%;top:50%;",
  "  width:800px;height:800px;margin-left:-400px;margin-top:-400px;",
  "  background:#f1f1f1;border-radius:15px;border:1px solid #ccc;",
  "}",
  ".cute-sticker-title{text-align:center;margin-bottom:20px}",
  ".cute-sticker-list{",
  "  height:722px;overflow-y:auto;display:flex;flex-wrap:wrap;",
  "  padding:10px;justify-content:center;",
  "}",
  ".cute-sticker-item{",
  "  width:20%;text-align:center;",
  "  line-height:200px;vertical-align:middle;",
  "}",
  ".cute-sticker-img{",
  "  max-width:100%;padding:3px;cursor:pointer;user-select:none;",
  "  -ms-user-select:none;-moz-user-select:none;-webkit-user-select:none;",
  "}",
  ".cute-sticker-img:hover{border:3px solid orange;padding:0}",
].join(""));

var ZOOM_STEP = 100;
var UPDATE_SECS = 15;
var LOAD_BYTES1 = 100 * 1024;
var LOAD_BYTES2 = 600 * 1024;
var THUMB_SIZE = 200;
var THUMB_VERSION = 2;
var THUMB_SERVICE = "bnw-thmb.r.worldssl.net";
var UPLOAD_HOSTS = [
  {host: "safe.moe", maxSizeMB: 200, api: "loli-safe"},
  {host: "pomf.space", maxSizeMB: 256, api: "pomf"},
  {host: "doko.moe", maxSizeMB: 2048, api: "pomf"},
  {host: "null.vg", maxSizeMB: 128, api: "pomf"},
  {host: "memenet.org", maxSizeMB: 128, api: "pomf"},
  {host: "mixtape.moe", maxSizeMB: 100, api: "pomf"},
  {host: "lewd.es", maxSizeMB: 500, api: "pomf"},
];
var ALLOWED_HOSTS = [
  "a.safe.moe",
  "a.pomf.space",
  "a.doko.moe",
  "dev.null.vg",
  "i.memenet.org",
  "[a-z0-9]+.mixtape.moe",
  "p.lewd.es",
  "[a-z0-9]+.gfycat.com",
  "2ch.hk",
  "brchan.org",
  "[a-z0-9]+.4chan.org",
];
var ALLOWED_LINKS = ALLOWED_HOSTS.map(function(host) {
  host = host.replace(/\./g, "\\.");
  return new RegExp("^https://" + host + "/.+\\.(webm|mp4)$");
});
var STICKER_PACKS = [
  {name: "K-pop 0chan", albumId: "9hXjm"},
  {name: "K-pop cute", albumId: "sXBbD"},
  {name: "K-pop 8ch", albumId: "LcP00"},
];
var ICON_CUTE = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
  '  <path class="cute-logo-left" d="M50.526,20.211H461.474L424.421,444.632,256,488.421,87.579,444.632Z"/>',
  '  <path class="cute-logo-right" d="M256,57.263H427.789L398,421,256,458.105V57.263Z"/>',
  '  <path class="cute-logo-char" d="M313.682,390.441A158.327,158.327,0,0,0,370.963,353.2L316.077,298.73a81.641,81.641,0,0,1-28.487,19.823,68.455,68.455,0,0,1-33.194,4.729,66.061,66.061,0,0,1-27.458-8.775,72.412,72.412,0,0,1-20.673-18.151,74.955,74.955,0,0,1-12.529-24.65,73.442,73.442,0,0,1-2.628-28.6,72.529,72.529,0,0,1,8.195-27.151,77.355,77.355,0,0,1,17.174-21.867A68.289,68.289,0,0,1,240.511,180.4a69.138,69.138,0,0,1,28.815-2.972q23.161,2.313,42.682,19.252l62.98-44.9a163.45,163.45,0,0,0-45.164-34.672,146.954,146.954,0,0,0-53.269-15.74,144.457,144.457,0,0,0-59.276,5.964A149.272,149.272,0,0,0,167,134.858a154.179,154.179,0,0,0-36.411,44.259,148.631,148.631,0,0,0-11.459,114.754,154.072,154.072,0,0,0,26.94,50.585,149.131,149.131,0,0,0,43.843,36.917,144.471,144.471,0,0,0,56.926,17.567A147.054,147.054,0,0,0,313.682,390.441Z"/>',
  "</svg>",
].join("");

var updateBtn = null;
var tid = null;
var secs = 0;
var unread = 0;
var lastSel = null;
var lastUrl = "";

var Favicon = (function() {
  var c = document.createElement("canvas");
  var ctx = c.getContext("2d");
  var link = document.querySelector("link[rel=icon]");
  var origURL = link.href;
  var orig = new Image();
  orig.addEventListener("load", function() {
    c.width = orig.width;
    c.height = orig.height;
  });
  orig.src = origURL;
  return {
    set: function(n) {
      if (n <= 0) {
        this.reset();
        return;
      }
      n = Math.min(n, 9);
      // TODO: Wait for favicon load.
      ctx.drawImage(orig, 0, 0);
      ctx.fillStyle = "#f00";
      ctx.fillRect(8, 5, 8, 11);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(n, 8, 15);
      link.href = c.toDataURL();
    },
    reset: function() {
      link.href = origURL;
    },
  };
})();

var Imgur = (function() {
  // https://github.com/eirikb/gifie/blob/gh-pages/app.js
  var CLIENT_ID = "6a5400948b3b376";
  var API_ENDPOINT = "https://api.imgur.com/3";
  var STATIC_HOST = "i.imgur.com";
  var PNG_RE = new RegExp("^https://" +
                          STATIC_HOST.replace(/\./g, "\\.") +
                          "/(\\w+)\\.png$");

  var api = function(url) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      url = API_ENDPOINT + url;
      xhr.open("GET", url, true);
      xhr.setRequestHeader("Authorization", "Client-ID " + CLIENT_ID);
      xhr.onload = function() {
        if (this.status >= 200 && this.status < 400) {
          resolve(JSON.parse(this.responseText));
        } else {
          reject(new Error(this.responseText));
        }
      };
      xhr.onerror = reject;
      xhr.send();
    });
  };

  return {
    isPngUrl: function(url) {
      return PNG_RE.test(url);
    },
    getImageId: function(url) {
      var m = url.match(PNG_RE);
      if (m) {
        return m[1];
      }
    },
    getImageInfo: function(imageId) {
      return api("/image/" + imageId).then(function(res) {
        return res.data;
      });
    },
    getAlbumImages: function(albumId) {
      return api("/album/" + albumId + "/images").then(function(res) {
        return res.data.filter(function(item) {
          return item.type === "image/png";
        }).map(function(item) {
          return "https://" + STATIC_HOST + "/" + item.id + ".png";
        });
      });
    },
  };
})();

var Settings = (function() {
  var KEY = "cute_settings";
  var DEFAULTS = {
    popupBackdrop: true,
  };
  var getAll = function() {
    var cfg = null;
    try {
      cfg = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      /* skip */
    }
    return Object.assign({}, DEFAULTS, cfg);
  };
  return {
    get: function(name) {
      return getAll()[name];
    },
    set: function(name, value) {
      var cfg = getAll();
      cfg[name] = value;
      localStorage.setItem(KEY, JSON.stringify(cfg));
    },
  };
})();

var Panel = (function() {
  var panel = document.createElement("div");
  panel.className = "cute-panel";
  var settings = null;

  var logo = document.createElement("span");
  logo.className = "cute-logo";
  logo.innerHTML = ICON_CUTE;
  logo.addEventListener("click", function() {
    settings.classList.toggle("hidden");
  });

  var nposts = document.createElement("span");
  nposts.className = "cute-nposts";
  var iconPost = document.createElement("i");
  iconPost.className = "fa fa-comments cute-icon";

  var btnUpd = document.createElement("span");
  var iconUpd = document.createElement("i");
  iconUpd.className = "fa fa-refresh cute-icon";
  var nsecs = document.createElement("span");
  nsecs.className = "cute-nsecs";

  settings = document.createElement("div");
  settings.className = "cute-settings";
  var form = document.createElement("form");
  var backdrop = document.createElement("div");
  backdrop.className = "checkbox";
  var lbBackdrop = document.createElement("label");
  var chBackdrop = document.createElement("input");
  chBackdrop.className = "cute-checkbox";
  chBackdrop.setAttribute("type", "checkbox");
  chBackdrop.checked = Settings.get("popupBackdrop");
  chBackdrop.addEventListener("change", function() {
    Settings.set("popupBackdrop", chBackdrop.checked);
  });
  lbBackdrop.appendChild(chBackdrop);
  var tBackdrop = " Закрывать картинки/видео по нажатию на фон";
  lbBackdrop.appendChild(document.createTextNode(tBackdrop));
  backdrop.appendChild(lbBackdrop);
  form.appendChild(backdrop);
  settings.appendChild(form);

  panel.appendChild(logo);
  nposts.appendChild(iconPost);
  panel.appendChild(nposts);
  btnUpd.appendChild(iconUpd);
  btnUpd.appendChild(nsecs);
  panel.appendChild(btnUpd);

  return {
    embedToThread: function(container) {
      settings.classList.add("hidden");
      container.appendChild(panel);
      container.appendChild(settings);
    },
    setUpdateCounter: function(n) {
      nsecs.textContent = n;
    },
  };
})();

function isVideoUrl(url) {
  return ALLOWED_LINKS.some(function(re) {
    return re.test(url);
  });
}

function getContentSize(headers) {
  var range = headers
    .split("\r\n")
    .find(function(h) { return /^content-range:/i.test(h); });
  if (!range) return 0;
  return +range.split("/", 2)[1] || 0;
}

// Ported from 4chan-x (MIT).
function getMatroskaTitle(data) {
  var i = 0;
  var element = 0;
  var size = 0;
  var title = "";

  var readInt = function() {
    var n = data[i++];
    var len = 0;
    while (n < (0x80 >> len)) {
      len++;
    }
    n ^= (0x80 >> len);
    while (len-- && i < data.length) {
      n = (n << 8) ^ data[i++];
    }
    return n;
  };

  while (i < data.length) {
    element = readInt();
    size = readInt();
    if (size < 0) break;
    if (element === 0x3BA9) {  // Title
      while (size-- && i < data.length) {
        title += String.fromCharCode(data[i++]);
      }
      return decodeURIComponent(escape(title));  // UTF-8 decoding
    } else if (element !== 0x8538067 &&  // Segment
               element !== 0x549A966) {  // Info
      i += size;
    }
  }

  return "";
}

// See <https://stackoverflow.com/a/17862644>.
function hqDownsampleInPlace(src, dst) {
  var tmp = null;
  var cW = src.width;
  var cH = src.height;
  var dW = dst.width;
  var dH = dst.height;
  do {
    cW = Math.floor(cW / 2);
    cH = Math.floor(cH / 2);
    if (cW < dW) cW = dW;
    if (cH < dH) cH = dH;
    dst.width = cW;
    dst.height = cH;
    dst.getContext("2d").drawImage(src, 0, 0, cW, cH);
    tmp = src;
    src = dst;
    dst = tmp;
  } while (cW > dW || cH > dH);
  return src;
}

function pad2(n) {
  n |= 0;
  return (n < 10 ? "0" : "") + n;
}

function showTime(duration) {
  return pad2(duration / 60) + ":" + pad2(duration % 60);
}

function clearThumbCache() {
  Object.keys(localStorage).filter(function(k) {
    return k.startsWith("thumb_") || k.startsWith("meta_");
  }).forEach(localStorage.removeItem.bind(localStorage));
}

function setCacheItem(name, value) {
  try {
    localStorage.setItem(name, value);
  } catch (e) {
    if (e.name !== "QuotaExceededError" &&
        e.name !== "NS_ERROR_DOM_QUOTA_REACHED") {
      throw e;
    }
    clearThumbCache();
    localStorage.setItem(name, value);
  }
}

function hasMetadataInCache(url) {
  return localStorage.getItem("meta_" + url) !== null;
}

function getMetadataFromCache(url) {
  var meta = localStorage.getItem("meta_" + url);
  try {
    if (!meta) throw new Error();
    return JSON.parse(meta);
  } catch (e) {
    return {size: 0, width: 0, height: 0, duration: 0, title: ""};
  }
}

function saveMetadataToCache(url, meta) {
  meta = Object.assign({}, getMetadataFromCache(url), meta);
  setCacheItem("meta_" + url, JSON.stringify(meta));
}

function loadVideoData(url, limit) {
  return new Promise(function(resolve, reject) {
    GM_xmlhttpRequest({
      url: url,
      method: "GET",
      responseType: "arraybuffer",
      headers: {
        Range: "bytes=0-" + (limit - 1),
      },
      onload: function(res) {
        if (res.status >= 200 && res.status < 400) {
          var size = getContentSize(res.responseHeaders);
          saveMetadataToCache(url, {size: size});
          resolve(new Uint8Array(res.response));
        } else {
          reject(new Error("HTTP " + res.status));
        }
      },
      onerror: reject,
    });
  });
}

function setVideoMeta(url, vid, videoData) {
  var width = vid.videoWidth;
  var height = vid.videoHeight;
  var duration = vid.duration;
  var title = url.endsWith(".mp4") ? "" : getMatroskaTitle(videoData);
  saveMetadataToCache(url, {
    width: width,
    height: height,
    duration: duration,
    title: title,
  });
}

function loadVideo(url, videoData) {
  return new Promise(function(resolve, reject) {
    var type = url.endsWith(".mp4") ? "video/mp4" : "video/webm";
    var blob = new Blob([videoData], {type: type});
    var blobURL = URL.createObjectURL(blob);
    var vid = document.createElement("video");
    vid.muted = true;
    vid.addEventListener("loadeddata", function() {
      if ((vid.mozDecodedFrames == null ||
           vid.mozDecodedFrames > 0)
          &&
          (vid.webkitDecodedFrameCount == null ||
           vid.webkitDecodedFrameCount > 0)) {
        setVideoMeta(url, vid, videoData);
        resolve(vid);
      } else {
        reject(new Error("partial data"));
      }
    });
    vid.addEventListener("error", function() {
      reject(new Error("can't load"));
    });
    vid.src = blobURL;
  });
}

function makeScreenshot(vid) {
  return new Promise(function(resolve/*, reject*/) {
    var c = document.createElement("canvas");
    var ctx = c.getContext("2d");
    c.width = vid.videoWidth;
    c.height = vid.videoHeight;
    ctx.drawImage(vid, 0, 0);
    resolve(c);
  });
}

function makeThumbnail(src) {
  return new Promise(function(resolve/*, reject*/) {
    var dst = document.createElement("canvas");
    if (src.width > src.height) {
      dst.width = THUMB_SIZE;
      dst.height = Math.round(THUMB_SIZE * src.height / src.width);
    } else {
      dst.width = Math.round(THUMB_SIZE * src.width / src.height);
      dst.height = THUMB_SIZE;
    }
    resolve(hqDownsampleInPlace(src, dst).toDataURL("image/jpeg"));
  });
}

function getVolumeFromCache() {
  return +localStorage.getItem("webm_volume") || 0;
}

function saveVolumeToCache(volume) {
  setCacheItem("webm_volume", volume);
}

function getThumbFromCache(url) {
  var key = "thumb_v" + THUMB_VERSION + "_" + url;
  return localStorage.getItem(key);
}

function saveThumbToCache(url, thumb) {
  var key = "thumb_v" + THUMB_VERSION + "_" + url;
  setCacheItem(key, thumb);
}

function createVideoAttachment(link, thumb) {
  var meta = getMetadataFromCache(link.href);

  var container = document.createElement("figure");
  container.className = "post-img";

  var labels = document.createElement("div");
  labels.className = "post-img-labels";
  var label = document.createElement("span");
  label.className = "post-img-label post-img-gif-label";
  label.textContent = link.href.endsWith(".mp4") ? "MP4" : "WebM";

  var buttons = document.createElement("div");
  buttons.className = "post-img-buttons";
  var btnCopy = document.createElement("span");
  var iconCopy = document.createElement("i");
  btnCopy.className = "post-img-button";
  iconCopy.className = "fa fa-clipboard";
  btnCopy.title = "Copy title to clipboard";
  btnCopy.addEventListener("click", function() {
    GM_setClipboard(meta.title);
  });

  var caption = document.createElement("figcaption");
  caption.textContent += meta.width;
  caption.textContent += "×";
  caption.textContent += meta.height;
  caption.textContent += ", ";
  if (meta.size >= 1024 * 1024) {
    caption.textContent += (meta.size / 1024 / 1024).toFixed(2);
    caption.textContent += "Мб";
  } else {
    caption.textContent += (meta.size / 1024).toFixed(2);
    caption.textContent += "Кб";
  }
  if (meta.duration) {
    caption.textContent += ", ";
    caption.textContent += showTime(Math.round(meta.duration));
  }

  var a = document.createElement("a");
  a.href = link.href;
  a.title = meta.title;
  a.setAttribute("target", "_blank");

  var img = document.createElement("img");
  img.className = "post-img-thumbnail";
  img.src = thumb;

  labels.appendChild(label);
  container.appendChild(labels);
  btnCopy.appendChild(iconCopy);
  buttons.appendChild(btnCopy);
  if (meta.title) container.appendChild(buttons);
  container.appendChild(caption);
  a.appendChild(img);
  container.appendChild(a);
  return container;
}

function createImageAttachment(link, thumb) {
  var meta = getMetadataFromCache(link.href);

  var container = document.createElement("figure");
  container.className = "post-img";

  var caption = document.createElement("figcaption");
  caption.textContent += meta.width;
  caption.textContent += "×";
  caption.textContent += meta.height;
  caption.textContent += ", ";
  caption.textContent += (meta.size / 1024).toFixed(2);
  caption.textContent += "Кб";

  var a = document.createElement("a");
  a.href = link.href;
  a.setAttribute("target", "_blank");

  var img = document.createElement("img");
  img.className = "post-img-thumbnail";
  img.src = thumb;

  container.appendChild(caption);
  a.appendChild(img);
  container.appendChild(a);
  return container;
}

function embedAttachment(post, link, attachment) {
  var body = post.querySelector(".post-body");
  var attachments = body.querySelector(".post-attachments");
  if (attachments) {
    body.classList.remove("post-inline-attachment");
  } else {
    attachments = document.createElement("div");
    attachments.className = "post-attachments";
    body.insertBefore(attachments, body.firstChild);
    body.classList.add("post-inline-attachment");
  }
  attachments.appendChild(attachment);
  var next = link.nextElementSibling;
  if (next && next.tagName === "BR") {
    next.remove();
  }
  link.remove();
}

function embedVideo(post, link) {
  var hasMeta = hasMetadataInCache(link.href);
  var cachedThumb = getThumbFromCache(link.href);
  var part1 = function(limit) {
    return loadVideoData(link.href, limit)
      .then(loadVideo.bind(null, link.href))
      .then(makeScreenshot)
      .then(makeThumbnail);
  };
  var part2 = function(thumb) {
    return new Promise(function(resolve/*, reject*/) {
      embedAttachment(post, link, createVideoAttachment(link, thumb));
      if (!cachedThumb) {
        saveThumbToCache(link.href, thumb);
      }
      resolve();
    });
  };
  var partErr = function(e) {
    /* eslint-disable no-console */
    console.error("[0chan-webm] Failed to embed " + link.href +
                  " : " + e.message);
    /* eslint-enable no-console */
  };

  if (cachedThumb && hasMeta) {
    part2(cachedThumb).catch(partErr);
  } else {
    part1(LOAD_BYTES1).then(function(thumb) {
      part2(thumb).catch(partErr);
    }, function(e) {
      if ((e.message || "").startsWith("HTTP ")) {
        partErr(e);
      } else {
        part1(LOAD_BYTES2).then(part2).catch(partErr);
      }
    });
  }
}

function embedImage(post, link) {
  var embed = function() {
    var thumb = getThumbUrl(link.href);
    embedAttachment(post, link, createImageAttachment(link, thumb));
  };

  if (hasMetadataInCache(link.href)) {
    embed();
  } else {
    var imageId = Imgur.getImageId(link.href);
    Imgur.getImageInfo(imageId).then(function(info) {
      saveMetadataToCache(link.href, {
        size: info.size,
        width: info.width,
        height: info.height,
      });
      embed();
    });
  }
}

function handlePost(post) {
  var links = post.querySelectorAll("a[target=_blank]");
  Array.prototype.forEach.call(links, function(link) {
    if (isVideoUrl(link.href)) {
      embedVideo(post, link);
    } else if (Imgur.isPngUrl(link.href)) {
      embedImage(post, link);
    }
  });
}

function uploadXHR(host, data) {
  return new Promise(function(resolve, reject) {
    if (host.api === "loli-safe") {
      var url = "https://" + host.host + "/api/upload";
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.onload = resolve.bind(null, xhr);
      xhr.onerror = reject;
      xhr.send(data);
    } else if (host.api === "pomf") {
      GM_xmlhttpRequest({
        url: "https://" + host.host + "/upload.php",
        method: "POST",
        data: data,
        onload: resolve,
        onerror: reject,
      });
    } else {
      reject(new Error("unknown upload API"));
    }
  });
}

function getFileURL(host, file) {
  if (host.host === "doko.moe") {
    // WTF, doko?
    return "https://a.doko.moe/" + file.url;
  } else {
    return file.url;
  }
}

function upload(host, files) {
  var form = new FormData();
  Array.prototype.forEach.call(files, function(file) {
    form.append("files[]", file);
  });
  return uploadXHR(host, form).then(function(res) {
    if (res.status >= 400) throw new Error("HTTP " + res.status);
    var info = JSON.parse(res.responseText);
    if (!info.success) throw new Error(info.description.code);
    return info.files.map(getFileURL.bind(null, host));
  });
}

function quoteText(text) {
  return text.trim().split(/\n/).filter(function(line) {
    return line.length > 0;
  }).map(function(line) {
    return ">" + line;
  }).join("\n") + "\n";
}

function flushInput(textarea, text) {
  if (text != null) {
    textarea.value = text;
  }
  textarea.dispatchEvent(new Event("input"));
}

function prependText(textarea, text, sep) {
  sep = sep || "\n";
  textarea.value = textarea.value ? (text + sep + textarea.value) : text;
  flushInput(textarea);
  textarea.focus();
}

function addText(textarea, text, sep) {
  sep = sep || "\n";
  textarea.value = textarea.value ? (textarea.value + sep + text) : text;
  flushInput(textarea);
  textarea.focus();
}

function quoteSelected(form, textarea) {
  if (lastSel && !lastSel.isCollapsed) {
    var post = form.parentNode.previousElementSibling;
    if (post && post.classList.contains("post") &&
        post.contains(lastSel.focusNode)) {
      flushInput(textarea, quoteText(lastSel.toString()));
    }
  }
  lastSel = null;
}

function formatSelected(textarea, markup) {
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var text = textarea.value;
  var sel = text.slice(start, end);
  markup = typeof markup === "function" ? markup(sel) : markup;
  if (start < end) {
    text = text.slice(0, start) +
           markup + sel + markup +
           text.slice(end);
    flushInput(textarea, text);
    textarea.focus();
  } else {
    addText(textarea, markup + markup, " ");
    var caret = textarea.value.length - markup.length;
    textarea.setSelectionRange(caret, caret);
  }
}

function getThumbUrl(origUrl) {
  return "https://" + THUMB_SERVICE + "/unsafe/fit-in/" +
         THUMB_SIZE + "x" + THUMB_SIZE + "/" +
         origUrl;
}

function openStickerPopup(pack) {
  var destroy = null;
  var backdrop = document.createElement("div");
  backdrop.className = "cute-backdrop";
  var popup = document.createElement("div");
  popup.className = "cute-sticker-popup";
  var title = document.createElement("h3");
  title.className = "cute-sticker-title";
  title.textContent = "Стикер-пак «" + pack.name + "»";
  var stickers = document.createElement("div");
  stickers.className = "cute-sticker-list";
  // TODO: Progress, error handling.
  Imgur.getAlbumImages(pack.albumId).then(function(urls) {
    urls.forEach(function(url) {
      var item = document.createElement("div");
      item.className = "cute-sticker-item";
      var img = document.createElement("img");
      img.className = "cute-sticker-img";
      img.src = getThumbUrl(url);
      // TODO: Use single bubbling event listener.
      img.addEventListener("click", function() {
        var textarea = getVisibleTextarea();
        if (textarea) {
          prependText(textarea, url);
          destroy();
        }
      });
      item.appendChild(img);
      stickers.appendChild(item);
    });
  });
  popup.appendChild(title);
  popup.appendChild(stickers);
  backdrop.appendChild(popup);

  var handleBackdropClick = function() {
    destroy();
  };
  var handlePopupClick = function(e) {
    e.stopPropagation();
  };
  var handleKey = function(e) {
    if (e.keyCode === 27) {
      destroy();
    }
  };
  var create = function() {
    document.body.appendChild(backdrop);
    document.addEventListener("keydown", handleKey);
    popup.addEventListener("click", handlePopupClick);
    backdrop.addEventListener("click", handleBackdropClick);
  };
  destroy = function() {
    document.removeEventListener("keydown", handleKey);
    backdrop.remove();
  };

  create();
}

function embedFormatButtons(form, textarea) {
  var line = textarea.previousElementSibling;
  line.style.lineHeight = "22px";

  var buttons = document.createElement("div");
  buttons.style.float = "right";

  var btnBold = document.createElement("span");
  btnBold.className = "btn btn-xs btn-default";
  btnBold.style.marginRight = "2px";
  btnBold.addEventListener("click", formatSelected.bind(null, textarea, "**"));
  var iconBold = document.createElement("i");
  iconBold.className = "fa fa-bold";

  var btnItalic = document.createElement("span");
  btnItalic.className = "btn btn-xs btn-default";
  btnItalic.style.marginRight = "2px";
  btnItalic.addEventListener("click", formatSelected.bind(null, textarea, "*"));
  var iconItalic = document.createElement("i");
  iconItalic.className = "fa fa-italic";

  var btnStrike = document.createElement("span");
  btnStrike.className = "btn btn-xs btn-default";
  btnStrike.style.marginRight = "2px";
  btnStrike.addEventListener("click", formatSelected.bind(null, textarea, "-"));
  var iconStrike = document.createElement("i");
  iconStrike.className = "fa fa-strikethrough";

  var btnSpoiler = document.createElement("span");
  btnSpoiler.className = "btn btn-xs btn-default";
  btnSpoiler.style.marginRight = "2px";
  var cbSpoiler = formatSelected.bind(null, textarea, "%%");
  btnSpoiler.addEventListener("click", cbSpoiler);
  var iconSpoiler = document.createElement("i");
  iconSpoiler.className = "fa fa-eye-slash";

  var btnCode = document.createElement("span");
  btnCode.className = "btn btn-xs btn-default";
  btnCode.style.marginRight = "2px";
  btnCode.addEventListener("click", function() {
    formatSelected(textarea, function(sel) {
      return sel.includes("\n") ? "```" : "`";
    });
  });
  var iconCode = document.createElement("i");
  iconCode.className = "fa fa-code";

  var btnBullet = document.createElement("span");
  btnBullet.className = "btn btn-xs btn-default";
  btnBullet.style.marginRight = "2px";
  btnBullet.addEventListener("click", function() {
    addText(textarea, "• ");
  });
  var iconBullet = document.createElement("i");
  iconBullet.className = "fa fa-list-ul";

  var dropdown = document.createElement("div");
  dropdown.className = "btn-group";
  var btnSticker = document.createElement("span");
  btnSticker.className = "btn btn-xs btn-default dropdown-toggle";
  btnSticker.addEventListener("click", function() {
    dropdown.classList.toggle("open");
  });
  var iconSticker = document.createElement("i");
  iconSticker.className = "fa fa-sticky-note";
  var menu = document.createElement("ul");
  menu.className = "dropdown-menu";
  STICKER_PACKS.forEach(function(pack) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.textContent = pack.name;
    link.addEventListener("click", function() {
      dropdown.classList.remove("open");
      openStickerPopup(pack);
    });
    item.appendChild(link);
    menu.appendChild(item);
  });

  btnBold.appendChild(iconBold);
  buttons.appendChild(btnBold);
  btnItalic.appendChild(iconItalic);
  buttons.appendChild(btnItalic);
  btnStrike.appendChild(iconStrike);
  buttons.appendChild(btnStrike);
  btnSpoiler.appendChild(iconSpoiler);
  buttons.appendChild(btnSpoiler);
  btnCode.appendChild(iconCode);
  buttons.appendChild(btnCode);
  btnBullet.appendChild(iconBullet);
  buttons.appendChild(btnBullet);
  btnSticker.appendChild(iconSticker);
  dropdown.appendChild(btnSticker);
  dropdown.appendChild(menu);
  buttons.appendChild(dropdown);
  line.appendChild(buttons);
}

function embedUpload(container) {
  var input = null;
  var textarea = container.querySelector("textarea");
  var buttons = container.querySelector(".attachment-btns");

  var dropdown = document.createElement("div");
  dropdown.className = "btn-group";
  var button = document.createElement("button");
  button.className = "btn btn-xs btn-default dropdown-toggle";
  button.style.marginLeft = "3px";
  button.addEventListener("click", function() {
    dropdown.classList.toggle("open");
  });
  var icon = document.createElement("i");
  icon.className = "fa fa-file-video-o";
  var caret = document.createElement("span");
  caret.className = "caret";

  var menu = document.createElement("ul");
  menu.className = "dropdown-menu";
  var selectedHost = null;
  UPLOAD_HOSTS.forEach(function(host) {
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.textContent = "Через " + host.host + " (" + host.maxSizeMB + "Мб)";
    link.addEventListener("click", function() {
      selectedHost = host;
      dropdown.classList.remove("open");
      input.click();
    });
    item.appendChild(link);
    menu.appendChild(item);
  });

  input = document.createElement("input");
  input.style.display = "none";
  input.setAttribute("name", "files");
  input.setAttribute("type", "file");
  input.setAttribute("accept", "video/*");
  input.multiple = true;
  input.addEventListener("change", function() {
    button.disabled = true;
    icon.classList.remove("fa-file-video-o");
    icon.classList.add("fa-spinner", "fa-spin", "fa-fw");
    upload(selectedHost, input.files).then(function(urls) {
      prependText(textarea, urls.join(" "));
    }, function(e) {
      var app = unsafeWindow.app;
      var msg = e.message || "network error";
      app.$bus.emit("alertError", "Upload failed\n\n" + msg);
    }).then(function() {
      button.disabled = false;
      icon.classList.remove("fa-spinner", "fa-spin", "fa-fw");
      icon.classList.add("fa-file-video-o");
      input.value = null;
    });
  });

  button.appendChild(icon);
  button.appendChild(document.createTextNode(" Прикрепить "));
  button.appendChild(caret);
  dropdown.appendChild(button);
  dropdown.appendChild(menu);
  buttons.parentNode.appendChild(input);
  buttons.appendChild(dropdown);

  quoteSelected(container, textarea);
  embedFormatButtons(container, textarea);
}

function handlePosts(container) {
  Array.prototype.forEach.call(container.querySelectorAll(".post"), handlePost);
}

function handleThread(container) {
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      Array.prototype.forEach.call(mutation.addedNodes, function(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.classList.contains("post-popup")) {
          handlePost(node);
        } else if (node.parentNode.classList.contains("thread-tree")) {
          handlePost(node);
          if (document.hidden) {
            unread += 1;
            Favicon.set(unread);
          }
        } else if (node.classList.contains("thread-tree")) {
          handlePosts(node);
          if (document.hidden) {
            unread += node.querySelectorAll(".post").length;
            Favicon.set(unread);
          }
        } else if (node.classList.contains("reply-form")) {
          embedUpload(node);
        }
      });
    });
  });
  observer.observe(container, {childList: true, subtree: true});
  handlePosts(container);
  embedUpload(document.querySelector(".reply-form"));
}

function handleThreads(container) {
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      Array.prototype.forEach.call(mutation.addedNodes, function(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.parentNode === container) {
          handlePosts(node);
        } else if (node.classList.contains("post-popup")) {
          handlePost(node);
        } else if (node.classList.contains("reply-form")) {
          embedUpload(node);
        }
      });
    });
  });
  observer.observe(container, {childList: true, subtree: true});
  handlePosts(container);
  embedUpload(document.querySelector(".reply-form"));
}

function update() {
  if (secs <= 1) {
    secs = UPDATE_SECS;
    if (!updateBtn.querySelector(".fa-spin")) {
      updateBtn.click();
    }
  } else {
    secs -= 1;
  }
  if (!document.hidden) {
    Panel.setUpdateCounter(secs);
  }
  tid = setTimeout(update, 1000);
}

function initUpdater(container) {
  if (tid == null) {
    secs = UPDATE_SECS;
    Panel.setUpdateCounter(secs);
    Panel.embedToThread(container);
    tid = setTimeout(update, 1000);
  }
}

function clearUpdater() {
  if (tid != null) {
    clearTimeout(tid);
    tid = null;
    unread = 0;
    Favicon.reset();
  }
}

function disabledScroll() {}

function disableScrollToPost() {
  try {
    // Someone please kill me.
    var threadObj = unsafeWindow.app.$children[0].$children[5].$children[0];
    threadObj.scrollToPost = typeof exportFunction === "undefined"
      ? disabledScroll
      : exportFunction(disabledScroll, unsafeWindow);
  } catch (e) {
    /* skip */
  }
}

function handleNavigation() {
  var singleThread = document.querySelector(".threads");
  var firstThread = document.querySelector(".thread");
  var container = document.querySelector("#content");
  clearUpdater();
  updateBtn = null;
  if (singleThread) {
    updateBtn = singleThread.querySelector(":scope > .btn-group .btn-default");
    handleThread(singleThread);
    initUpdater(singleThread);
    disableScrollToPost();
  } else if (firstThread) {
    handleThreads(firstThread.parentNode.parentNode);
  } else if (container && !container.children.length) {
    var observer = new MutationObserver(function() {
      observer.disconnect();
      firstThread = container.querySelector(".thread");
      if (firstThread) {
        handleThreads(firstThread.parentNode.parentNode);
      }
    });
    observer.observe(container, {childList: true});
  }
}

function getNavHandler() {
  return typeof exportFunction === "undefined"
    ? handleNavigation
    : exportFunction(handleNavigation, unsafeWindow);
}

function handleApp(container) {
  var app = unsafeWindow.app;
  if (app && app.$bus) {
    app.$bus.on("refreshContentDone", getNavHandler());
    return;
  }
  var observer = new MutationObserver(function() {
    var app = unsafeWindow.app;
    if (!app || !app.$bus) return;
    observer.disconnect();
    app.$bus.on("refreshContentDone", getNavHandler());
  });
  observer.observe(container, {childList: true});
}

function getVisibleTextarea() {
  var nodes = document.querySelectorAll(".reply-form textarea");
  return Array.prototype.find.call(nodes, function(node) {
    // See <https://stackoverflow.com/a/21696585>.
    return node.offsetParent !== null;
  });
}

function getTextareaPost(textarea) {
  var form = textarea.parentNode.parentNode;
  var post = form.parentNode.previousElementSibling;
  if (post && post.classList.contains("post")) {
    return post;
  }
}

function getResolution(media) {
  var raw = media.parentNode.previousElementSibling.textContent;
  var parts = raw.trim().split(/[×,]/, 2);
  return parts.map(function(n) {
    return +n;
  });
}

function openMediaPopup(src) {
  var url = src.parentNode.href;
  var isVideo = url.endsWith(".webm") || url.endsWith(".mp4");
  if (url === lastUrl) return;
  lastUrl = url;

  var res = getResolution(src);
  var w = res[0];
  var h = res[1];
  var aspect = w / h;
  var pW = window.innerWidth;
  var pH = window.innerHeight;
  w = Math.min(w, pW);
  h = Math.round(w / aspect);
  if (h > pH) {
    h = pH;
    w = Math.round(h * aspect);
  }
  var l = (pW - w) / 2;
  var t = (pH - h) / 2;

  var popup = document.createElement("div");
  popup.style.position = "fixed";
  popup.style.zIndex = "2000";
  popup.style.left = l + "px";
  popup.style.top = t + "px";

  var media = null;
  if (isVideo) {
    media = document.createElement("video");
    media.loop = true;
    media.autoplay = true;
    media.controls = true;
    media.volume = getVolumeFromCache();
    media.addEventListener("volumechange", function() {
      saveVolumeToCache(media.volume);
    });
  } else {
    media = document.createElement("img");
  }
  media.src = url;
  media.width = w;
  media.style.display = "block";
  media.style.userSelect = "none";
  media.style.msUserSelect = "none";
  media.style.MozUserSelect = "none";
  media.style.WebkitUserSelect = "none";
  popup.appendChild(media);

  var destroy = null;
  var moving = false;
  var baseX = 0;
  var baseY = 0;
  var startX = 0;
  var startY = 0;

  var isControlsClick = function(e) {
    if (isVideo) {
      // <https://stackoverflow.com/a/22928167>.
      var ctrlHeight = 50;
      var rect = media.getBoundingClientRect();
      var relY = e.clientY - rect.top;
      if (relY > rect.height - ctrlHeight) {
        return true;
      }
    }
    return false;
  };
  var handleClick = function(e) {
    if (!Settings.get("popupBackdrop")) return;
    if (e.target !== media && e.target !== updateBtn) {
      destroy();
    }
  };
  var handleKey = function(e) {
    if (e.keyCode === 27) {
      destroy();
    }
  };
  var handleMediaClick = function(e) {
    if (!isControlsClick(e)) {
      e.preventDefault();
    }
  };
  var handleMediaDrag = function(e) {
    e.preventDefault();
  };
  var handlePopupMouseDown = function(e) {
    moving = true;
    baseX = e.clientX;
    baseY = e.clientY;
    startX = popup.offsetLeft;
    startY = popup.offsetTop;
  };
  var handleMouseMove = function(e) {
    if (moving) {
      popup.style.left = (startX + e.clientX - baseX) + "px";
      popup.style.top = (startY + e.clientY - baseY) + "px";
    }
  };
  var handlePopupMouseUp = function(e) {
    moving = false;
    if (e.button === 0 && e.clientX === baseX && e.clientY === baseY) {
      if (!isControlsClick(e)) {
        destroy();
      }
    }
  };
  var handlePopupWheel = function(e) {
    e.preventDefault();
    var order = e.deltaY < 0 ? 1 : -1;
    if (w <= 50 && order < 0) return;
    w = Math.max(50, w + ZOOM_STEP * order);
    media.width = w;
    l = popup.offsetLeft - (ZOOM_STEP / 2) * order;
    t = popup.offsetTop - (ZOOM_STEP / aspect / 2) * order;
    popup.style.left = l + "px";
    popup.style.top = t + "px";
  };
  var create = function() {
    document.body.appendChild(popup);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousemove", handleMouseMove);
    media.addEventListener("click", handleMediaClick);
    media.addEventListener("dragstart", handleMediaDrag);
    popup.addEventListener("mousedown", handlePopupMouseDown);
    popup.addEventListener("mouseup", handlePopupMouseUp);
    popup.addEventListener("wheel", handlePopupWheel);
  };
  destroy = function() {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("keydown", handleKey);
    document.removeEventListener("click", handleClick, true);
    popup.remove();
    if (url === lastUrl) lastUrl = "";
  };

  create();
}

function handleClick(e) {
  var node = e.target;
  var nodeUp = node.parentElement;
  if (nodeUp && nodeUp.classList.contains("post-id")) {
    var textarea = getVisibleTextarea();
    if (textarea) {
      e.preventDefault();
      e.stopPropagation();
      var sel = window.getSelection();
      var post = nodeUp.parentNode.parentNode;
      var quote = ">>" + node.textContent.trim().slice(1) + "\n";
      if (!sel.isCollapsed && post.contains(sel.focusNode)) {
        if (textarea.value.includes(quote) ||
            getTextareaPost(textarea) === post) {
          // Already cited post id.
          quote = "";
        }
        quote += quoteText(sel.toString());
      }
      addText(textarea, quote);
    }
  } else if (node.classList.contains("post-img-thumbnail") && e.button === 0) {
    e.preventDefault();
    e.stopPropagation();
    openMediaPopup(node);
  }
}

function handleMouseDown(e) {
  var node = e.target;
  var nodeUp = node.parentElement;
  if (node.classList.contains("post-button-reply") ||
      (nodeUp && nodeUp.classList.contains("post-button-reply"))) {
    // Selection object is a singleton so need to clone.
    var sel = window.getSelection();
    var selText = sel.toString();
    lastSel = {
      isCollapsed: sel.isCollapsed,
      focusNode: sel.focusNode,
      toString: function() {
        return selText;
      },
    };
  }
}

function handleVisibility() {
  if (!document.hidden) {
    unread = 0;
    Favicon.reset();
  }
}

handleApp(document.body);
document.addEventListener("click", handleClick, true);
document.addEventListener("mousedown", handleMouseDown);
document.addEventListener("visibilitychange", handleVisibility);

})();
