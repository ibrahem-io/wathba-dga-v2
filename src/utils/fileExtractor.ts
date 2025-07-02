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
          text = await extractTextFromDOCX(arrayBuffer);
        } else if (file.type === 'text/plain') {
          text = await extractTextFromTXT(arrayBuffer);
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
  
  // Try multiple extraction methods in order of preference
  
  // Method 1: Try PDF.js (best for most PDFs)
  try {
    return await extractTextWithPDFJS(arrayBuffer);
  } catch (error) {
    console.warn('PDF.js extraction failed:', error);
  }

  // Method 2: Try manual extraction with improved regex
  try {
    return await extractTextFromPDFManualAdvanced(arrayBuffer);
  } catch (error) {
    console.warn('Manual advanced extraction failed:', error);
  }

  // Method 3: Basic manual extraction as last resort
  try {
    return await extractTextFromPDFBasic(arrayBuffer);
  } catch (error) {
    console.warn('Basic manual extraction failed:', error);
  }

  // If all methods fail, provide a helpful error
  throw new Error(`لا يمكن استخراج النص من الملف "${fileName}". قد يكون الملف معقداً أو ممسوحاً ضوئياً أو محمياً بكلمة مرور. يرجى تجربة ملف PDF آخر أو تحويل الملف إلى تنسيق نصي.

Failed to extract text from "${fileName}". This may be a complex, scanned, or password-protected PDF. Please try another PDF file or convert it to text format.`);
}

