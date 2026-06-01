export class CameraFrameSource {
  constructor({ width = 640 } = {}) {
    this.width = width;
    this.stream = null;

    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.style.display = 'none';

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'none';
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.lastVideoTime = -1;
    this.lastFrameChangedAt = 0;

    document.body.appendChild(this.video);
    document.body.appendChild(this.canvas);
  }

  async start() {
    if (this.stream) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not available in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    });

    this.video.srcObject = this.stream;
    await this.video.play();
  }

  stop() {
    if (!this.stream) {
      return;
    }

    for (const track of this.stream.getTracks()) {
      track.stop();
    }

    this.stream = null;
    this.video.srcObject = null;
    this.lastVideoTime = -1;
    this.lastFrameChangedAt = 0;
  }

  getFrame(timestamp = performance.now()) {
    if (!this.context || !this.video.videoWidth || !this.video.videoHeight) {
      return null;
    }

    const videoTime = this.video.currentTime;
    const hasNewVideoTime = videoTime !== this.lastVideoTime;
    if (hasNewVideoTime) {
      this.lastVideoTime = videoTime;
      this.lastFrameChangedAt = timestamp;
    }

    const aspect = this.video.videoHeight / this.video.videoWidth;
    const height = Math.round(this.width * aspect);

    if (this.canvas.width !== this.width || this.canvas.height !== height) {
      this.canvas.width = this.width;
      this.canvas.height = height;
    }

    this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return {
      imageData: this.context.getImageData(0, 0, this.canvas.width, this.canvas.height),
      stats: {
        videoTime,
        hasNewVideoTime,
        staleForMs: timestamp - this.lastFrameChangedAt,
        readyState: this.video.readyState,
      },
    };
  }

  getImageData() {
    return this.getFrame()?.imageData ?? null;
  }
}
