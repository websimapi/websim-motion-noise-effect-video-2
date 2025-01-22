export class NoiseEffect {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    
    // Performance optimizations
    this.ctx.imageSmoothingEnabled = false;
    
    this.mediaStream = null;
    this.previousFrame = null;
    this.previousCtx = null;
    this.staticNoisePattern = null;
    this.isCapturing = false;
    this.animationFrameId = null;
    this.lastProcessedTime = 0;
    this.processInterval = 1000 / 60; // Increase to 60 fps
    
    // Pre-allocate buffers
    this.tempCanvas = document.createElement('canvas');
    this.tempCtx = this.tempCanvas.getContext('2d', { alpha: false });
    this.tempCtx.imageSmoothingEnabled = false;
    
    this.noiseCanvas = document.createElement('canvas');
    this.noiseCtx = this.noiseCanvas.getContext('2d', { alpha: false });
    this.noiseCtx.imageSmoothingEnabled = false;
    this.motionMask = null;
    this.outputImageData = null;
  }

  generateNoisePattern(width, height) {
    const imageData = this.noiseCtx.createImageData(width, height);
    const data = imageData.data;
    const length = data.length;
    
    // Use Uint32Array for faster buffer manipulation
    const buf = new Uint32Array(imageData.data.buffer);
    
    for (let i = 0; i < buf.length; i++) {
      // Generate noise for 4 pixels at once
      buf[i] = Math.random() > 0.5 ? 0xFFFFFFFF : 0xFF000000;
    }
    
    this.noiseCtx.putImageData(imageData, 0, 0);
    return this.noiseCanvas;
  }

  detectMotion(currentFrame, previousFrame) {
    const width = currentFrame.width;
    const height = currentFrame.height;
    const size = width * height;
    
    // Reuse existing arrays
    if (!this.motionMask || this.motionMask.length !== size) {
      this.motionMask = new Uint8ClampedArray(size);
    }
    
    const currentData = this.tempCtx.getImageData(0, 0, width, height).data;
    const prevData = this.previousCtx.getImageData(0, 0, width, height).data;
    
    // Optimize motion detection loop
    for (let i = 0, j = 0; i < currentData.length; i += 16, j += 4) {
      const diff = Math.abs(currentData[i] - prevData[i]) +
                   Math.abs(currentData[i + 1] - prevData[i + 1]) +
                   Math.abs(currentData[i + 2] - prevData[i + 2]);
      
      // Process 4 pixels at once
      const motion = diff > 90 ? 1 : 0;
      this.motionMask[j] = motion;
      this.motionMask[j + 1] = motion;
      this.motionMask[j + 2] = motion;
      this.motionMask[j + 3] = motion;
    }
    
    return this.motionMask;
  }

  applyNoiseEffect(width, height, motionMask) {
    if (!this.outputImageData || this.outputImageData.width !== width) {
      this.outputImageData = this.ctx.createImageData(width, height);
    }
    
    const data = this.outputImageData.data;
    const newNoise = this.generateNoisePattern(width, height);
    const noiseData = this.noiseCtx.getImageData(0, 0, width, height).data;
    
    // Use TypedArray for faster array operations
    const uint32Data = new Uint32Array(data.buffer);
    const uint32Noise = new Uint32Array(noiseData.buffer);
    
    for (let i = 0; i < uint32Data.length; i++) {
      if (motionMask[i]) {
        uint32Data[i] = uint32Noise[i];
      } else if (!this.staticNoisePattern) {
        uint32Data[i] = uint32Noise[i];
      }
    }
    
    this.ctx.putImageData(this.outputImageData, 0, 0);
  }

  processFrame() {
    if (!this.isCapturing) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastProcessedTime;
    
    if (deltaTime >= this.processInterval) {
      const width = this.video.videoWidth;
      const height = this.video.videoHeight;
      
      // Setup canvases if needed
      if (this.tempCanvas.width !== width) {
        this.tempCanvas.width = width;
        this.tempCanvas.height = height;
        this.noiseCanvas.width = width;
        this.noiseCanvas.height = height;
        
        if (!this.previousCtx) {
          const prevCanvas = document.createElement('canvas');
          prevCanvas.width = width;
          prevCanvas.height = height;
          this.previousCtx = prevCanvas.getContext('2d', { alpha: false });
          this.previousCtx.imageSmoothingEnabled = false;
        }
      }
      
      // Draw current frame
      this.tempCtx.drawImage(this.video, 0, 0);
      
      if (this.previousFrame) {
        const motionMask = this.detectMotion(this.tempCanvas, this.previousFrame);
        this.applyNoiseEffect(width, height, motionMask);
      } else {
        this.staticNoisePattern = this.generateNoisePattern(width, height);
        this.ctx.drawImage(this.staticNoisePattern, 0, 0);
      }
      
      // Store current frame
      this.previousCtx.drawImage(this.tempCanvas, 0, 0);
      this.previousFrame = this.tempCanvas;
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
    this.previousCtx = null;
    this.staticNoisePattern = null;
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}