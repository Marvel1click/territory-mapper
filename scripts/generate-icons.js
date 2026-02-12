/**
 * PWA Icon Generator Script
 * 
 * Generates PNG icons at all required sizes from an SVG source.
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// SVG source for the Territory Mapper icon
const svgSource = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0066cc"/>
      <stop offset="100%" style="stop-color:#0052a3"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.2"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="128" fill="url(#bgGradient)"/>
  
  <!-- Map pin icon -->
  <g transform="translate(256, 220)" filter="url(#shadow)">
    <!-- Pin body -->
    <path 
      d="M0,-120 C-66.3,-120 -120,-66.3 -120,0 C-120,80 0,200 0,200 C0,200 120,80 120,0 C120,-66.3 66.3,-120 0,-120 Z" 
      fill="#ffffff"
    />
    <!-- Inner circle -->
    <circle cx="0" cy="0" r="50" fill="#0066cc"/>
    <!-- Inner dot -->
    <circle cx="0" cy="0" r="20" fill="#ffffff"/>
  </g>
  
  <!-- Map elements -->
  <g opacity="0.1">
    <path d="M80,400 L200,320 L320,380 L440,300" stroke="#ffffff" stroke-width="20" fill="none" stroke-linecap="round"/>
    <path d="M100,440 L180,400" stroke="#ffffff" stroke-width="15" fill="none" stroke-linecap="round"/>
    <path d="M340,420 L420,380" stroke="#ffffff" stroke-width="15" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

// Maskable SVG (with safe zone padding)
const svgMaskable = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0066cc"/>
      <stop offset="100%" style="stop-color:#0052a3"/>
    </linearGradient>
  </defs>
  
  <!-- Full background for maskable -->
  <rect width="512" height="512" fill="url(#bgGradient)"/>
  
  <!-- Smaller icon for safe zone (center 66%) -->
  <g transform="translate(256, 220) scale(0.75)">
    <path 
      d="M0,-120 C-66.3,-120 -120,-66.3 -120,0 C-120,80 0,200 0,200 C0,200 120,80 120,0 C120,-66.3 66.3,-120 0,-120 Z" 
      fill="#ffffff"
    />
    <circle cx="0" cy="0" r="50" fill="#0066cc"/>
    <circle cx="0" cy="0" r="20" fill="#ffffff"/>
  </g>
</svg>`;

// Apple touch icon SVG
const svgApple = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0066cc"/>
      <stop offset="100%" style="stop-color:#0052a3"/>
    </linearGradient>
  </defs>
  
  <!-- Rounded background for iOS -->
  <rect width="180" height="180" rx="40" fill="url(#bgGradient)"/>
  
  <!-- Map pin (scaled for 180x180) -->
  <g transform="translate(90, 85) scale(0.35)">
    <path 
      d="M0,-120 C-66.3,-120 -120,-66.3 -120,0 C-120,80 0,200 0,200 C0,200 120,80 120,0 C120,-66.3 66.3,-120 0,-120 Z" 
      fill="#ffffff"
    />
    <circle cx="0" cy="0" r="50" fill="#0066cc"/>
    <circle cx="0" cy="0" r="20" fill="#ffffff"/>
  </g>
</svg>`;

// Required icon sizes
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate HTML for rendering SVG to canvas (for environments without canvas)
function generateHTML() {
  const size = 512;
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Territory Mapper - Icon Generator</title>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      padding: 20px;
      background: #f5f5f5;
    }
    .icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .icon-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .icon-item img {
      max-width: 100%;
      height: auto;
    }
    .icon-item p {
      margin: 10px 0 0;
      font-size: 12px;
      color: #666;
    }
    canvas {
      display: none;
    }
  </style>
</head>
<body>
  <h1>Territory Mapper - Icon Generator</h1>
  <p>Right-click each icon to save as PNG, or use the canvas-based generation below.</p>
  
  <div class="icon-grid">
    ${iconSizes.map(size => `
      <div class="icon-item">
        <img src="data:image/svg+xml;base64,${Buffer.from(svgSource).toString('base64')}" width="${size}" height="${size}" />
        <p>icon-${size}x${size}.png</p>
      </div>
    `).join('')}
    <div class="icon-item">
      <img src="data:image/svg+xml;base64,${Buffer.from(svgApple).toString('base64')}" width="180" height="180" />
      <p>apple-touch-icon.png</p>
    </div>
  </div>

  <canvas id="canvas" width="512" height="512"></canvas>
  
  <script>
    // Canvas-based generation for better quality
    async function generateIcons() {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      
      const sizes = ${JSON.stringify(iconSizes)};
      
      for (const size of sizes) {
        canvas.width = size;
        canvas.height = size;
        
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,${Buffer.from(svgSource).toString('base64')}';
        
        await new Promise((resolve) => {
          img.onload = () => {
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
            resolve();
          };
        });
        
        // Trigger download
        const link = document.createElement('a');
        link.download = 'icon-' + size + 'x' + size + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    }
    
    // Auto-generate on page load (with delay to prevent browser blocking)
    // Uncomment the line below to auto-download
    // setTimeout(generateIcons, 1000);
  </script>
</body>
</html>`;
}

// Write files
const outputDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write SVG files
fs.writeFileSync(path.join(outputDir, 'icon-source.svg'), svgSource);
fs.writeFileSync(path.join(outputDir, 'icon-maskable.svg'), svgMaskable);
fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.svg'), svgApple);

// Write generator HTML
fs.writeFileSync(path.join(__dirname, 'icon-generator.html'), generateHTML());

console.log('✅ Icon source files generated:');
console.log('  - public/icons/icon-source.svg');
console.log('  - public/icons/icon-maskable.svg');
console.log('  - public/icons/apple-touch-icon.svg');
console.log('  - scripts/icon-generator.html');
console.log('');
console.log('📋 Next steps:');
console.log('  1. Open scripts/icon-generator.html in a browser');
console.log('  2. Right-click each icon and save as PNG, OR');
console.log('  3. Use a tool like sharp, svg2png, or online converter to generate:');
iconSizes.forEach(size => {
  console.log(`     - public/icons/icon-${size}x${size}.png`);
});
console.log('     - public/icons/apple-touch-icon.png (180x180)');
console.log('');
console.log('🎨 To convert via command line (requires ImageMagick):');
console.log('  cd public/icons');
iconSizes.forEach(size => {
  console.log(`  convert -background none icon-source.svg -resize ${size}x${size} icon-${size}x${size}.png`);
});
console.log('  convert -background none apple-touch-icon.svg -resize 180x180 apple-touch-icon.png');
