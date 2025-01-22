import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { NoiseEffect } from './noiseEffect.js';

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('videoInput');
  const canvas = document.getElementById('outputCanvas');
  const startButton = document.getElementById('startCapture');
  const stopButton = document.getElementById('stopCapture');

  const noiseEffect = new NoiseEffect(video, canvas);

  async function startScreenCapture() {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      
      noiseEffect.start(mediaStream);
    } catch (err) {
      console.error("Error capturing screen:", err);
    }
  }

  function stopScreenCapture() {
    noiseEffect.stop();
  }

  // Event listeners
  startButton.addEventListener('click', startScreenCapture);
  stopButton.addEventListener('click', stopScreenCapture);
  window.addEventListener('resize', () => noiseEffect.handleResize());

  // Initial setup
  noiseEffect.handleResize();
});