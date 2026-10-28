const STORAGE_KEY = "o5_conversations_v2";
const ACTIVE_KEY = "o5_active_conversation_v2";
const MODEL_KEY = "o5_installed_model_v2";

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn("O5 storage read failed:", error);
    return fallback;
  }
}

export const Storage = {
  getConversations() {
    const value = readJSON(STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  },

  saveConversations(conversations) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      return true;
    } catch (error) {
      console.error("Could not save conversations:", error);
      return false;
    }
  },

  getActiveId() {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  },

  setActiveId(id) {
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch (error) {
      console.warn("Could not save active conversation:", error);
    }
  },

  getInstalledModel() {
    try {
      return localStorage.getItem(MODEL_KEY);
    } catch {
      return null;
    }
  },

  setInstalledModel(modelId) {
    try {
      localStorage.setItem(MODEL_KEY, modelId);
    } catch (error) {
      console.warn("Could not save model metadata:", error);
    }
  },

  clearInstalledModel() {
    try {
      localStorage.removeItem(MODEL_KEY);
    } catch {}
  },

  createConversation() {
    return {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  },

  createMessage(role, content) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      createdAt: Date.now()
    };
  },

  requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      return Promise.resolve(false);
    }

    return navigator.storage.persist().catch(() => false);
  },

  async getStorageEstimate() {
    if (!navigator.storage?.estimate) return null;

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        persistent: navigator.storage.persisted
          ? await navigator.storage.persisted().catch(() => false)
          : false
      };
    } catch {
      return null;
    }
  }
};
