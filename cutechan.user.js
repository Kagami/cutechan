// ==UserScript==
// @name        cutechan
// @namespace   0chan
// @description Improve 0chan user experience.
// @downloadURL https://raw.githubusercontent.com/Kagami/cutechan/master/cutechan.user.js
// @updateURL   https://raw.githubusercontent.com/Kagami/cutechan/master/cutechan.user.js
// @include     https://0chan.hk/*
// @include     http://nullchan7msxi257.onion/*
// @version     0.0.8
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

"use strict";

GM_addStyle([
  ".threads{counter-reset:p}",
  ".threads .post{counter-increment:p}",
  ".post-op,.post-deleted,.post-popup>.post{counter-increment:p 0!important}",
  '.threads .post-id:after{content:"("counter(p)")";color:#16a085}',
  '.threads .post-op .post-id:after{content:"OP";color:#cd5c5c}',
  '.threads .post-deleted .post-id:after{content:"deleted";color:#cd5c5c}',
  '.post-popup>.post .post-id:after{content:""}',

  ".cute{",
  "  z-index:1000;background:#d9d9d9;border-top:1px solid #ccc;",
  "  border-left:1px solid #ccc;padding:10px 15px;position:fixed;",
  "  right:0;bottom:0",
  "}",
  ".cute-nposts{padding-right:10px;border-right:2px solid #bbb}",
  ".cute-nposts:after{",
  "  content:counter(p);display:inline-block;width:35px;text-align:right",
  "}",
  ".cute-update{padding-left:10px}",
  ".cute-nsecs{display:inline-block;width:35px;text-align:right}",
  ".cute-icon{color:#333}",
].join(""));

var UPDATE_SECS = 15;
var LOAD_BYTES1 = 100 * 1024;
var LOAD_BYTES2 = 600 * 1024;
var THUMB_SIZE = 200;
var THUMB_VERSION = 2;
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

var updateBtn = null;
var tid = null;
var secs = 0;
var unread = 0;
var lastSel = null;

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

var Counter = (function() {
  var div = document.createElement("div");
  div.className = "cute";

  var nposts = document.createElement("span");
  nposts.className = "cute-nposts";
  var iconPost = document.createElement("i");
  iconPost.className = "cute-icon fa fa-comments";

  var btnUpd = document.createElement("span");
  btnUpd.className = "cute-update";
  var iconUpd = document.createElement("i");
  iconUpd.className = "cute-icon fa fa-refresh";
  var nsecs = document.createElement("span");
  nsecs.className = "cute-nsecs";

  nposts.appendChild(iconPost);
  div.appendChild(nposts);
  btnUpd.appendChild(iconUpd);
  btnUpd.appendChild(nsecs);
  div.appendChild(btnUpd);

  return {
    embed: function(node) {
      node.appendChild(div);
    },
    set: function(n) {
      nsecs.textContent = n;
    },
  };
})();

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

