const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";

export const MODEL_ID = "SmolLM2-135M-Instruct-q4f16_1-MLC";
export const MODEL_NAME = "SmolLM2 135M Instruct";

export class ModelManager {
  constructor(onProgress = () => {}) {
    this.onProgress = onProgress;
    this.engine = null;
    this.webllm = null;
    this.loadingPromise = null;
    this.generating = false;
    this.state = "idle";
    this.lastError = null;
  }

  get isReady() {
    return Boolean(this.engine) && this.state === "ready";
  }

  get isLoading() {
    return this.state === "loading";
  }

  get isGenerating() {
    return this.generating;
  }

  get status() {
    return this.state;
  }

  emit(progress, text, detail = "") {
    this.onProgress({
      progress: Math.max(0, Math.min(100, Number(progress) || 0)),
      text: String(text || ""),
      detail: String(detail || ""),
      state: this.state
    });
  }

  async checkCompatibility() {
    if (!window.isSecureContext) {
      throw new Error(
        "O5 requires a secure context (HTTPS or localhost). Open the deployed HTTPS website."
      );
    }

    if (!navigator.gpu) {
      throw new Error(
        "WebGPU is unavailable in this browser. Try an updated WebGPU-compatible version of Chrome and check that your device's GPU acceleration is enabled."
      );
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No compatible GPU adapter was found.");
      }
    } catch (error) {
      throw new Error(
        `Your browser could not initialize WebGPU. ${error?.message || ""}`.trim()
      );
    }
  }

  async load() {
    if (this.isReady) return this.engine;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.loadInternal();

    try {
      return await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async loadInternal() {
    this.state = "loading";
    this.lastError = null;
    this.emit(0, "Checking browser compatibility...");

    try {
      await this.checkCompatibility();

      this.emit(1, "Loading the local inference engine...", "WebLLM");

      if (!this.webllm) {
        this.webllm = await import(WEBLLM_URL);
      }

      const { CreateMLCEngine, prebuiltAppConfig } = this.webllm;

      if (typeof CreateMLCEngine !== "function") {
        throw new Error(
          "The WebLLM package did not expose CreateMLCEngine. Check your internet connection and try again."
        );
      }

      const availableModels = prebuiltAppConfig?.model_list || [];
      const modelExists = availableModels.some(
        model => model.model_id === MODEL_ID
      );

      if (!modelExists) {
        throw new Error(
          `The configured model "${MODEL_ID}" is not present in the loaded WebLLM model list. The package's model registry may have changed.`
        );
      }

      const appConfig = {
        ...prebuiltAppConfig,
        cacheBackend: "indexeddb"
      };

      this.emit(2, "Preparing model storage...", "Browser IndexedDB cache");

      const persistent = await this.requestPersistence();

      if (persistent) {
        this.emit(3, "Persistent storage granted.", "Preparing model files");
      }

      this.engine = await CreateMLCEngine(MODEL_ID, {
        appConfig,
        initProgressCallback: report => {
          const progress = Number(report?.progress);
          const text = report?.text || report?.message || "Preparing model...";

          this.emit(
            Number.isFinite(progress) ? progress * 100 : 5,
            text,
            report?.timeElapsed
              ? `Elapsed: ${Math.round(report.timeElapsed)} seconds`
              : ""
          );
        }
      });

      this.state = "ready";
      this.emit(100, "Model ready. You can start chatting.", MODEL_NAME);

      return this.engine;
    } catch (error) {
      this.engine = null;
      this.state = "error";
      this.lastError = error;

      this.emit(0, "Model initialization failed.", error?.message || "");

      throw error;
    }
  }

  async requestPersistence() {
    try {
      if (navigator.storage?.persist) {
        return await navigator.storage.persist();
      }
    } catch (error) {
      console.warn("Persistent storage request failed:", error);
    }

    return false;
  }

  async generate(messages, onToken = () => {}) {
    if (!this.isReady) {
      throw new Error("The model is not ready. Install or load the model first.");
    }

    if (this.generating) {
      throw new Error("O5 is already generating a response.");
    }

    this.generating = true;

    try {
      const stream = await this.engine.chat.completions.create({
        messages: messages.map(message => ({
          role: message.role,
          content: message.content
        })),
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1024,
        stream: true
      });

      let completeText = "";

      for await (const chunk of stream) {
        const token = chunk?.choices?.[0]?.delta?.content;

        if (typeof token === "string" && token.length) {
          completeText += token;
          onToken(token, completeText);
        }
      }

      return completeText;
    } finally {
      this.generating = false;
    }
  }

  async unload() {
    if (this.generating) {
      throw new Error("Wait for the current response to finish before unloading.");
    }

    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (error) {
        console.warn("Engine unload warning:", error);
      }
    }

    this.engine = null;
    this.state = "idle";
    this.emit(0, "Model unloaded.");
  }
}
