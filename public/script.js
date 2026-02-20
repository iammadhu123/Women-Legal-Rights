// ============================
// 🌐 Backend URL
// ============================
const API_URL = "http://localhost:5000";
let voiceEnabled = false;


// ============================
// 🔹 AUTO LOGIN CHECK
// ============================
window.onload = function () {

  if (localStorage.getItem("isLoggedIn") === "true") {
    showSection("chatPage");
  } else {
    showSection("loginPage");
  }

  const input = document.getElementById("userInput");
  if (input) {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") sendMessage();
    });
  }

  window.speechSynthesis.cancel(); // stop any previous voice
};


// ============================
// 🔹 SECTION SWITCHING
// ============================
function showSection(sectionId) {

  document.querySelectorAll(".form-container, .chat-container")
    .forEach(div => div.style.display = "none");

  const section = document.getElementById(sectionId);
  if (section) section.style.display = "block";

  if (sectionId === "chatPage") {
    loadChatHistory();
    scrollToBottom();
  }
}


// ============================
// 🔹 LOGIN
// ============================
async function login() {

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    alert("⚠️ Please fill all fields!");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.message === "Login successful") {

      localStorage.setItem("isLoggedIn", "true");

      const userObj = {
        name: data.name || email.split("@")[0],
        email: email
      };

      localStorage.setItem("user", JSON.stringify(userObj));
      showSection("chatPage");

    } else {
      alert(data.error || "Login failed!");
    }

  } catch {
    alert("⚠️ Server error during login.");
  }
}


// ============================
// 🔹 SIGNUP
// ============================
async function signup() {

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();

  if (!name || !email || !password) {
    alert("⚠️ Please fill all fields!");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    alert(data.message || data.error);

    if (data.message) showSection("loginPage");

  } catch {
    alert("⚠️ Server error during signup.");
  }
}


// ============================
// 🔹 SEND MESSAGE
// ============================
async function sendMessage() {

  const inputField = document.getElementById("userInput");
  const message = inputField.value.trim();
  if (!message) return;

  addMessage("user", message);
  inputField.value = "";

  const botDiv = addMessage("bot", "Thinking...");
  scrollToBottom();

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    const reply = data.reply?.trim() || "AI service unavailable.";

    botDiv.innerText = reply;

    saveChat(message, reply);

    if (voiceEnabled) speakText(reply);

  } catch {
    botDiv.innerText = "⚠️ Server error. Please try again.";
  }

  scrollToBottom();
}


// ============================
// 🔹 ADD MESSAGE
// ============================
function addMessage(sender, text) {

  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  const shouldScroll = isUserAtBottom();

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);
  messageDiv.innerText = text;

  chatBox.appendChild(messageDiv);

  if (shouldScroll) {
    setTimeout(() => {
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 50);
  }

  return messageDiv;
}


// ============================
// 🔹 CHAT HISTORY (Grouped)
// ============================
function saveChat(userMsg, botMsg) {

  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];

  history.push({
    user: userMsg,
    bot: botMsg,
    time: new Date().toLocaleString()
  });

  localStorage.setItem("chatHistory", JSON.stringify(history));
}


function loadChatHistory() {

  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];

  chatBox.innerHTML = "";

  history.forEach(chat => {

    addMessage("user", chat.user);
    addMessage("bot", chat.bot);

  });
}


// ============================
// 🔹 SCROLL
// ============================
function isUserAtBottom() {
  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return true;

  const threshold = 100;
  return chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < threshold;
}

function scrollToBottom() {
  const chatBox = document.getElementById("chatBox");
  if (chatBox) {
    chatBox.scrollTo({
      top: chatBox.scrollHeight,
      behavior: "smooth"
    });
  }
}


// ============================
// 🔹 VOICE FUNCTIONS
// ============================
function speakText(text) {

  window.speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-IN";

  window.speechSynthesis.speak(speech);
}

function toggleVoice() {
  voiceEnabled = !voiceEnabled;
  alert("Voice mode: " + (voiceEnabled ? "ON" : "OFF"));
}


// ============================
// 🔹 VOICE INPUT
// ============================
function startListening() {

  if (!('webkitSpeechRecognition' in window)) {
    alert("Speech recognition not supported.");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-IN";
  recognition.start();

  recognition.onresult = function (event) {
    document.getElementById("userInput").value =
      event.results[0][0].transcript;
  };
}


// ============================
// 🔹 UI FUNCTIONS
// ============================
function toggleTheme() {
  document.body.classList.toggle("dark-mode");
}

function toggleMenu() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.style.left =
    sidebar.style.left === "0px" ? "-250px" : "0px";
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  showSection("loginPage");
}

function goToChat() {
  window.location.href = "index.html";
}

function showHelp() {
  window.location.href = "help.html";
}

function showProfile() {
  window.location.href = "profile.html";
}

function showHistory() {
  window.location.href = "history.html";
}