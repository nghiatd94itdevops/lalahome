// Resamples microphone audio from the AudioContext rate down to 16 kHz mono PCM16
// and posts one 100 ms frame (1600 samples) at a time to the main thread.
const TARGET_RATE = 16000;
const FRAME_SAMPLES = 1600;

class PcmDownsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET_RATE;
    this.position = 0;
    this.previous = 0;
    this.frame = new Int16Array(FRAME_SAMPLES);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0][0];
    if (!channel) return true;

    // Linear interpolation; `position` is the fractional read index carried across 128-sample blocks.
    while (this.position < channel.length) {
      const index = Math.floor(this.position);
      const fraction = this.position - index;
      const left = index === 0 ? this.previous : channel[index - 1];
      const right = channel[index];
      this.pushSample(left + (right - left) * fraction);
      this.position += this.step;
    }
    this.position -= channel.length;
    this.previous = channel[channel.length - 1];
    return true;
  }

  pushSample(value) {
    const clamped = Math.max(-1, Math.min(1, value));
    this.frame[this.filled++] = clamped * 0x7fff;
    if (this.filled < FRAME_SAMPLES) return;
    this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
    this.frame = new Int16Array(FRAME_SAMPLES);
    this.filled = 0;
  }
}

registerProcessor('pcm-downsampler', PcmDownsampler);
