import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker with fallback
try {
  // Try to use the bundled worker first
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
} catch (error) {
  // Fallback to a more reliable CDN
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
}

export async function extractTextFromFile(file: File): Promise<string> {
  console.log(`🔍 Starting extraction for: ${file.name}`);
  console.log(`📁 File type: ${file.type}`);
  console.log(`📊 File size: ${(file.size / 1024).toFixed(2)} KB`);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        let text = '';
        
        if (file.type === 'application/pdf') {
          text = await extractTextFromPDF(arrayBuffer, file.name);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          text = await extractTextFromDOCX(arrayBuffer, file.name);
        } else if (file.type === 'text/plain') {
          text = await extractTextFromTXT(arrayBuffer, file.name);
        } else if (file.type.startsWith('image/')) {
          // For image files, return empty string - they will be processed by Vision API
          console.log(`📷 Image file detected: ${file.name} - will use Vision API`);
          text = '';
        } else {
          throw new Error(`❌ Unsupported file type: ${file.type}`);
        }
        
        console.log(`✅ Extraction complete for ${file.name}`);
        console.log(`📝 Text length: ${text.length} characters`);
        if (text.length > 0) {
          console.log(`🔤 First 200 chars: "${text.substring(0, 200)}..."`);
          console.log(`🈁 Language detected: ${detectLanguage(text)}`);
        }
        
        resolve(text.trim());
      } catch (error) {
        console.error(`❌ Error extracting text from ${file.name}:`, error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      const error = new Error(`❌ Failed to read file: ${file.name}`);
      console.error(error);
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  console.log(`📕 Processing PDF file: ${fileName}`);
  
  try {
    // Enhanced PDF.js configuration for better compatibility
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: false,
      useWorkerFetch: false,
      isEvalSupported: false,
      // Remove cMapUrl to avoid additional network requests
    });
    
    const pdf = await loadingTask.promise;
    console.log(`📖 PDF loaded successfully: ${pdf.numPages} pages`);
    
    let fullText = '';
    
    // Extract text from each page with better error handling
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false
        });
        
        // Combine text items from the page with better spacing
        const pageText = textContent.items
          .map((item: any) => {
            if (item.str && item.str.trim()) {
              return item.str;
            }
            return '';
          })
          .filter(text => text.length > 0)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += pageText + '\n';
        }
        
        console.log(`📄 Page ${pageNum}: ${pageText.length} characters extracted`);
      } catch (pageError) {
        console.warn(`⚠️ Error extracting text from page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }
    
    if (!fullText || fullText.trim().length === 0) {
      console.warn(`⚠️ No text content found in PDF ${fileName}`);
      throw new Error(`PDF "${fileName}" contains no readable text. This may be a scanned document or image-based PDF.`);
    }
    
    // Clean up the extracted text
    const cleanedText = cleanExtractedText(fullText);
    
    // Limit to prevent token overflow
    let finalText = cleanedText;
    if (finalText.length > 80000) {
      finalText = finalText.substring(0, 80000) + '\n\n[Text truncated due to length...]';
      console.log(`✂️ Text truncated to 80,000 characters`);
    }
    
    if (finalText.length < 50) {
      throw new Error(`PDF "${fileName}" extracted text is too short (${finalText.length} characters). May be a scanned document.`);
    }
    
    console.log(`✅ PDF extraction successful: ${finalText.length} characters`);
    return finalText;
    
  } catch (error) {
    console.error(`❌ PDF parsing failed for ${fileName}:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error(`PDF "${fileName}" is corrupted or invalid.`);
      } else if (error.message.includes('Password')) {
        throw new Error(`PDF "${fileName}" is password-protected.`);
      } else if (error.message.includes('no readable text')) {
        throw new Error(`PDF "${fileName}" contains no readable text. Please convert to TXT format or use OCR.`);
      } else if (error.message.includes('worker')) {
        // Fallback for worker issues - try manual text extraction
        console.log(`🔄 Worker failed, trying manual extraction for ${fileName}`);
        return await extractTextFromPDFManual(arrayBuffer, fileName);
      }
    }
    
    throw new Error(`Failed to extract text from PDF "${fileName}". ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Fallback manual PDF text extraction
async function extractTextFromPDFManual(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  console.log(`🔧 Manual PDF extraction for: ${fileName}`);
  
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdfContent = new TextDecoder('latin1').decode(uint8Array);
    
    let extractedText = '';
    
    // Method 1: Extract from text objects (BT/ET)
    const textObjectRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    
    while ((match = textObjectRegex.exec(pdfContent)) !== null) {
      const textObject = match[1];
      
      // Extract from Tj operators
      const tjRegex = /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)\s*Tj/g;
      let tjMatch;
      
      while ((tjMatch = tjRegex.exec(textObject)) !== null) {
        const textContent = decodePDFString(tjMatch[1]);
        if (textContent && textContent.trim().length > 0) {
          extractedText += textContent + ' ';
        }
      }
      
      // Extract from TJ arrays
      const tjArrayRegex = /\[((?:[^\[\]\\]|\\.|\\[0-7]{1,3})*)\]\s*TJ/g;
      let tjArrayMatch;
      
      while ((tjArrayMatch = tjArrayRegex.exec(textObject)) !== null) {
        const arrayContent = tjArrayMatch[1];
        const stringRegex = /\(((?:[^()\\]|\\.|\\[0-7]{1,3})*)\)/g;
        let stringMatch;
        
        while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
          const textContent = decodePDFString(stringMatch[1]);
          if (textContent && textContent.trim().length > 0) {
            extractedText += textContent + ' ';
          }
        }
      }
    }
    
    console.log(`🔧 Manual extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 50) {
      throw new Error(`Manual PDF extraction failed - insufficient text found (${extractedText.length} characters)`);
    }
    
    return cleanExtractedText(extractedText);
    
  } catch (error) {
    console.error(`❌ Manual PDF extraction failed:`, error);
    throw new Error(`Both PDF.js and manual extraction failed for "${fileName}". This may be a complex or scanned PDF.`);
  }
}

