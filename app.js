import { CreateWebWorkerMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const statusText = document.getElementById("status");

// We use SmolLM2 135M because it is strictly under 300MB, speaks English, and runs fast on mobile.
const MODEL_ID = "SmolLM2-135M-Instruct-q4f16_1-MLC";

let engine = null;
let chatHistory = [
    { role: "system", content: "You are a friendly, casual chat buddy. Speak in simple, everyday English. Keep responses short and conversational. Do not write code or technical explanations." }
];

async function initializeAI() {
    try {
        statusText.innerText = "Downloading SLM (150MB)... 0%";
        
        engine = await CreateWebWorkerMLCEngine(
            new Worker(new URL('./sw.js', import.meta.url), { type: 'module' }),
            MODEL_ID,
            {
                initProgressCallback: (report) => {
                    statusText.innerText = `Loading: ${report.text}`;
                }
            }
        );

        statusText.innerText = "AI is ready! Let's chat. 🎉";
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    } catch (error) {
        statusText.innerText = "Error loading AI. Your browser might not support WebGPU.";
        console.error(error);
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || !engine) return;

    addMessageToUI(message, "user");
    userInput.value = "";
    sendBtn.disabled = true;
    userInput.disabled = true;

    chatHistory.push({ role: "user", content: message });

    try {
        const reply = await engine.chat.completions.create({
            messages: chatHistory,
            stream: false, 
        });

        const aiResponse = reply.choices[0].message.content;
        addMessageToUI(aiResponse, "ai");
        chatHistory.push({ role: "assistant", content: aiResponse });
    } catch (e) {
        addMessageToUI("Sorry, my brain crashed thinking about that.", "ai");
    }

    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
}

function addMessageToUI(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    msgDiv.innerText = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

initializeAI();
