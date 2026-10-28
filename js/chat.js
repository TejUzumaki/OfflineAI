import { Storage } from "./storage.js";

export class ChatManager {
  constructor(storage, onChange = () => {}) {
    this.storage = storage;
    this.onChange = onChange;
    this.conversations = storage.getConversations();
    this.activeId = storage.getActiveId();

    if (!this.conversations.some(c => c.id === this.activeId)) {
      this.activeId = this.conversations[0]?.id || null;
    }

    if (this.activeId) {
      this.storage.setActiveId(this.activeId);
    }
  }

  get activeConversation() {
    return this.conversations.find(c => c.id === this.activeId) || null;
  }

  get messages() {
    return this.activeConversation?.messages || [];
  }

  save() {
    const success = this.storage.saveConversations(this.conversations);
    this.storage.setActiveId(this.activeId);
    this.onChange();
    return success;
  }

  newConversation() {
    const conversation = this.storage.createConversation();
    this.conversations.unshift(conversation);
    this.activeId = conversation.id;
    this.save();
    return conversation;
  }

  selectConversation(id) {
    if (!this.conversations.some(c => c.id === id)) return;
    this.activeId = id;
    this.save();
  }

  ensureConversation() {
    return this.activeConversation || this.newConversation();
  }

  addMessage(role, content) {
    const conversation = this.ensureConversation();

    const message = this.storage.createMessage(role, content);
    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    if (role === "user" && conversation.title === "New conversation") {
      const firstLine = content.split("\n")[0].trim();
      conversation.title = firstLine.slice(0, 46) || "New conversation";
      if (firstLine.length > 46) conversation.title += "…";
    }

    this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    this.save();

    return message;
  }

  updateMessage(id, content) {
    const conversation = this.activeConversation;
    if (!conversation) return;

    const message = conversation.messages.find(item => item.id === id);
    if (!message) return;

    message.content = content;
    conversation.updatedAt = Date.now();
    this.save();
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);

    if (this.activeId === id) {
      this.activeId = this.conversations[0]?.id || null;
    }

    this.save();
  }

  clearAll() {
    this.conversations = [];
    this.activeId = null;
    this.save();
  }

  exportJSON() {
    return JSON.stringify({
      application: "O5",
      version: 2,
      exportedAt: new Date().toISOString(),
      conversations: this.conversations
    }, null, 2);
  }
}