function decodePDFString(pdfString: string): string {
  if (!pdfString) return '';
  
  let decoded = pdfString;

  try {
    // Handle octal escape sequences
    decoded = decoded.replace(/\\([0-7]{1,3})/g, (match, octal) => {
      const charCode = parseInt(octal, 8);
      return charCode > 0 && charCode < 256 ? String.fromCharCode(charCode) : '';
    });

    // Handle hex escape sequences
    decoded = decoded.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
      const charCode = parseInt(hex, 16);
      return charCode > 0 && charCode < 256 ? String.fromCharCode(charCode) : '';
    });

    // Handle Unicode escape sequences
    decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (match, unicode) => {
      const charCode = parseInt(unicode, 16);
      return String.fromCharCode(charCode);
    });

    // Handle common escape sequences
    decoded = decoded.replace(/\\n/g, '\n');
    decoded = decoded.replace(/\\r/g, '\r');
    decoded = decoded.replace(/\\t/g, '\t');
    decoded = decoded.replace(/\\\\/g, '\\');
    decoded = decoded.replace(/\\'/g, "'");
    decoded = decoded.replace(/\\"/g, '"');
    decoded = decoded.replace(/\\\(/g, '(');
    decoded = decoded.replace(/\\\)/g, ')');

  } catch (error) {
    console.warn('PDF string decoding error:', error);
    return pdfString; // Return original if decoding fails
  }

  return decoded;
}

