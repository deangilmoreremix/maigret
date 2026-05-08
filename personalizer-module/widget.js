(function() {
  'use strict';

  const defaultConfig = {
    personalizerUrl: window.location.origin,
    appId: 'videoremix-vip',
    mode: 'cold-email',
    userId: null,
    projectId: null,
    theme: {
      primary: '#8B5CF6',
      secondary: '#06B6D4'
    }
  };

  class VideoRemixPersonalizer {
    constructor() {
      this.config = { ...defaultConfig };
      this.iframe = null;
      this.callbacks = {};
    }

    init(config = {}) {
      this.config = { ...this.config, ...config };
      return this;
    }

    open(config = {}) {
      const finalConfig = { ...this.config, ...config };
      const params = new URLSearchParams({
        app: finalConfig.appId,
        mode: finalConfig.mode,
        ...(finalConfig.userId && { userId: finalConfig.userId }),
        ...(finalConfig.projectId && { projectId: finalConfig.projectId })
      });

      const url = `${finalConfig.personalizerUrl}/new?${params.toString()}`;
      
      this.iframe = document.createElement('iframe');
      this.iframe.src = url;
      this.iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;';
      document.body.appendChild(this.iframe);

      window.addEventListener('message', (event) => {
        if (event.origin !== new URL(finalConfig.personalizerUrl).origin) return;
        if (event.data.type === 'PERSONALIZER_CLOSE') {
          this.close();
        }
        if (event.data.type === 'PERSONALIZER_COMPLETE') {
          this.callbacks.onComplete?.(event.data.output);
        }
      });

      return this;
    }

    close() {
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }
      return this;
    }

    generate(payload) {
      fetch(`${this.config.personalizerUrl}/api/personalizer/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => this.callbacks.onComplete?.(data))
        .catch(err => this.callbacks.onError?.(err));
      return this;
    }

    on(event, callback) {
      this.callbacks[event] = callback;
      return this;
    }
  }

  window.VideoRemixPersonalizer = new VideoRemixPersonalizer();
})();