async function extractTextWithPDFJS(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamically import PDF.js to avoid bundle issues
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    
    // Configure worker
    if (typeof window !== 'undefined') {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const pdf = await (pdfjsLib as any).getDocument({ 
      data: arrayBuffer,
      verbosity: 0 // Reduce console output
    }).promise;
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 20); // Limit to first 20 pages
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => {
            // Handle both string items and objects with str property
            return typeof item === 'string' ? item : (item.str || '');
          })
          .filter(text => text.trim().length > 0)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += pageText + '\n\n';
        }
      } catch (pageError) {
        console.warn(`Failed to extract page ${i}:`, pageError);
        continue;
      }
    }
    
    const cleanText = cleanExtractedText(fullText);
    
    if (cleanText.length < 50) {
      throw new Error('PDF.js extracted insufficient text');
    }
    
    return cleanText;
  } catch (error) {
    throw new Error(`PDF.js extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractTextFromPDFManualAdvanced(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('latin1').decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Look for text objects with improved regex
  const textObjectRegex = /BT\s+(.*?)\s+ET/gs;
  const textMatches = text.match(textObjectRegex);
  
  if (textMatches && textMatches.length > 0) {
    extractedText = textMatches
      .map(match => {
        // Extract text from Tj and TJ operators
        const tjMatches = match.match(/\((.*?)\)\s*(?:Tj|TJ)/g);
        if (tjMatches) {
          return tjMatches
            .map(tj => tj.replace(/^\(|\)\s*(?:Tj|TJ)$/g, ''))
            .join(' ');
        }
        return '';
      })
      .filter(t => t.trim().length > 0)
      .join(' ');
  }
  
  // Method 2: Look for stream content if text objects don't work
  if (!extractedText || extractedText.length < 50) {
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    const streamMatches = [...text.matchAll(streamRegex)];
    
    extractedText = streamMatches
      .map(match => {
        let content = match[1];
        // Try to decode common PDF text patterns
        content = content.replace(/\\\d{3}/g, ' '); // Replace octal escapes
        content = content.replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u00A0-\u00FF]/g, ' ');
        return content;
      })
      .join(' ');
  }
  
  const cleanText = cleanExtractedText(extractedText);
  
  if (cleanText.length < 50) {
    throw new Error('Advanced manual extraction found insufficient text');
  }
  
  return cleanText;
}

async function extractTextFromPDFBasic(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try different encodings
  const encodings = ['utf-8', 'latin1', 'windows-1256'];
  
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(uint8Array);
      
      // Extract readable text using simple pattern
      let extractedText = text
        .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u00A0-\u00FF\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Look for common PDF keywords to validate extraction
      const hasContent = /(?:stream|BT|ET|Tj|TJ|text|font|page)/i.test(extractedText);
      
      if (hasContent && extractedText.length > 100) {
        const cleanText = cleanExtractedText(extractedText);
        if (cleanText.length >= 50) {
          return cleanText;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('Basic extraction found no readable text');
}

function cleanExtractedText(text: string): string {
  if (!text) return '';

  // Remove control characters and non-printable characters
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
  
  // Normalize whitespace but preserve line breaks for better readability
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
  cleaned = cleaned.replace(/\n\s*\n/g, '\n'); // Replace multiple newlines with single newline
  
  // Remove common PDF artifacts
  cleaned = cleaned.replace(/(?:stream|endstream|BT|ET|Tf|Td|TD|Tm|TL|Tw|Tc|Ts|Tr|Tz)/g, ' ');
  
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
  
  // Limit length to prevent token overflow
  const finalResult = result.substring(0, 80000);
  
  console.log(`🧹 Text cleaning: ${text.length} → ${finalResult.length} characters`);
  
  return finalResult;
}

async function extractTextFromTXT(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log(`📄 Processing TXT file`);
  
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try different encodings for better Arabic support
  const encodings = ['utf-8', 'utf-16', 'windows-1256', 'iso-8859-6'];
  
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(uint8Array);
      
      // Check if decoding was successful (no replacement characters)
      if (text && !text.includes('�') && text.trim().length > 0) {
        console.log(`✅ ${encoding} decoding successful`);
        return text.trim().substring(0, 80000);
      }
    } catch (error) {
      console.warn(`⚠️ ${encoding} decoding failed`);
      continue;
    }
  }
  
  // Fallback to UTF-8 with error handling
  console.log(`🔄 Using UTF-8 fallback`);
  return new TextDecoder('utf-8', { fatal: false })
    .decode(uint8Array)
    .trim()
    .substring(0, 80000);
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log(`📄 Processing DOCX file`);
  console.warn(`⚠️ Basic DOCX extraction - for production, recommend using proper DOCX parsing`);
  
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8').decode(uint8Array);
  
  let extractedText = '';
  
  // Extract text from XML structure with better patterns
  const xmlPatterns = [
    /<w:t[^>]*>(.*?)<\/w:t>/gs,
    /<text[^>]*>(.*?)<\/text>/gs,
    /<t[^>]*>(.*?)<\/t>/gs
  ];
  
  for (const pattern of xmlPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      extractedText = matches
        .map(match => match[1])
        .join(' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      break;
    }
  }
  
  // Fallback: extract readable text
  if (!extractedText || extractedText.length < 50) {
    console.log(`🔄 Using fallback extraction for DOCX`);
    
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
  
  const cleanText = extractedText.substring(0, 80000);
  
  if (!cleanText || cleanText.length < 20) {
    throw new Error('لا يمكن استخراج نص كافٍ من ملف DOCX / Could not extract sufficient text from DOCX file');
  }
  
  console.log(`📊 DOCX extraction result: ${cleanText.length} characters`);
  return cleanText;
}

export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text || text.trim().length === 0) return 'ar'; // Default to Arabic for Saudi context
  
  // Improved language detection
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = arabicChars + latinChars;
  
  if (totalChars === 0) return 'ar'; // Default to Arabic if no detectable characters
  
  const arabicRatio = totalChars > 0 ? arabicChars / totalChars : 0;
  
  console.log(`🌐 Language detection - Arabic: ${arabicChars}, English: ${latinChars}, Total: ${totalChars}, Arabic ratio: ${(arabicRatio * 100).toFixed(1)}%`);
  
  // If more than 30% Arabic characters, consider it Arabic
  if (arabicRatio > 0.3) {
    return 'ar';
  }
  
  // If we have English characters and very few Arabic, it's English
  if (latinChars > 10 && arabicChars < 5) {
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