async function extractTextFromTXT(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  console.log(`📄 Processing TXT file: ${fileName}`);
  
  const uint8Array = new Uint8Array(arrayBuffer);
  let text = '';
  
  // Try UTF-8 first
  try {
    text = new TextDecoder('utf-8').decode(uint8Array);
    if (text && !text.includes('�')) {
      console.log(`✅ UTF-8 decoding successful for ${fileName}`);
      return cleanExtractedText(text);
    }
  } catch (error) {
    console.warn(`⚠️ UTF-8 decoding failed for ${fileName}, trying other encodings`);
  }
  
  // Try UTF-16 for Arabic text
  try {
    text = new TextDecoder('utf-16').decode(uint8Array);
    if (text && !text.includes('�') && text.length > 10) {
      console.log(`✅ UTF-16 decoding successful for ${fileName}`);
      return cleanExtractedText(text);
    }
  } catch (error) {
    console.warn(`⚠️ UTF-16 decoding failed for ${fileName}`);
  }
  
  // Try Windows-1256 for Arabic text
  try {
    text = new TextDecoder('windows-1256').decode(uint8Array);
    if (text && text.length > 10) {
      console.log(`✅ Windows-1256 decoding successful for ${fileName}`);
      return cleanExtractedText(text);
    }
  } catch (error) {
    console.warn(`⚠️ Windows-1256 decoding failed for ${fileName}`);
  }
  
  // Final fallback
  text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  console.log(`🔄 Using UTF-8 fallback for ${fileName}, extracted ${text.length} characters`);
  return cleanExtractedText(text);
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  console.log(`📄 Processing DOCX file: ${fileName}`);
  console.warn(`⚠️ Basic DOCX extraction - for production, recommend using proper DOCX parsing`);
  
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    let extractedText = '';
    
    // Convert to string to search for XML content
    let docxContent = '';
    for (let i = 0; i < Math.min(uint8Array.length, 300000); i++) {
      docxContent += String.fromCharCode(uint8Array[i]);
    }
    
    // Look for XML text elements
    const xmlTextRegex = /<w:t[^>]*>(.*?)<\/w:t>/gs;
    const textMatches = docxContent.match(xmlTextRegex);
    
    if (textMatches && textMatches.length > 0) {
      console.log(`📖 Found ${textMatches.length} text elements in DOCX`);
      
      extractedText = textMatches
        .map(match => {
          // Remove XML tags and decode entities
          let text = match.replace(/<w:t[^>]*>|<\/w:t>/g, '');
          text = text
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/&/g, '&')
            .replace(/"/g, '"')
            .replace(/&apos;/g, "'");
          return text;
        })
        .join(' ');
    }
    
    // Fallback: extract readable text
    if (!extractedText || extractedText.length < 50) {
      console.log(`🔄 Using fallback extraction for DOCX ${fileName}`);
      
      let fallbackText = '';
      for (let i = 0; i < Math.min(uint8Array.length, 100000); i++) {
        const char = uint8Array[i];
        if ((char >= 32 && char <= 126) || char === 10 || char === 13) {
          fallbackText += String.fromCharCode(char);
        }
      }
      
      // Filter out XML noise
      extractedText = fallbackText
        .split(/\s+/)
        .filter(word => {
          return word.length > 2 && 
                 !word.includes('<') && 
                 !word.includes('>') && 
                 !word.includes('xml') &&
                 !/^[0-9]+$/.test(word);
        })
        .join(' ');
    }
    
    const cleanedText = cleanExtractedText(extractedText);
    console.log(`📊 DOCX extraction result: ${cleanedText.length} characters`);
    
    if (cleanedText.length < 30) {
      throw new Error(`DOCX extraction yielded insufficient text (${cleanedText.length} chars). Please convert to TXT format for better results.`);
    }
    
    return cleanedText;
  } catch (error) {
    console.error(`❌ DOCX extraction failed for ${fileName}:`, error);
    throw new Error(`Failed to extract text from DOCX "${fileName}". Please convert to TXT format.`);
  }
}

function cleanExtractedText(text: string): string {
  if (!text) return '';

  // Remove control characters and non-printable characters
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
  
  // Normalize whitespace but preserve line breaks for better readability
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
  cleaned = cleaned.replace(/\n\s*\n/g, '\n'); // Replace multiple newlines with single newline
  
  // Remove lines that are mostly symbols or very short
  const lines = cleaned.split('\n');
  const meaningfulLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length < 3) return false;
    
    // Count meaningful characters
    const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
    const numbers = (trimmed.match(/\d/g) || []).length;
    const meaningfulChars = arabicChars + englishChars + numbers;
    
    // Keep lines with at least 30% meaningful content
    return meaningfulChars > trimmed.length * 0.3;
  });

  const result = meaningfulLines.join('\n').trim();
  
  console.log(`🧹 Text cleaning: ${text.length} → ${result.length} characters`);
  
  return result;
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

// Vision API support functions
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 string
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    
    reader.onerror = () => reject(new Error('Failed to convert file to base64'));
    reader.readAsDataURL(file);
  });
}

export function isVisualDocument(file: File): boolean {
  // Only return true for actual image files that need Vision API
  const imageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/tiff',
    'image/bmp',
    'image/webp'
  ];
  
  return imageTypes.includes(file.type);
}