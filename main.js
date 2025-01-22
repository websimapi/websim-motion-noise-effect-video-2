import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { NoiseEffect } from './noiseEffect.js';

document.addEventListener('DOMContentLoaded', () => {
  const video = document.createElement('video');
  video.id = 'videoInput';
  document.body.appendChild(video);

  const canvas = document.getElementById('outputCanvas');
  const startButton = document.getElementById('startCapture');
  const stopButton = document.getElementById('stopCapture');

  const noiseEffect = new NoiseEffect(video, canvas);

  // Initialize with static noise
  const staticNoise = noiseEffect.generateNoisePattern(
    window.innerWidth,
    window.innerHeight
  );
  const ctx = canvas.getContext('2d');
  ctx.drawImage(staticNoise, 0, 0, canvas.width, canvas.height);

  async function startScreenCapture() {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      
      await noiseEffect.start(mediaStream);
    } catch (err) {
      console.error("Error capturing screen:", err);
    }
  }

  function stopScreenCapture() {
    noiseEffect.stop();
    // Reset to static noise after stopping
    const staticNoise = noiseEffect.generateNoisePattern(
      canvas.width,
      canvas.height
    );
    ctx.drawImage(staticNoise, 0, 0);
  }

  // Event listeners
  startButton.addEventListener('click', startScreenCapture);
  stopButton.addEventListener('click', stopScreenCapture);
  window.addEventListener('resize', () => {
    noiseEffect.handleResize();
    if (!noiseEffect.isCapturing) {
      const staticNoise = noiseEffect.generateNoisePattern(
        canvas.width,
        canvas.height
      );
      ctx.drawImage(staticNoise, 0, 0);
    }
  });

  // Initial setup
  noiseEffect.handleResize();
});