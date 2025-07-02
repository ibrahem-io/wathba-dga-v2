import { fileToBase64 } from './fileUtils';
import { extractTextFromImageWithVision } from '../services/openaiService';

// This file now only contains utility functions for Vision API processing
// All local text extraction has been removed

export async function extractTextFromFile(file: File): Promise<string> {
  console.log(`🔍 Starting Vision API extraction for: ${file.name}`);
  console.log(`📁 File type: ${file.type}`);
  console.log(`📊 File size: ${(file.size / 1024).toFixed(2)} KB`);
  
  try {
    // ALWAYS use Vision API for ALL file types
    console.log(`📷 Converting file to base64: ${file.name}`);
    const base64Image = await fileToBase64(file);
    
    console.log(`🤖 Using Vision API to extract text from: ${file.name}`);
    const language = 'ar'; // Default to Arabic for Saudi context
    const extractedText = await extractTextFromImageWithVision(base64Image, language);
    
    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error(`No readable text found in file: ${file.name}`);
    }
    
    console.log(`✅ Vision API extraction successful: ${extractedText.length} characters`);
    return extractedText;
    
  } catch (error) {
    console.error(`❌ Vision API extraction failed for ${file.name}:`, error);
    
    if (error instanceof Error && error.message.includes('unsupported image')) {
      throw new Error(`File format not supported by Vision API. Please convert "${file.name}" to PNG, JPEG, GIF, or WebP format and try again.`);
    }
    
    throw new Error(`Failed to extract text from "${file.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text || text.trim().length === 0) return 'ar'; // Default to Arabic for Saudi context
  
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const englishChars = text.match(/[a-zA-Z]/g);
  
  const arabicCount = arabicChars ? arabicChars.length : 0;
  const englishCount = englishChars ? englishChars.length : 0;
  const totalChars = text.replace(/\s/g, '').length;
  
  const arabicRatio = totalChars > 0 ? arabicCount / totalChars : 0;
  
  console.log(`🌐 Language detection - Arabic: ${arabicCount}, English: ${englishCount}, Total: ${totalChars}, Arabic ratio: ${(arabicRatio * 100).toFixed(1)}%`);
  
  // If more than 15% Arabic characters, consider it Arabic
  if (arabicRatio > 0.15) {
    return 'ar';
  }
  
  // If we have English characters and very few Arabic, it's English
  if (englishCount > 10 && arabicCount < 5) {
    return 'en';
  }
  
  // Default to Arabic for Saudi government context
  return 'ar';
}

export function isVisualDocument(file: File): boolean {
  // Since we're using Vision API for everything, all documents are considered visual
  return true;
}