import { createFileRoute } from "@tanstack/react-router";

// Self-host base — the loader points back at this same origin for the chat proxy.
const ORIGIN = "https://ogstreamz.lovable.app";

const LOADER_JS = `(function(){
  if (window.__ogBotLoaded) return;
  window.__ogBotLoaded = true;

  var script = document.currentScript;
  var token = script && script.getAttribute("data-token") || "";
  var title = script && script.getAttribute("data-title") || "OG Bot";
  var color = script && script.getAttribute("data-color") || "#f5c542";
  var endpoint = ${JSON.stringify(ORIGIN)} + "/api/public/og-bot-chat";

  var STORE = "og-bot-embed-thread-v1";
  function loadThread(){ try { var r = localStorage.getItem(STORE); var p = r? JSON.parse(r): []; return Array.isArray(p)? p: []; } catch(e){ return []; } }
  function saveThread(t){ try { localStorage.setItem(STORE, JSON.stringify(t.slice(-50))); } catch(e){} }
  var messages = loadThread();

  function el(tag, css, text){ var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }

  // Floating launcher button
  var btn = el("button", "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:"+color+";color:#111;font-size:24px;box-shadow:0 8px 24px rgba(0,0,0,0.25);z-index:2147483646;display:flex;align-items:center;justify-content:center;", "💬");
  btn.setAttribute("aria-label","Open "+title);

  var panel = el("div", "position:fixed;bottom:88px;right:20px;width:360px;max-width:calc(100vw - 24px);height:480px;max-height:calc(100vh - 120px);background:#0f0f12;color:#f4f4f5;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.4);display:none;flex-direction:column;overflow:hidden;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;");
  var header = el("div", "padding:12px 14px;background:"+color+";color:#111;font-weight:700;display:flex;justify-content:space-between;align-items:center;", title);
  var close = el("button", "background:transparent;border:none;color:#111;font-size:20px;cursor:pointer;", "×");
  header.appendChild(close);
  var feed = el("div", "flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:14px;");
  var form = el("form", "display:flex;gap:6px;padding:10px;border-top:1px solid #27272a;background:#0f0f12;");
  var input = el("input", "flex:1;background:#18181b;color:#f4f4f5;border:1px solid #27272a;border-radius:8px;padding:8px 10px;font-size:14px;outline:none;");
  input.placeholder = "Message "+title+"…";
  var send = el("button", "background:"+color+";color:#111;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;", "Send");
  send.type = "submit";
  form.appendChild(input); form.appendChild(send);
  panel.appendChild(header); panel.appendChild(feed); panel.appendChild(form);

  function bubble(role, text){
    var wrap = el("div", "display:flex;"+(role==="user"?"justify-content:flex-end":"justify-content:flex-start")+";");
    var b = el("div", "max-width:80%;padding:8px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word;line-height:1.4;"+(role==="user"?"background:"+color+";color:#111;border-bottom-right-radius:4px;":"background:#27272a;color:#f4f4f5;border-bottom-left-radius:4px;"), text);
    wrap.appendChild(b); feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
    return b;
  }
  function render(){
    feed.innerHTML = "";
    if (messages.length === 0){
      var hint = el("div","color:#a1a1aa;text-align:center;padding:24px 12px;font-size:13px;","Say hi to "+title+" 👋");
      feed.appendChild(hint);
    }
    messages.forEach(function(m){ bubble(m.role, m.content); });
  }
  render();

  function toast(text){
    var t = el("div","position:fixed;bottom:90px;right:20px;background:#dc2626;color:#fff;padding:10px 14px;border-radius:8px;z-index:2147483647;font-family:system-ui;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.3);",text);
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 4000);
  }

  var sending = false;
  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    if (sending) return;
    var text = input.value.trim();
    if (!text) return;
    if (!token){ toast("Missing data-token on script tag"); return; }
    messages.push({ role:"user", content:text });
    saveThread(messages); render();
    input.value = "";
    sending = true; send.disabled = true; input.disabled = true;
    var typing = bubble("assistant","…");
    fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ token: token, messages: messages })
    }).then(function(r){
      return r.json().then(function(j){ return { ok:r.ok, status:r.status, body:j }; });
    }).then(function(res){
      typing.parentNode && typing.parentNode.remove();
      if (!res.ok){
        var msg = (res.body && res.body.error) || ("Error "+res.status);
        if (res.status === 401 || res.status === 403) msg = "Forbidden / Invalid token";
        toast(msg);
        messages.push({ role:"assistant", content:"⚠️ "+msg });
      } else {
        messages.push({ role:"assistant", content: (res.body && res.body.reply) || "..." });
      }
      saveThread(messages); render();
    }).catch(function(err){
      typing.parentNode && typing.parentNode.remove();
      toast("Network error");
      messages.push({ role:"assistant", content:"⚠️ Network error" });
      saveThread(messages); render();
    }).finally(function(){
      sending = false; send.disabled = false; input.disabled = false; input.focus();
    });
  });

  function toggle(open){
    panel.style.display = open ? "flex" : "none";
    if (open) setTimeout(function(){ input.focus(); }, 50);
  }
  btn.addEventListener("click", function(){ toggle(panel.style.display !== "flex"); });
  close.addEventListener("click", function(){ toggle(false); });

  document.body.appendChild(btn);
  document.body.appendChild(panel);
})();
`;

export const Route = createFileRoute("/api/public/og-bot-widget-embed.js")({
  server: {
    handlers: {
      GET: async () =>
        new Response(LOADER_JS, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
