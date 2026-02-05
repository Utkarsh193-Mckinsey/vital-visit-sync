// This file contains the Amiri Arabic font as a base64 string for jsPDF embedding
// Font: Amiri Regular - Arabic-supporting font
// Source: Google Fonts (OFL License)

// We'll load the font dynamically from the assets folder
export async function loadAmiriFont(): Promise<string> {
  try {
    const response = await fetch('/src/assets/fonts/Amiri-Regular.ttf');
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    return base64;
  } catch (error) {
    console.error('Failed to load Amiri font:', error);
    throw error;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// For bundled approach - import as URL
import amiriFontUrl from '@/assets/fonts/Amiri-Regular.ttf?url';

export async function loadAmiriFontFromBundle(): Promise<string> {
  try {
    const response = await fetch(amiriFontUrl);
    const arrayBuffer = await response.arrayBuffer();
    return arrayBufferToBase64(arrayBuffer);
  } catch (error) {
    console.error('Failed to load Amiri font from bundle:', error);
    throw error;
  }
}
