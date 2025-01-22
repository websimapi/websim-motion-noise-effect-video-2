export class NoiseEffect {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    this.mediaStream = null;
    this.previousFrame = null;
    this.staticNoisePattern = null;
    this.isCapturing = false;
    this.animationFrameId = null;
    this.lastProcessedTime = 0;
    this.processInterval = 1000 / 30; // 30 fps
  }

  generateNoisePattern(width, height) {
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = width;
    noiseCanvas.height = height;
    const noiseCtx = noiseCanvas.getContext('2d');
    const imageData = noiseCtx.createImageData(width, height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() > 0.5 ? 255 : 0;
      imageData.data[i] = value;     // R
      imageData.data[i + 1] = value; // G
      imageData.data[i + 2] = value; // B
      imageData.data[i + 3] = 255;   // A
    }
    
    noiseCtx.putImageData(imageData, 0, 0);
    return noiseCanvas;
  }

  detectMotion(currentFrame, previousFrame) {
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = currentFrame.width;
    diffCanvas.height = currentFrame.height;
    const diffCtx = diffCanvas.getContext('2d');
    
    diffCtx.globalCompositeOperation = 'difference';
    diffCtx.drawImage(currentFrame, 0, 0);
    diffCtx.drawImage(previousFrame, 0, 0);
    
    const diffData = diffCtx.getImageData(0, 0, diffCanvas.width, diffCanvas.height);
    const motionMask = new Uint8ClampedArray(diffData.data.length / 4);
    
    for (let i = 0; i < diffData.data.length; i += 4) {
      const diff = (diffData.data[i] + diffData.data[i + 1] + diffData.data[i + 2]) / 3;
      motionMask[i / 4] = diff > 30 ? 1 : 0;
    }
    
    return motionMask;
  }

  applyNoiseEffect(currentFrame, motionMask) {
    const width = currentFrame.width;
    const height = currentFrame.height;
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext('2d');
    
    // Draw static noise background first
    if (!this.staticNoisePattern) {
      this.staticNoisePattern = this.generateNoisePattern(width, height);
    }
    outputCtx.drawImage(this.staticNoisePattern, 0, 0);
    
    // Only apply motion-based noise to moving regions
    const frameData = outputCtx.getImageData(0, 0, width, height);
    const newNoise = this.generateNoisePattern(width, height);
    const newNoiseCtx = newNoise.getContext('2d');
    const noiseData = newNoiseCtx.getImageData(0, 0, width, height);
    
    // Get the current frame data for comparison
    const currentData = outputCtx.getImageData(0, 0, width, height);
    
    for (let i = 0; i < frameData.data.length; i += 4) {
      const pixelIndex = i / 4;
      if (motionMask[pixelIndex]) {
        // For moving regions, apply new random noise
        const noiseValue = noiseData.data[i];
        frameData.data[i] = noiseValue;     // R
        frameData.data[i + 1] = noiseValue; // G
        frameData.data[i + 2] = noiseValue; // B
        frameData.data[i + 3] = 255;        // A
      }
      // Non-moving regions keep the static noise pattern
    }
    
    outputCtx.putImageData(frameData, 0, 0);
    return outputCanvas;
  }

  processFrame() {
    if (!this.isCapturing) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastProcessedTime;
    
    if (deltaTime >= this.processInterval) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.video.videoWidth;
      tempCanvas.height = this.video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(this.video, 0, 0);
      
      if (this.previousFrame) {
        const motionMask = this.detectMotion(tempCanvas, this.previousFrame);
        const processedFrame = this.applyNoiseEffect(tempCanvas, motionMask);
        this.ctx.drawImage(processedFrame, 0, 0, this.canvas.width, this.canvas.height);
      } else {
        this.staticNoisePattern = this.generateNoisePattern(this.video.videoWidth, this.video.videoHeight);
        this.ctx.drawImage(this.staticNoisePattern, 0, 0, this.canvas.width, this.canvas.height);
      }
      
      this.previousFrame = tempCanvas;
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