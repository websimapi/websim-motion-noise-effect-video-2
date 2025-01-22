export class NoiseEffect {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    
    // Enable image smoothing for better performance
    this.ctx.imageSmoothingEnabled = false;
    
    this.mediaStream = null;
    this.previousFrame = null;
    this.staticNoisePattern = null;
    this.isCapturing = false;
    this.animationFrameId = null;
    this.lastProcessedTime = 0;
    this.processInterval = 1000 / 30; // 30 fps
    
    // Create offscreen canvases for double buffering
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    
    // Pre-generate noise patterns
    this.noisePatternCache = new Map();
    
    // Performance optimization flags
    this.motionThreshold = 35;
    this.skipPixels = 2; // Process every nth pixel
  }

  generateNoisePattern(width, height) {
    const key = `${width}-${height}`;
    if (this.noisePatternCache.has(key)) {
      return this.noisePatternCache.get(key);
    }

    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = width;
    noiseCanvas.height = height;
    const noiseCtx = noiseCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    
    const imageData = noiseCtx.createImageData(width, height);
    const data = imageData.data;
    
    // Generate noise in a single pass
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.random() > 0.5 ? 255 : 0;
      data[i] = value;     // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      data[i + 3] = 255;   // A
    }
    
    noiseCtx.putImageData(imageData, 0, 0);
    this.noisePatternCache.set(key, noiseCanvas);
    return noiseCanvas;
  }

  detectMotion(currentFrame, previousFrame) {
    const width = currentFrame.width;
    const height = currentFrame.height;
    
    const current = this.offscreenCtx.getImageData(0, 0, width, height).data;
    const previous = previousFrame.getContext('2d').getImageData(0, 0, width, height).data;
    
    const motionMask = new Uint8ClampedArray(current.length / 4);
    
    // Optimize motion detection by processing fewer pixels
    for (let i = 0; i < current.length; i += 4 * this.skipPixels) {
      const diff = Math.abs(current[i] - previous[i]) +
                  Math.abs(current[i + 1] - previous[i + 1]) +
                  Math.abs(current[i + 2] - previous[i + 2]);
      
      const idx = i / 4;
      motionMask[idx] = diff > this.motionThreshold ? 1 : 0;
      
      // Copy the same motion value to skipped pixels
      for (let j = 1; j < this.skipPixels && idx + j < motionMask.length; j++) {
        motionMask[idx + j] = motionMask[idx];
      }
    }
    
    return motionMask;
  }

  applyNoiseEffect(currentFrame, motionMask) {
    const width = currentFrame.width;
    const height = currentFrame.height;
    
    if (!this.staticNoisePattern || 
        this.staticNoisePattern.width !== width || 
        this.staticNoisePattern.height !== height) {
      this.staticNoisePattern = this.generateNoisePattern(width, height);
    }
    
    // Use the offscreen canvas for compositing
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    
    // Draw static noise background
    this.offscreenCtx.drawImage(this.staticNoisePattern, 0, 0);
    
    // Apply motion-based noise only to moving regions
    const frameData = this.offscreenCtx.getImageData(0, 0, width, height);
    const newNoise = this.generateNoisePattern(width, height);
    const noiseData = newNoise.getContext('2d').getImageData(0, 0, width, height).data;
    
    // Optimize pixel processing
    for (let i = 0; i < frameData.data.length; i += 4 * this.skipPixels) {
      const pixelIndex = i / 4;
      if (motionMask[pixelIndex]) {
        const noiseValue = noiseData[i];
        for (let j = 0; j < 4 * this.skipPixels && i + j < frameData.data.length; j += 4) {
          frameData.data[i + j] = noiseValue;     // R
          frameData.data[i + j + 1] = noiseValue; // G
          frameData.data[i + j + 2] = noiseValue; // B
          frameData.data[i + j + 3] = 255;        // A
        }
      }
    }
    
    this.offscreenCtx.putImageData(frameData, 0, 0);
    return this.offscreenCanvas;
  }

  processFrame() {
    if (!this.isCapturing) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastProcessedTime;
    
    if (deltaTime >= this.processInterval) {
      // Create temporary canvas with video dimensions
      if (!this.tempCanvas) {
        this.tempCanvas = document.createElement('canvas');
      }
      this.tempCanvas.width = this.video.videoWidth;
      this.tempCanvas.height = this.video.videoHeight;
      const tempCtx = this.tempCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true
      });
      tempCtx.drawImage(this.video, 0, 0);
      
      if (this.previousFrame) {
        const motionMask = this.detectMotion(this.tempCanvas, this.previousFrame);
        const processedFrame = this.applyNoiseEffect(this.tempCanvas, motionMask);
        this.ctx.drawImage(processedFrame, 0, 0, this.canvas.width, this.canvas.height);
      } else {
        this.staticNoisePattern = this.generateNoisePattern(
          this.video.videoWidth,
          this.video.videoHeight
        );
        this.ctx.drawImage(
          this.staticNoisePattern,
          0, 0,
          this.canvas.width,
          this.canvas.height
        );
      }
      
      // Swap frames
      this.previousFrame = this.tempCanvas.cloneNode(true);
      this.previousFrame.getContext('2d', {
        alpha: false,
        desynchronized: true
      }).drawImage(this.tempCanvas, 0, 0);
      
      this.lastProcessedTime = currentTime;
    }
    
    this.animationFrameId = requestAnimationFrame(() => this.processFrame());
  }

  async start(mediaStream) {
    this.mediaStream = mediaStream;
    this.video.srcObject = this.mediaStream;
    await this.video.play();
    
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    
    this.isCapturing = true;
    this.processFrame();
  }

  stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.isCapturing = false;
    this.previousFrame = null;
    this.staticNoisePattern = null;
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}