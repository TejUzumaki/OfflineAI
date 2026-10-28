export class UI {
  constructor() {
    this.$ = id => document.getElementById(id);

    this.elements = {
      sidebar: this.$("sidebar"),
      conversationList: this.$("conversationList"),
      welcomeScreen: this.$("welcomeScreen"),
      messages: this.$("messages"),
      chatArea: this.$("chatArea"),
      messageInput: this.$("messageInput"),
      sendButton: this.$("sendButton"),
      composerStatus: this.$("composerStatus"),
      composerDot: this.$("composerDot"),
      sidebarStatusDot: this.$("sidebarStatusDot"),
      sidebarModelStatus: this.$("sidebarModelStatus"),
      sidebarModelDetail: this.$("sidebarModelDetail"),
      welcomeModelNotice: this.$("welcomeModelNotice"),
      modelModal: this.$("modelModal"),
      modalTitle: this.$("modalTitle"),
      modalDescription: this.$("modalDescription"),
      installButton: this.$("installButton"),
      retryButton: this.$("retryButton"),
      progressFill: this.$("progressFill"),
      progressPercent: this.$("progressPercent"),
      progressMessage: this.$("progressMessage"),
      progressDetail: this.$("progressDetail"),
      modalError: this.$("modalError"),
      toast: this.$("toast")
    };

    this.toastTimer = null;
  }

  showModal() {
    this.elements.modelModal.hidden = false;
  }

  closeModal() {
    this.elements.modelModal.hidden = true;
  }

  setProgress({ progress = 0, text = "", detail = "", state = "idle" }) {
    const rounded = Math.round(progress);

    this.elements.progressFill.style.width = `${rounded}%`;
    this.elements.progressPercent.textContent = `${rounded}%`;
    this.elements.progressMessage.textContent = text;
    this.elements.progressDetail.textContent = detail;

    this.elements.sidebarModelStatus.textContent =
      state === "ready" ? "Model ready" :
      state === "loading" ? "Preparing model..." :
      state === "error" ? "Initialization failed" :
      "No model loaded";

    this.elements.sidebarStatusDot.className =
      "status-dot" +
      (state === "ready" ? " ready" : state === "loading" ? " loading" : "");

    this.elements.composerDot.className =
      "composer-indicator" +
      (state === "ready" ? " ready" : state === "loading" ? " loading" : "");

    this.elements.sidebarModelDetail.textContent =
      state === "ready" ? "Ready for local conversations." :
      state === "loading" ? "Loading model files. Please wait." :
      state === "error" ? "Open model setup to retry." :
      "Install a model to begin.";

    if (state === "ready") {
      this.elements.composerStatus.textContent = "Local model ready";
      this.elements.welcomeModelNotice.textContent =
        "Model ready. Your messages are processed locally.";
      this.elements.installButton.textContent = "Model installed";
      this.elements.installButton.disabled = true;
      this.elements.retryButton.hidden = true;
      this.elements.modalError.hidden = true;
    } else if (state === "loading") {
      this.elements.composerStatus.textContent = "Preparing local model...";
      this.elements.installButton.textContent = "Installing...";
      this.elements.installButton.disabled = true;
      this.elements.retryButton.hidden = true;
    } else if (state === "error") {
      this.elements.composerStatus.textContent = "Model setup required";
      this.elements.installButton.disabled = false;
      this.elements.installButton.textContent = "Install model";
      this.elements.retryButton.hidden = false;
    } else {
      this.elements.composerStatus.textContent = "No model loaded";
      this.elements.installButton.disabled = false;
      this.elements.installButton.textContent = "Install model";
    }
  }

  showError(error) {
    this.elements.modalError.hidden = false;
    this.elements.modalError.textContent =
      error?.message || String(error || "Unknown error");
  }

  clearError() {
    this.elements.modalError.hidden = true;
    this.elements.modalError.textContent = "";
  }

  renderConversations(conversations, activeId, onSelect, onDelete) {
    const container = this.elements.conversationList;
    container.replaceChildren();

    if (!conversations.length) {
      const empty = document.createElement("div");
      empty.className = "empty-conversations";
      empty.textContent = "Your conversations will appear here.";
      container.append(empty);
      return;
    }

    for (const conversation of conversations) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "3px";
      row.style.alignItems = "center";

      const button = document.createElement("button");
      button.className =
        "conversation-item" +
        (conversation.id === activeId ? " active" : "");
      button.textContent = conversation.title || "New conversation";
      button.title = button.textContent;
      button.style.flex = "1";
      button.addEventListener("click", () => onSelect(conversation.id));

      const remove = document.createElement("button");
      remove.className = "icon-button";
      remove.textContent = "×";
      remove.title = "Delete conversation";
      remove.style.width = "29px";
      remove.style.height = "29px";
      remove.style.flex = "0 0 29px";
      remove.addEventListener("click", event => {
        event.stopPropagation();
        if (confirm("Delete this conversation?")) onDelete(conversation.id);
      });

      row.append(button, remove);
      container.append(row);
    }
  }

  renderMessages(messages) {
    const target = this.elements.messages;
    target.replaceChildren();

    this.elements.welcomeScreen.hidden = messages.length > 0;
    target.hidden = messages.length === 0;

    for (const message of messages) {
      target.append(this.createMessageElement(message));
    }

    this.scrollToBottom();
  }

  createMessageElement(message) {
    const wrapper = document.createElement("article");
    wrapper.className = `message ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "user" ? "YOU" : "O5";

    const content = document.createElement("div");
    content.className = "message-content";

    const role = document.createElement("div");
    role.className = "message-role";
    role.textContent = message.role === "user" ? "You" : "O5";

    const text = document.createElement("div");
    text.className = "message-text";
    text.dataset.messageId = message.id;
    this.renderText(text, message.content);

    content.append(role, text);
    wrapper.append(avatar, content);

    return wrapper;
  }

  renderText(container, value) {
    container.replaceChildren();

    // Safe rendering: model output is always treated as text, never HTML.
    const source = String(value || "");
    const parts = source.split(/(```[\s\S]*?```)/g);

    for (const part of parts) {
      if (part.startsWith("```") && part.endsWith("```")) {
        const match = part.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
        const code = document.createElement("pre");
        const inline = document.createElement("code");
        inline.textContent = match ? match[2] : part.slice(3, -3);
        code.append(inline);
        container.append(code);
      } else if (part) {
        const paragraph = document.createElement("p");
        paragraph.style.whiteSpace = "pre-wrap";
        paragraph.textContent = part;
        container.append(paragraph);
      }
    }
  }

  updateMessageText(id, value) {
    const node = this.elements.messages.querySelector(
      `[data-message-id="${CSS.escape(id)}"]`
    );

    if (node) this.renderText(node, value);
    this.scrollToBottom();
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.elements.chatArea.scrollTop =
        this.elements.chatArea.scrollHeight;
    });
  }

  setBusy(busy) {
    this.elements.sendButton.disabled = busy;
    this.elements.sendButton.classList.toggle("busy", busy);
    this.elements.sendButton.textContent = busy ? "…" : "↑";
    this.elements.messageInput.disabled = busy;
  }

  toast(message) {
    const node = this.elements.toast;
    node.textContent = message;
    node.classList.add("visible");

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      node.classList.remove("visible");
    }, 3200);
  }

  resizeInput() {
    const input = this.elements.messageInput;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }
}
