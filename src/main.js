import plugin from "../plugin.json";

class AcodePlugin {
  async init() {
    await initializeChatSystem();
  }

  async destroy() {
    const oldButton = document.getElementById("acode-chat-sidebutton");
    if (oldButton) oldButton.remove();

    const popup = document.getElementById("acode-chat-popup");
    if (popup) popup.remove();
  }
}

if (window.acode) {
  const acodePlugin = new AcodePlugin();
  acode.setPluginInit(plugin.id, async (baseUrl, $page, { cacheFileUrl, cacheFile }) => {
    if (!baseUrl.endsWith("/")) baseUrl += "/";
    acodePlugin.baseUrl = baseUrl;
    await acodePlugin.init();
  });
  acode.setPluginUnmount(plugin.id, () => acodePlugin.destroy());
}

// API key নেওয়ার ফাংশন
async function getApiKey(forcePrompt = false) {
  let apiKey = localStorage.getItem("gemini_api_key");
  if (!apiKey || forcePrompt) {
    apiKey = prompt("Enter your Gemini API Key:");
    if (apiKey) {
      localStorage.setItem("gemini_api_key", apiKey);
    } else {
      return null;
    }
  }
  return apiKey;
}

// সাইডবার বাটন ইনিশিয়ালাইজেশন
async function initializeChatSystem() {
  const SideButton = acode.require("sideButton");

  const oldButton = document.getElementById("acode-chat-sidebutton");
  if (oldButton) oldButton.remove();

  const sideButton = SideButton({
    text: "Chat Gemini",
    icon: "chat",
    id: "acode-chat-sidebutton",
    backgroundColor: "#007bff",
    textColor: "#fff",
    onclick: async () => {
      // ✅ প্রথমে API key check
      let apiKey = localStorage.getItem("gemini_api_key");

      // API key নেই বা forcePrompt → prompt
      if (!apiKey) {
        apiKey = prompt("Please enter your Gemini API Key:");
        if (!apiKey) return; // user cancel করলে চ্যাট উইন্ডো না খোলে
        localStorage.setItem("gemini_api_key", apiKey);
      }

      // API key থাকলে চ্যাট উইন্ডো ওপেন
      ChatUI.showPopup(apiKey);
    },
  });

  sideButton.show();
  ChatUI.loadPrism();
}









const ChatUI = (() => {
  let sessions = {};
  let currentId = genId();
  let popupBody, inputField;

  function genId() {
    return "chat_" + Date.now();
  }

  function showPopup(apiKey) {
    if (document.getElementById("acode-chat-popup")) {
      document.getElementById("acode-chat-popup").style.display = "flex";
      return;
    }

    const popup = document.createElement("div");
    popup.id = "acode-chat-popup";
    Object.assign(popup.style, {
      position: "fixed",
      top: "40%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "300px",
      height: "420px",
      backgroundColor: "#fff",
      borderRadius: "12px",
      boxShadow: "0 0 15px rgba(0,0,0,0.3)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "Arial, sans-serif",
      zIndex: "9999",
    });

    popup.innerHTML = `
      <div id="chat-header" style="background:#007bff;color:#fff;padding:10px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
        <span>AI Chat</span>
        <div style="display:flex;gap:8px;">
          <span id="new-chat" style="cursor:pointer;">＋</span>
          <span id="show-history" style="cursor:pointer;">🕘</span>
          <span id="close-chat" style="cursor:pointer;">✖</span>
        </div>
      </div>
      <div id="chat-body" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;background:#f1f1f1;"></div>
      <div id="chat-footer" style="padding:10px;display:flex;gap:6px;border-top:1px solid #ccc;">
        <input id="chat-input" type="text" placeholder="Type a message..." style="flex:1;padding:8px;border-radius:8px;border:1px solid #ccc;outline:none;">
        <button id="send-msg" style="background:#007bff;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;">Send</button>
      </div>
    `;
    document.body.appendChild(popup);

    popupBody = popup.querySelector("#chat-body");
    inputField = popup.querySelector("#chat-input");

    popup.querySelector("#close-chat").onclick = () => (popup.style.display = "none");
    popup.querySelector("#new-chat").onclick = newChat;
    popup.querySelector("#show-history").onclick = showHistory;
    popup.querySelector("#send-msg").onclick = () => sendMsg(apiKey);

    enableSelectCopy(popupBody);
  }

  async function sendMsg(apiKey) {
    const text = inputField.value.trim();
    if (!text) return;

    appendMsg("user", text);
    if (!sessions[currentId]) sessions[currentId] = [];
    sessions[currentId].push({ role: "user", content: text });
    inputField.value = "";

    const loading = appendMsg("ai", "...");

    let res = await GeminiAPI.reply(sessions[currentId], apiKey);

    // যদি API key ভুল হয় → পুনরায় prompt
    while (res === "Invalid API Key") {
      apiKey = await getApiKey(true);
      if (!apiKey) {
        loading.remove();
        appendMsg("ai", "Message not sent due to missing API Key.");
        return;
      }
      res = await GeminiAPI.reply(sessions[currentId], apiKey);
    }

    loading.remove();
    appendMsg("ai", res);
    sessions[currentId].push({ role: "assistant", content: res });
  }

  function appendMsg(role, text) {
    const msg = document.createElement("div");
    msg.className = role === "user" ? "msg-user" : "msg-ai";

    Object.assign(msg.style, {
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      background: role === "user" ? "#007bff" : "#e0e0e0",
      color: role === "user" ? "#fff" : "#000",
      padding: "8px 12px",
      borderRadius: "12px",
      maxWidth: "80%",
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
      position: "relative",
    });

    msg.innerText = text;
    popupBody.appendChild(msg);
    popupBody.scrollTop = popupBody.scrollHeight;
    return msg;
  }

  function showHistory() { /* আগের মতোই */ }
  function newChat() { currentId = genId(); popupBody.innerHTML = ""; sessions[currentId] = []; }
  function enableSelectCopy(container) { container.style.userSelect = "text"; }
  function loadPrism() { /* আগের মতোই */ }

  return { showPopup, loadPrism };
})();

const GeminiAPI = {
  async reply(history, apiKey) {
    if (!apiKey) return "API Key missing.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: history.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await resp.json();

      // যদি API key invalid হয়
      if (data?.error?.details?.some(d => d.reason === "API_KEY_INVALID")) {
        return "Invalid API Key";
      }

      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        let text = data.candidates[0].content.parts[0].text.trim();
        if (/function|const|let|var|=>/.test(text) && !/```/.test(text)) {
          text = "```js\n" + text + "\n```";
        }
        return text;
      } else return "No response.";
    } catch (err) {
      console.error(err);
      return "Error fetching response.";
    }
  },
};