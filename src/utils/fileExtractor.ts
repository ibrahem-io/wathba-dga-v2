export async function extractTextFromFile(file: File): Promise<string> {
  console.log(`🔍 Starting text extraction for: ${file.name} (${file.type})`);
  
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
          // For image files, return empty string - they will be processed by Vision API
          console.log(`📷 Image file detected: ${file.name} - will use Vision API`);
          resolve('');
        } else {
          reject(new Error(`Unsupported file type: ${file.type}`));
        }
      } catch (error) {
        console.error(`Text extraction failed for ${file.name}:`, error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

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

async function extractTextFromTXT(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log('📄 Extracting text from TXT file...');
  
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try UTF-8 first
  try {
    const text = new TextDecoder('utf-8').decode(uint8Array);
    if (text && !text.includes('�')) {
      const cleanedText = cleanExtractedText(text);
      console.log(`✅ TXT extraction successful: ${cleanedText.length} characters`);
      return cleanedText;
    }
  } catch (error) {
    console.warn('UTF-8 decoding failed, trying alternatives...');
  }
  
  // Try UTF-16 for Arabic text
  try {
    const text = new TextDecoder('utf-16').decode(uint8Array);
    if (text && !text.includes('�')) {
      const cleanedText = cleanExtractedText(text);
      console.log(`✅ TXT extraction (UTF-16) successful: ${cleanedText.length} characters`);
      return cleanedText;
    }
  } catch (error) {
    console.warn('UTF-16 decoding failed...');
  }
  
  // Final fallback
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  const cleanedText = cleanExtractedText(text);
  console.log(`⚠️ TXT extraction (fallback): ${cleanedText.length} characters`);
  return cleanedText;
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer, file: File): Promise<string> {
  console.log(`📄 Starting PDF text extraction for: ${file.name}`);
  
  try {
    // Use enhanced manual extraction
    const extractedText = await extractPDFTextAdvanced(arrayBuffer);
    const cleanedText = cleanExtractedText(extractedText);
    
    console.log(`📄 PDF extraction result: ${cleanedText.length} characters`);
    
    if (cleanedText.length >= 100) {
      console.log(`✅ PDF extraction successful`);
      return cleanedText;
    } else if (cleanedText.length >= 20) {
      console.log(`⚠️ PDF extraction partial - limited content found`);
      return cleanedText;
    } else {
      console.log(`❌ PDF extraction failed - insufficient content`);
      throw new Error('PDF contains no readable text content. This may be a scanned document or image-based PDF.');
    }
    
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractPDFTextAdvanced(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const pdfContent = new TextDecoder('latin1').decode(uint8Array);
  
  let extractedText = '';
  
  console.log('🔍 Method 1: Extracting from text objects (BT/ET)...');
  
  // Method 1: Enhanced text object extraction
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
  
  console.log(`📄 Method 1 result: ${extractedText.length} characters`);
  
  // Method 2: Stream content extraction (if Method 1 insufficient)
  if (extractedText.length < 100) {
    console.log('🔍 Method 2: Extracting from streams...');
    
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let streamMatch;
    
    while ((streamMatch = streamRegex.exec(pdfContent)) !== null) {
      const streamContent = streamMatch[1];
      
      // Look for readable text patterns in streams
      const readableTextRegex = /[a-zA-Z\u0600-\u06FF\u0750-\u077F][a-zA-Z\u0600-\u06FF\u0750-\u077F\s\d.,!?;:()]{2,}/g;
      let textMatch;
      
      while ((textMatch = readableTextRegex.exec(streamContent)) !== null) {
        const text = textMatch[0].trim();
        if (text.length > 2) {
          extractedText += text + ' ';
        }
      }
    }
    
    console.log(`📄 Method 2 result: ${extractedText.length} characters total`);
  }
  
  // Method 3: Direct text pattern search (if still insufficient)
  if (extractedText.length < 50) {
    console.log('🔍 Method 3: Direct text pattern search...');
    
    // Arabic text patterns
    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F][\u0600-\u06FF\u0750-\u077F\s\d.,!?;:()]{3,}/g;
    let arabicMatch;
    
    while ((arabicMatch = arabicRegex.exec(pdfContent)) !== null) {
      extractedText += arabicMatch[0] + ' ';
    }
    
    // English text patterns
    const englishRegex = /[a-zA-Z][a-zA-Z\s\d.,!?;:()]{3,}/g;
    let englishMatch;
    
    while ((englishMatch = englishRegex.exec(pdfContent)) !== null) {
      extractedText += englishMatch[0] + ' ';
    }
    
    console.log(`📄 Method 3 result: ${extractedText.length} characters total`);
  }
  
  return extractedText;
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

function cleanExtractedText(text: string): string {
  if (!text) return '';

  // Remove control characters and non-printable characters
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  
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
  
  // Final cleanup
  const finalResult = result
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  console.log(`🧹 Text cleaning: ${text.length} → ${finalResult.length} characters`);
  
  return finalResult;
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  console.log('📄 Extracting text from DOCX file...');
  
  const uint8Array = new Uint8Array(arrayBuffer);
  const docxContent = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Extract from w:t elements (Word text elements)
  const textElementRegex = /<w:t[^>]*>(.*?)<\/w:t>/gs;
  let match;
  
  while ((match = textElementRegex.exec(docxContent)) !== null) {
    const content = match[1];
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
  
  console.log(`📄 Method 1 (w:t elements): ${extractedText.length} characters`);
  
  // Method 2: Extract from paragraphs if Method 1 didn't work well
  if (extractedText.length < 100) {
    console.log('🔍 Method 2: Extracting from paragraphs...');
    
    const paragraphRegex = /<w:p[^>]*>(.*?)<\/w:p>/gs;
    let paragraphMatch;
    
    while ((paragraphMatch = paragraphRegex.exec(docxContent)) !== null) {
      // Remove all XML tags and extract text
      const content = paragraphMatch[1].replace(/<[^>]*>/g, ' ');
      if (content && content.trim().length > 0) {
        extractedText += content.trim() + ' ';
      }
    }
    
    console.log(`📄 Method 2 result: ${extractedText.length} characters total`);
  }
  
  // Method 3: Fallback - extract any readable text between XML tags
  if (extractedText.length < 50) {
    console.log('🔍 Method 3: Fallback extraction...');
    
    const readableTextRegex = />[^<]{3,}</g;
    let textMatch;
    
    while ((textMatch = readableTextRegex.exec(docxContent)) !== null) {
      const content = textMatch[0].slice(1, -1).trim();
      if (content.length > 2) {
        extractedText += content + ' ';
      }
    }
    
    console.log(`📄 Method 3 result: ${extractedText.length} characters total`);
  }
  
  const cleanedText = cleanExtractedText(extractedText);
  console.log(`✅ DOCX extraction completed: ${cleanedText.length} characters`);
  
  return cleanedText;
}

export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text || text.trim().length === 0) return 'ar'; // Default to Arabic
  
  // Count Arabic and English characters
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const englishChars = text.match(/[a-zA-Z]/g);
  
  const arabicCount = arabicChars ? arabicChars.length : 0;
  const englishCount = englishChars ? englishChars.length : 0;
  
  // If more than 15% Arabic characters, consider it Arabic
  const totalLetters = arabicCount + englishCount;
  if (totalLetters > 0 && arabicCount / totalLetters > 0.15) {
    return 'ar';
  }
  
  // If we have English characters and very few Arabic, it's English
  if (englishCount > 10 && arabicCount < 5) {
    return 'en';
  }
  
  // Default to Arabic for Saudi government context
  return 'ar';
}