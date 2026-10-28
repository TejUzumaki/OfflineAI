import { Storage } from "./storage.js";
import { ModelManager, MODEL_ID, MODEL_NAME } from "./model-manager.js";
import { ChatManager } from "./chat.js";
import { UI } from "./ui.js";

const ui = new UI();

const modelManager = new ModelManager(progress => {
  ui.setProgress(progress);

  if (progress.state === "ready") {
    Storage.setInstalledModel(MODEL_ID);
    updateModelDialog();
  }
});

const chat = new ChatManager(Storage, () => render());

let busy = false;
let pendingPrompt = "";

function updateModelDialog() {
  ui.elements.modalTitle.textContent = modelManager.isReady
    ? "Your model is ready."
    : "Give O5 its intelligence.";

  ui.elements.modalDescription.textContent = modelManager.isReady
    ? "The model has loaded successfully. It is cached in browser storage and can be reused on future visits."
    : "Install a compatible language model on this device. The download progress will appear below. Subsequent visits can reuse the cached model.";

  ui.elements.installButton.textContent = modelManager.isReady
    ? "Model installed"
    : modelManager.isLoading
      ? "Installing..."
      : "Install model";

  ui.elements.installButton.disabled =
    modelManager.isReady || modelManager.isLoading;

  ui.elements.retryButton.hidden =
    modelManager.isReady || modelManager.isLoading;

  if (modelManager.isReady) {
    ui.elements.progressFill.style.width = "100%";
    ui.elements.progressPercent.textContent = "100%";
    ui.elements.progressMessage.textContent =
      "Model ready. You can start chatting.";
    ui.elements.progressDetail.textContent = MODEL_NAME;
    ui.elements.modalError.hidden = true;
  }
}

function render() {
  ui.renderConversations(
    chat.conversations,
    chat.activeId,
    id => {
      chat.selectConversation(id);
      ui.elements.sidebar.classList.remove("open");
    },
    id => {
      chat.deleteConversation(id);
      if (chat.messages.length === 0) {
        ui.elements.welcomeScreen.hidden = false;
        ui.elements.messages.hidden = true;
      }
    }
  );

  ui.renderMessages(chat.messages);
}

function openModelSetup(prompt = "") {
  pendingPrompt = prompt;
  updateModelDialog();
  ui.showModal();
}

async function installModel() {
  if (modelManager.isReady) {
    ui.closeModal();
    return;
  }

  ui.clearError();
  ui.showModal();
  updateModelDialog();

  try {
    await modelManager.load();

    ui.toast("Model installed and ready.");

    if (pendingPrompt.trim()) {
      const prompt = pendingPrompt;
      pendingPrompt = "";
      ui.closeModal();
      await sendMessage(prompt);
    } else {
      ui.closeModal();
    }
  } catch (error) {
    console.error("O5 model initialization failed:", error);

    ui.showError(error);
    ui.elements.progressMessage.textContent =
      "Model setup failed. Review the error above, then retry.";
    ui.elements.progressDetail.textContent =
      "Check internet access, browser compatibility, available storage, and GPU support.";
    ui.toast("Model initialization failed.");
  }
}

async function sendMessage(rawText) {
  const text = String(rawText || "").trim();
  if (!text || busy) return;

  if (!modelManager.isReady) {
    openModelSetup(text);
    return;
  }

  busy = true;
  ui.setBusy(true);

  try {
    chat.addMessage("user", text);
    const assistantMessage = chat.addMessage("assistant", "");

    let fullResponse = "";
    let receivedAnyToken = false;

    render();

    const messagesForModel = chat.messages
      .filter(message => message.content.trim().length > 0)
      .slice(-20)
      .map(message => ({
        role: message.role,
        content: message.content
      }));

    // The empty assistant placeholder is not sent to the model.
    const answer = await modelManager.generate(
      messagesForModel.filter(message =>
        message.content.trim().length > 0
      ),
      (_token, completeText) => {
        receivedAnyToken = true;
        fullResponse = completeText;
        ui.updateMessageText(assistantMessage.id, fullResponse);
      }
    );

    fullResponse = answer || fullResponse;

    if (!receivedAnyToken && !fullResponse) {
      fullResponse = "The model returned an empty response. Please try again.";
    }

    chat.updateMessage(assistantMessage.id, fullResponse);
    render();
  } catch (error) {
    console.error("O5 generation failed:", error);

    const message =
      `Generation failed: ${error?.message || String(error)}\n\n` +
      "Your model may still be installed. Try sending the message again.";

    const last = chat.messages[chat.messages.length - 1];

    if (last?.role === "assistant" && !last.content.trim()) {
      chat.updateMessage(last.id, message);
    } else {
      chat.addMessage("assistant", message);
    }

    render();
    ui.toast("Could not generate a response.");
  } finally {
    busy = false;
    ui.setBusy(false);
    ui.elements.messageInput.focus();
  }
}

