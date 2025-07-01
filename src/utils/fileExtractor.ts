import { ocrService } from './ocrService';
import { enhancedPdfProcessor, ExtractionStrategy } from './enhancedPdfProcessor';

export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        if (file.type === 'application/pdf') {
          const text = await extractTextFromPDF(arrayBuffer, file);
          resolve(text);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const text = await extractTextFromDOCX(arrayBuffer);
          resolve(text);
        } else if (file.type === 'text/plain') {
          const text = await extractTextFromTXT(arrayBuffer);
          resolve(text);
        } else if (file.type.startsWith('image/')) {
          // Handle image files with OCR
          const text = await extractTextFromImage(file);
          resolve(text);
        } else {
          reject(new Error('Unsupported file type'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromImage(file: File): Promise<string> {
  try {
    console.log(`Starting OCR for image file: ${file.name}`);
    
    const result = await ocrService.recognizeFromFile(file, {
      language: 'auto',
      onProgress: (progress) => {
        console.log(`OCR Progress: ${Math.round(progress * 100)}%`);
      }
    });

    console.log(`OCR completed for ${file.name}: ${result.text.length} characters extracted with ${result.confidence}% confidence`);
    
    if (result.text.length < 10) {
      throw new Error('OCR extracted insufficient text content');
    }

    return result.text.substring(0, 50000);
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractTextFromTXT(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try UTF-8 first
  try {
    const text = new TextDecoder('utf-8').decode(uint8Array);
    if (text && !text.includes('�')) {
      return text.trim().substring(0, 50000);
    }
  } catch (error) {
    // Fall through to other encodings
  }
  
  // Try UTF-16 for Arabic text
  try {
    const text = new TextDecoder('utf-16').decode(uint8Array);
    if (text && !text.includes('�')) {
      return text.trim().substring(0, 50000);
    }
  } catch (error) {
    // Fall through
  }
  
  // Try Windows-1256 for Arabic text (fallback)
  try {
    const text = new TextDecoder('windows-1256').decode(uint8Array);
    return text.trim().substring(0, 50000);
  } catch (error) {
    // Final fallback
    return new TextDecoder('utf-8', { fatal: false }).decode(uint8Array).trim().substring(0, 50000);
  }
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer, file: File): Promise<string> {
  console.log(`🔍 Starting enhanced PDF extraction for: ${file.name}`);
  
  try {
    // Use the enhanced PDF processor with auto strategy
    const extractionStrategy: ExtractionStrategy = {
      strategy: 'auto',
      qualityThreshold: 0.6, // Slightly lower threshold for better coverage
      maxPages: 10 // Limit OCR to first 10 pages for performance
    };

    const result = await enhancedPdfProcessor.extractFromPDF(arrayBuffer, extractionStrategy);
    
    console.log(`✅ Enhanced PDF extraction completed:
      - Method: ${result.method}
      - Confidence: ${(result.confidence * 100).toFixed(1)}%
      - Text length: ${result.text.length} characters
      - Arabic ratio: ${(result.metadata.arabicRatio * 100).toFixed(1)}%
      - Processing time: ${result.metadata.extractionTime}ms`);

    if (result.text.length < 50) {
      throw new Error(`Insufficient text extracted (${result.text.length} characters). Document may be image-based or corrupted.`);
    }

    return result.text.substring(0, 50000);
    
  } catch (error) {
    console.error('Enhanced PDF extraction failed:', error);
    
    // Fallback to basic extraction
    console.log('🔄 Falling back to basic PDF extraction...');
    try {
      const basicText = await extractPDFTextBasic(arrayBuffer);
      if (basicText.length >= 50) {
        console.log(`✅ Basic extraction succeeded: ${basicText.length} characters`);
        return basicText.substring(0, 50000);
      }
    } catch (basicError) {
      console.error('Basic PDF extraction also failed:', basicError);
    }
    
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractPDFTextBasic(arrayBuffer: ArrayBuffer): Promise<string> {
  // Basic PDF text extraction as fallback
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Look for text between BT and ET markers
  const textObjectMatches = text.match(/BT\s*(.*?)\s*ET/gs);
  if (textObjectMatches && textObjectMatches.length > 0) {
    for (const match of textObjectMatches) {
      // Extract text from Tj and TJ operators
      const tjMatches = match.match(/\((.*?)\)\s*Tj/g);
      if (tjMatches) {
        for (const tjMatch of tjMatches) {
          const textContent = tjMatch.match(/\((.*?)\)/);
          if (textContent && textContent[1]) {
            extractedText += textContent[1] + ' ';
          }
        }
      }
      
      // Extract text from TJ arrays
      const tjArrayMatches = match.match(/\[(.*?)\]\s*TJ/g);
      if (tjArrayMatches) {
        for (const tjArrayMatch of tjArrayMatches) {
          const arrayContent = tjArrayMatch.match(/\[(.*?)\]/);
          if (arrayContent && arrayContent[1]) {
            const strings = arrayContent[1].match(/\((.*?)\)/g);
            if (strings) {
              for (const str of strings) {
                const content = str.match(/\((.*?)\)/);
                if (content && content[1]) {
                  extractedText += content[1] + ' ';
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Method 2: Look for stream objects if Method 1 didn't work well
  if (extractedText.length < 100) {
    const streamMatches = text.match(/stream\s*(.*?)\s*endstream/gs);
    if (streamMatches) {
      for (const match of streamMatches) {
        const streamContent = match.replace(/stream\s*|\s*endstream/g, '');
        const readableText = streamContent.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F][a-zA-Z\u0600-\u06FF\u0750-\u077F\s]{2,}/g);
        if (readableText) {
          extractedText += readableText.join(' ') + ' ';
        }
      }
    }
  }
  
  // Method 3: Fallback - extract any readable text
  if (extractedText.length < 50) {
    const readableChars = text.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F][a-zA-Z\u0600-\u06FF\u0750-\u077F\s\d.,!?;:()]{3,}/g);
    if (readableChars) {
      extractedText = readableChars.join(' ');
    }
  }
  
  // Clean up the extracted text
  extractedText = extractedText
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/g, ' ')
    .trim();
  
  console.log(`Basic PDF extraction result: ${extractedText.length} characters extracted`);
  return extractedText;
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  // Enhanced DOCX text extraction
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Extract from w:t elements (Word text elements)
  const textMatches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/gs);
  if (textMatches) {
    for (const match of textMatches) {
      const content = match.replace(/<w:t[^>]*>|<\/w:t>/g, '');
      if (content) {
        // Decode HTML entities
        const decoded = content
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        extractedText += decoded + ' ';
      }
    }
  }
  
  // Method 2: Extract from w:p elements (paragraphs) if Method 1 didn't work well
  if (extractedText.length < 100) {
    const paragraphMatches = text.match(/<w:p[^>]*>(.*?)<\/w:p>/gs);
    if (paragraphMatches) {
      for (const match of paragraphMatches) {
        // Remove all XML tags and extract text
        const content = match.replace(/<[^>]*>/g, ' ');
        if (content && content.trim().length > 0) {
          extractedText += content.trim() + ' ';
        }
      }
    }
  }
  
  // Method 3: Fallback - extract any readable text between XML tags
  if (extractedText.length < 50) {
    const readableText = text.match(/>[^<]{3,}</g);
    if (readableText) {
      extractedText = readableText
        .map(match => match.slice(1, -1))
        .filter(content => content.trim().length > 2)
        .join(' ');
    }
  }
  
  // Clean up the extracted text
  extractedText = extractedText
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/g, ' ')
    .trim();
  
  console.log(`DOCX extraction result: ${extractedText.length} characters extracted`);
  return extractedText.substring(0, 50000);
}

export function detectLanguage(text: string): 'ar' | 'en' {
  // Enhanced language detection based on Arabic characters
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const englishChars = text.match(/[a-zA-Z]/g);
  
  const arabicCount = arabicChars ? arabicChars.length : 0;
  const englishCount = englishChars ? englishChars.length : 0;
  
  // If more than 30% Arabic characters, consider it Arabic
  const totalLetters = arabicCount + englishCount;
  if (totalLetters > 0 && arabicCount / totalLetters > 0.3) {
    return 'ar';
  }
  
  return 'en';
}