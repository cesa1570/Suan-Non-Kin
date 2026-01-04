/**
 * Decodes base64 string to a Uint8Array.
 * Optimized for robustness against dirty strings (newlines/spaces).
 */
function decode(base64: string): Uint8Array {
  // 1. Clean the base64 string (remove spaces, newlines, tabs)
  // This prevents 'InvalidCharacterError' in atob
  const cleanBase64 = base64.replace(/[\s\r\n]+/g, '');
  
  if (!cleanBase64) return new Uint8Array(0);

  try {
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("Base64 Decode Error:", error);
    return new Uint8Array(0);
  }
}

/**
 * Decodes raw PCM audio data from Gemini.
 * Gemini Live and TTS APIs return raw PCM data (no headers).
 * * Specs: 16-bit Little Endian PCM.
 * Default Sample Rate: 24000Hz.
 */
export async function decodeAudioData(
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer | null> {
  
  // Safety Check: Missing or empty data
  if (!base64Data || base64Data.length === 0) return null;

  try {
    const data = decode(base64Data);
    
    if (data.byteLength === 0) return null;

    // Safety Check: Data alignment for Int16Array
    // PCM 16-bit requires 2 bytes per sample. 
    // If we receive an odd number of bytes (e.g. 101 bytes), it will crash.
    // We strictly align it to even bytes.
    let safeBuffer = data.buffer;
    if (data.byteLength % 2 !== 0) {
      // Create a copy that ignores the last odd byte
      const evenLength = data.byteLength - (data.byteLength % 2);
      safeBuffer = data.buffer.slice(0, evenLength);
    }
    
    // Create view for 16-bit PCM (Little Endian)
    const dataInt16 = new Int16Array(safeBuffer);
    const frameCount = dataInt16.length / numChannels;
    
    if (frameCount === 0) return null;

    // Create Web Audio Buffer
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        // Interleaved Data Handling (if numChannels > 1)
        const sampleIndex = i * numChannels + channel;
        
        if (sampleIndex < dataInt16.length) {
           // Convert Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
           const sample = dataInt16[sampleIndex];
           
           // Division by 32768.0 is standard normalization for 16-bit audio
           channelData[i] = sample < 0 ? sample / 32768.0 : sample / 32767.0;
        }
      }
    }
    
    return buffer;

  } catch (error) {
    console.error("PCM Processing Failed:", error);
    return null;
  }
}