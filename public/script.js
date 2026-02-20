// ============================
// 🌐 Backend URL
// ============================
const API_URL = "http://localhost:5000";


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
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
      chatBox.innerHTML = "";
      loadChatHistory();
      scrollToBottom();
    }
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

  } catch (err) {
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

  } catch (err) {
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

  // USER MESSAGE
  addMessage("user", message);
  inputField.value = "";

  // BOT LOADING MESSAGE
  const botDiv = addMessage("bot", "Thinking...");

  scrollToBottom();

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    const reply = data.reply || "AI service unavailable.";

    botDiv.innerText = reply;

    speakText(reply);
    saveChat(message, reply);

  } catch (err) {
    botDiv.innerText = "⚠️ Server error. Please try again.";
  }

  scrollToBottom();
}


// ============================
// 🔹 ADD MESSAGE (FIXED)
// ============================
function addMessage(sender, text) {

  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return null;

  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerText = text;

  chatBox.appendChild(message);

  setTimeout(() => {
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 50);

  return message;   // ✅ VERY IMPORTANT
}


// ============================
// 🔹 CHAT HISTORY
// ============================
function saveChat(userMsg, botMsg) {

  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];

  history.push({ sender: "You", message: userMsg });
  history.push({ sender: "Bot", message: botMsg });

  localStorage.setItem("chatHistory", JSON.stringify(history));
}


function loadChatHistory() {

  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];

  history.forEach(chat => {
    addMessage(
      chat.sender === "You" ? "user" : "bot",
      chat.message
    );
  });
}


// ============================
// 🔹 SCROLL FIX
// ============================
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
// 🔹 VOICE RECOGNITION
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
// 🔹 TEXT TO SPEECH
// ============================
function speakText(text) {
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-IN";
  window.speechSynthesis.speak(speech);
}


// ============================
// 🔹 DARK MODE
// ============================
function toggleTheme() {
  document.body.classList.toggle("dark-mode");
}


// ============================
// 🔹 HAMBURGER MENU
// ============================
function toggleMenu() {

  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.style.left =
    sidebar.style.left === "0px" ? "-250px" : "0px";
}


// ============================
// 🔹 LOGOUT
// ============================
function logout() {

  localStorage.removeItem("isLoggedIn");
  showSection("loginPage");
}


// ============================
// 🔹 NAVIGATION
// ============================
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