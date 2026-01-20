import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export interface ImageSize {
  width: number;
  height: number;
  name: string;
}

export interface ProcessedImage {
  original: {
    path: string;
    width: number;
    height: number;
    size: number;
  };
  variants: Record<string, {
    path: string;
    width: number;
    height: number;
    size: number;
  }>;
  metadata: {
    format: string;
    hasAlpha: boolean;
    orientation?: number;
  };
}

export class ImageProcessor {
  private defaultSizes: ImageSize[] = [
    { name: 'thumbnail', width: 100, height: 100 },
    { name: 'small', width: 300, height: 300 },
    { name: 'medium', width: 600, height: 600 },
    { name: 'large', width: 1200, height: 1200 },
  ];

  async validateImage(filePath: string): Promise<boolean> {
    try {
      const metadata = await sharp(filePath).metadata();
      return metadata.format !== undefined;
    } catch (error) {
      logger.error(`Invalid image file: ${filePath}`, error);
      return false;
    }
  }

  async getImageMetadata(filePath: string): Promise<sharp.Metadata> {
    return await sharp(filePath).metadata();
  }

  async resizeImage(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    options: {
      fit?: keyof sharp.FitEnum;
      position?: string;
      quality?: number;
    } = {}
  ): Promise<void> {
    const { fit = 'cover', position = 'center', quality = 80 } = options;

    await sharp(inputPath)
      .resize(width, height, {
        fit,
        position,
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .png({ quality })
      .toFile(outputPath);
  }

  async generateThumbnails(
    inputPath: string,
    outputDir: string,
    sizes: ImageSize[] = this.defaultSizes
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const extension = path.extname(inputPath);

    for (const size of sizes) {
      const outputPath = path.join(outputDir, `${baseName}_${size.name}${extension}`);
      
      await this.resizeImage(inputPath, outputPath, size.width, size.height);
      results[size.name] = outputPath;
      
      logger.debug(`Generated thumbnail: ${outputPath} (${size.width}x${size.height})`);
    }

    return results;
  }

  async optimizeImage(
    inputPath: string,
    outputPath: string,
    options: {
      quality?: number;
      maxWidth?: number;
      maxHeight?: number;
    } = {}
  ): Promise<void> {
    const { quality = 80, maxWidth, maxHeight } = options;
    const metadata = await this.getImageMetadata(inputPath);

    let resizeOptions = {};
    if (maxWidth || maxHeight) {
      resizeOptions = {
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      };
    }

    const pipeline = sharp(inputPath);

    if (Object.keys(resizeOptions).length > 0) {
      pipeline.resize(resizeOptions);
    }

    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      pipeline.jpeg({ quality });
    } else if (metadata.format === 'png') {
      pipeline.png({ quality });
    } else if (metadata.format === 'webp') {
      pipeline.webp({ quality });
    }

    await pipeline.toFile(outputPath);
  }

  async compressImage(
    inputPath: string,
    outputPath: string,
    targetSizeKB: number
  ): Promise<void> {
    const metadata = await this.getImageMetadata(inputPath);
    const currentSizeKB = (await fs.stat(inputPath)).size / 1024;

    if (currentSizeKB <= targetSizeKB) {
      // Copy as-is if already smaller
      await fs.copyFile(inputPath, outputPath);
      return;
    }

    let quality = 90;
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      await this.optimizeImage(inputPath, outputPath, { quality });

      const newSizeKB = (await fs.stat(outputPath)).size / 1024;
      
      if (newSizeKB <= targetSizeKB) {
        logger.debug(`Compressed image to ${newSizeKB.toFixed(2)}KB with quality ${quality}`);
        return;
      }

      quality -= 10;
      iterations++;

      if (quality <= 10) {
        logger.warn(`Could not compress image below ${targetSizeKB}KB`);
        break;
      }
    }
  }

  async convertToFormat(
    inputPath: string,
    outputPath: string,
    format: 'jpeg' | 'png' | 'webp',
    quality: number = 80
  ): Promise<void> {
    const pipeline = sharp(inputPath);

    switch (format) {
      case 'jpeg':
        await pipeline.jpeg({ quality }).toFile(outputPath);
        break;
      case 'png':
        await pipeline.png({ quality }).toFile(outputPath);
        break;
      case 'webp':
        await pipeline.webp({ quality }).toFile(outputPath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async extractDominantColor(inputPath: string): Promise<string> {
      try {
        const { data, info } = await sharp(inputPath)
          .resize(1, 1)
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Get RGB values from the buffer
        const buffer = Buffer.from(data);
        const r = buffer.readUInt8(0);
        const g = buffer.readUInt8(1);
        const b = buffer.readUInt8(2);

        // Convert RGB to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } catch (error) {
        logger.error(`Failed to extract dominant color: ${inputPath}`, error);
        return '#000000'; // Return black as default
      }
    }

  async createImageHash(inputPath: string): Promise<string> {
      try {
        // Create a perceptual hash of the image
        const buffer = await sharp(inputPath)
          .resize(8, 8) // Resize to 8x8 pixels
          .grayscale() // Convert to grayscale
          .raw() // Get raw pixel data
          .toBuffer();

        // Calculate average pixel value
        let sum = 0;
        const pixelValues = [];

        for (let i = 0; i < buffer.length; i++) {
          const value = buffer.readUInt8(i);
          pixelValues.push(value);
          sum += value;
        }

        const avg = sum / pixelValues.length;

        // Create hash: 1 for pixels above average, 0 for below
        const hash = pixelValues.map(val => val > avg ? '1' : '0').join('');

        return hash;
      } catch (error) {
        logger.error(`Failed to create image hash: ${inputPath}`, error);
        return '0'.repeat(64); // Return 64-bit zero hash as default
      }
    }
}

export const imageProcessor = new ImageProcessor();