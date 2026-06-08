/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Captcha simulation for virtual RuneScape client/server security handshakes
 */

/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Captcha generator for virtual RuneScape client/server and hydrocompulsion security handshakes
 */

export class Captcha {
  constructor() {
    console.log("Secure Captcha Engine initialized");
  }

  /**
   * Generates a fully functional security captcha.
   * Returns a random alphanumeric code and an authenticated SVG data URL with distortion and clutter noise.
   */
  async generate(): Promise<{ text: string; data: string }> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters inside security tokens
    let text = "";
    for (let i = 0; i < 5; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const width = 150;
    const height = 50;
    
    // Build active SVG string with random background noise, dots, security-lines, and characters
    let noiseDots = "";
    for (let i = 0; i < 40; i++) {
      const cx = Math.floor(Math.random() * width);
      const cy = Math.floor(Math.random() * height);
      const r = (Math.random() * 1.5 + 0.5).toFixed(1);
      const opacity = (Math.random() * 0.6 + 0.2).toFixed(1);
      noiseDots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#cbd5e1" opacity="${opacity}" />`;
    }

    let securityLines = "";
    const lineColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#6366f1"];
    for (let i = 0; i < 4; i++) {
      const x1 = Math.floor(Math.random() * width);
      const y1 = Math.floor(Math.random() * height);
      const x2 = Math.floor(Math.random() * width);
      const y2 = Math.floor(Math.random() * height);
      const col = lineColors[i % lineColors.length];
      const strokeWidth = (Math.random() * 1.5 + 1.0).toFixed(1);
      securityLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.6" />`;
    }

    let textElements = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = 15 + i * 26 + Math.floor(Math.random() * 6);
      const y = 30 + Math.floor(Math.random() * 8 - 4);
      const angle = Math.floor(Math.random() * 40 - 20); // rotate character between -20 and +20 deg
      const fontSize = Math.floor(Math.random() * 4 + 20); // font-size 20 to 24px
      const colors = ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#e11d48", "#2563eb", "#16a34a", "#d97706"];
      const col = colors[Math.floor(Math.random() * colors.length)];
      textElements += `<text x="${x}" y="${y}" fill="${col}" font-family="monospace, Courier New" font-size="${fontSize}" font-weight="bold" transform="rotate(${angle}, ${x}, ${y})">${char}</text>`;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#090d16" stroke="#1e293b" stroke-width="1.5" rx="4" />
        ${noiseDots}
        ${securityLines}
        ${textElements}
      </svg>
    `.trim().replace(/\s+/g, " ");

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return { text, data: dataUrl };
  }

  async loadFonts(): Promise<void> {
    // Fonts are standard system monospace vectors, loading has been resolved locally
    return Promise.resolve();
  }
}

// Support CommonJS export mapping if node/test environment requires it
declare var module: any;
if (typeof module !== "undefined" && module.exports) {
  module.exports = Captcha;
}