function newConversation() {
  if (busy) return;

  chat.newConversation();
  ui.elements.messageInput.value = "";
  ui.resizeInput();
  ui.elements.sidebar.classList.remove("open");
  render();
  ui.elements.messageInput.focus();
}

function exportConversations() {
  const blob = new Blob([chat.exportJSON()], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `o5-conversations-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ui.toast("Conversations exported.");
}

function bindEvents() {
  ui.$("installButton").addEventListener("click", installModel);
  ui.$("retryButton").addEventListener("click", installModel);

  ui.$("openSettingsButton").addEventListener("click", () => {
    openModelSetup();
  });

  ui.$("topModelButton").addEventListener("click", () => {
    openModelSetup();
  });

  ui.$("closeModalButton").addEventListener("click", () => {
    if (!modelManager.isLoading) ui.closeModal();
  });

  ui.$("modelModal").addEventListener("click", event => {
    if (
      event.target === ui.$("modelModal") &&
      !modelManager.isLoading
    ) {
      ui.closeModal();
    }
  });

  ui.$("newChatButton").addEventListener("click", newConversation);
  ui.$("clearChatButton").addEventListener("click", newConversation);

  ui.$("exportButton").addEventListener("click", exportConversations);

  ui.$("menuButton").addEventListener("click", () => {
    ui.elements.sidebar.classList.toggle("open");
  });

  ui.elements.sendButton.addEventListener("click", () => {
    const text = ui.elements.messageInput.value;
    ui.elements.messageInput.value = "";
    ui.resizeInput();
    sendMessage(text);
  });

  ui.elements.messageInput.addEventListener("input", () => {
    ui.resizeInput();
  });

  ui.elements.messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      const text = ui.elements.messageInput.value;
      ui.elements.messageInput.value = "";
      ui.resizeInput();

      sendMessage(text);
    }
  });

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.prompt);
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modelManager.isLoading) {
      ui.closeModal();
      ui.elements.sidebar.classList.remove("open");
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      newConversation();
    }
  });
}

async function restoreModel() {
  const previouslyInstalled = Storage.getInstalledModel();

  if (previouslyInstalled === MODEL_ID) {
    // Reloading an installed model uses WebLLM's persistent cache.
    // If browser storage was cleared, WebLLM will download the files again.
    ui.elements.progressMessage.textContent =
      "Restoring your previously installed model from browser storage...";
    ui.showModal();

    try {
      await modelManager.load();
      ui.closeModal();
      ui.toast("Your saved model is ready.");
    } catch (error) {
      console.warn("Saved model restoration failed:", error);

      ui.showModal();
      ui.showError(error);
      ui.elements.progressMessage.textContent =
        "The previous model could not be restored. Retry to initialize it again.";
      ui.elements.retryButton.hidden = false;
    }
  } else {
    ui.setProgress({
      progress: 0,
      text: "No model installed yet. Install one to begin chatting.",
      state: "idle"
    });
  }
}

async function initializeApp() {
  bindEvents();
  render();

  ui.elements.messageInput.disabled = false;
  ui.elements.messageInput.placeholder = "Message O5...";

  // Request persistent storage permission when the browser supports it.
  Storage.requestPersistentStorage().catch(() => false);

  // Inform the user how much browser storage is available.
  const estimate = await Storage.getStorageEstimate();

  if (estimate?.quota) {
    const usedMB = (estimate.usage / (1024 * 1024)).toFixed(0);
    const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);

    ui.elements.progressDetail.textContent =
      `Browser storage: approximately ${usedMB} MB used of ${quotaMB} MB available.`;
  }

  // Attempt restoration only when the previous model metadata exists.
  await restoreModel();
}

initializeApp().catch(error => {
  console.error("O5 startup error:", error);
  ui.toast("O5 started with an initialization issue. Open Model & engine.");
});

console.info("O5 modular application initialized.", {
  model: MODEL_ID,
  engine: "WebLLM",
  cacheBackend: "IndexedDB"
});

import "./register-sw.js";