function createVideoElement(post, link, thumb) {
  var meta = getMetadataFromCache(link.href);
  var body = post.querySelector(".post-body");
  var bodyWidth = body.style.maxWidth;
  var bodyMsg = post.querySelector(".post-body-message");
  var bodyMsgHeight = bodyMsg.style.maxHeight;
  var attachments = post.querySelector(".post-inline-attachment");
  var attachHeight = attachments && attachments.style.maxHeight;
  var vid = null;
  var a = null;

  var container = document.createElement("div");
  container.className = "post-img";

  var labels = document.createElement("div");
  labels.className = "post-img-labels";
  var label = document.createElement("span");
  label.className = "post-img-label post-img-gif-label";
  label.textContent = link.href.endsWith(".mp4") ? "MP4" : "WebM";

  var btns = document.createElement("div");
  btns.className = "post-img-buttons";
  var btnCopy = document.createElement("span");
  var iconCopy = document.createElement("i");
  btnCopy.className = "post-img-button";
  iconCopy.className = "fa fa-clipboard";
  btnCopy.title = "Copy title to clipboard";
  btnCopy.addEventListener("click", function() {
    GM_setClipboard(vid.title);
  });

  var caption = document.createElement("figcaption");
  if ((meta.width && meta.height) || meta.size) {
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
  } else {
    caption.textContent = "неизвестно";
  }

  var expand = function() {
    if (attachments) attachments.style.maxHeight = "none";
    body.style.maxWidth = "1305px";
    bodyMsg.style.maxHeight = "none";
    labels.style.display = "none";
    caption.style.display = "none";
    container.replaceChild(vid, a);
    vid.volume = getVolumeFromCache();
    vid.src = link.href;
  };
  var minimize = function() {
    if (attachments) attachments.style.maxHeight = attachHeight;
    body.style.maxWidth = bodyWidth;
    bodyMsg.style.maxHeight = bodyMsgHeight;
    labels.style.display = "block";
    caption.style.display = "block";
    container.replaceChild(a, vid);
    vid.pause();
    vid.removeAttribute("src");
    vid.load();
  };

  a = document.createElement("a");
  a.style.display = "block";
  a.style.outline = "none";
  a.title = meta.title;
  a.href = link.href;
  var img = document.createElement("img");
  img.style.display = "block";
  img.src = thumb;
  a.addEventListener("click", function(e) {
    e.preventDefault();
    expand();
  });

  vid = document.createElement("video");
  vid.style.display = "block";
  vid.style.maxWidth = "100%";
  vid.style.maxHeight = "960px";
  vid.style.cursor = "pointer";
  vid.loop = true;
  vid.autoplay = true;
  vid.controls = true;
  vid.title = meta.title;
  vid.addEventListener("click", function(e) {
    // <https://stackoverflow.com/a/22928167>.
    var ctrlHeight = 50;
    var rect = vid.getBoundingClientRect();
    var relY = e.clientY - rect.top;
    if (relY < rect.height - ctrlHeight) {
      minimize();
    }
  });
  vid.addEventListener("volumechange", function() {
    saveVolumeToCache(vid.volume);
  });

  labels.appendChild(label);
  btnCopy.appendChild(iconCopy);
  btns.appendChild(btnCopy);
  a.appendChild(img);
  container.appendChild(labels);
  if (meta.title) container.appendChild(btns);
  container.appendChild(caption);
  container.appendChild(a);
  return container;
}

function getThumbFromCache(url) {
  var key = "thumb_v" + THUMB_VERSION + "_" + url;
  return localStorage.getItem(key);
}

function saveThumbToCache(url, thumb) {
  var key = "thumb_v" + THUMB_VERSION + "_" + url;
  setCacheItem(key, thumb);
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
      var div = createVideoElement(post, link, thumb);
      link.parentNode.replaceChild(div, link);
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

function handlePost(post) {
  var links = post.querySelectorAll("a[target=_blank]");
  Array.prototype.filter.call(links, function(link) {
    return ALLOWED_LINKS.some(function(re) {
      return re.test(link.href);
    });
  }).forEach(embedVideo.bind(null, post));
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
  return text.trim().split(/\n/).map(function(line) {
    return ">" + line;
  }).join("\n") + "\n";
}

function quoteSelected(form, textarea) {
  if (lastSel && !lastSel.isCollapsed) {
    var post = form.parentNode.previousElementSibling;
    if (post && post.classList.contains("post") &&
        post.contains(lastSel.focusNode)) {
      textarea.value = quoteText(lastSel.toString());
    }
  }
  lastSel = null;
}

function handleReply(e) {
  var node = e.target.parentElement;
  if (node && node.classList.contains("post-button-reply")) {
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

function embedUpload(container) {
  var input = null;
  var textarea = container.querySelector("textarea");
  var addText = function(text) {
    textarea.value = textarea.value ? (text + "\n" + textarea.value) : text;
  };

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
      addText(urls.join(" "));
    }, function(e) {
      var app = unsafeWindow.app;
      var msg = e.message || "network error";
      app.$bus.emit("alertError", "Upload failed\n\n" + msg);
    }).then(function() {
      button.disabled = false;
      icon.classList.remove("fa-spinner", "fa-spin", "fa-fw");
      icon.classList.add("fa-file-video-o");
      input.value = null;
      textarea.dispatchEvent(new Event("input"));
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
    Counter.set(secs);
  }
  tid = setTimeout(update, 1000);
}

function initUpdater(container) {
  if (tid == null) {
    secs = UPDATE_SECS;
    Counter.set(secs);
    Counter.embed(container);
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

function handleVisibility() {
  if (!document.hidden) {
    unread = 0;
    Favicon.reset();
  }
}

handleApp(document.body);
window.addEventListener("mousedown", handleReply);
document.addEventListener("visibilitychange", handleVisibility);
