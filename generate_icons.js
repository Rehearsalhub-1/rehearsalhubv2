const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconJpg = path.join(__dirname, 'assets/icon.jpg');
const adaptiveJpg = path.join(__dirname, 'assets/adaptive-icon.jpg');
const splashJpg = path.join(__dirname, 'assets/splash-icon.jpg');

const androidResPath = path.join(__dirname, 'android/app/src/main/res');

const sizes = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192
};

const splashSizes = {
  'mdpi': 288,
  'hdpi': 432,
  'xhdpi': 576,
  'xxhdpi': 864,
  'xxxhdpi': 1152
};

const PADDING_FACTOR = 0.75; // 75% to prevent Android circular mask from cutting off the gold ring

// Helper function to create a padded image buffer
async function createPaddedBuffer(inputPath, targetSize) {
  const innerSize = Math.floor(targetSize * PADDING_FACTOR);
  
  // Create an empty white canvas
  return await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 } // Pure white padding
      }
    })
    .composite([
      {
        input: await sharp(inputPath).resize(innerSize, innerSize).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toBuffer();
}

async function generateIcons() {
  try {
    console.log('Generating padded Expo assets...');
    
    // 1024x1024 padded versions
    if (fs.existsSync(iconJpg)) {
      const paddedIcon = await createPaddedBuffer(iconJpg, 1024);
      fs.writeFileSync(path.join(__dirname, 'assets/icon.png'), paddedIcon);
    }
    if (fs.existsSync(adaptiveJpg)) {
      const paddedAdaptive = await createPaddedBuffer(adaptiveJpg, 1024);
      fs.writeFileSync(path.join(__dirname, 'assets/adaptive-icon.png'), paddedAdaptive);
    }
    if (fs.existsSync(splashJpg)) {
      const paddedSplash = await createPaddedBuffer(splashJpg, 1024);
      fs.writeFileSync(path.join(__dirname, 'assets/splash-icon.png'), paddedSplash);
      if (fs.existsSync(path.join(__dirname, 'assets/splash.png'))) {
        fs.writeFileSync(path.join(__dirname, 'assets/splash.png'), paddedSplash);
      }
    }

    // Now let's generate the native Android mipmaps
    for (const [density, size] of Object.entries(sizes)) {
      const folderPath = path.join(androidResPath, `mipmap-${density}`);
      
      if (!fs.existsSync(folderPath)) {
        continue;
      }

      console.log(`Generating padded icons for ${density} (${size}x${size})...`);
      
      if (fs.existsSync(iconJpg)) {
        const paddedIcon = await createPaddedBuffer(iconJpg, size);
        fs.writeFileSync(path.join(folderPath, 'ic_launcher.png'), paddedIcon);
          
        const circleSvg = Buffer.from(
          `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`
        );
        
        await sharp(paddedIcon)
          .composite([{ input: circleSvg, blend: 'dest-in' }])
          .png()
          .toFile(path.join(folderPath, 'ic_launcher_round.png'));
      }

      if (fs.existsSync(adaptiveJpg)) {
        const paddedAdaptive = await createPaddedBuffer(adaptiveJpg, size);
        fs.writeFileSync(path.join(folderPath, 'ic_launcher_foreground.png'), paddedAdaptive);
      }
    }

    // Now let's generate the splash screens for drawable-* folders
    for (const [density, size] of Object.entries(splashSizes)) {
      const folderPath = path.join(androidResPath, `drawable-${density}`);
      
      if (!fs.existsSync(folderPath)) {
        continue;
      }

      console.log(`Generating padded splash for ${density} (${size}x${size})...`);
      
      if (fs.existsSync(splashJpg)) {
        const paddedSplash = await createPaddedBuffer(splashJpg, size);
        fs.writeFileSync(path.join(folderPath, 'splashscreen_logo.png'), paddedSplash);
      }
    }
    
    console.log('Successfully generated all PADDED icons including foreground and splash drawables!');
  } catch (error) {
    console.error('Error generating padded icons:', error);
  }
}

generateIcons();
