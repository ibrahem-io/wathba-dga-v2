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
          // For image files, return a placeholder - they will be processed by Vision API
          resolve('[IMAGE_FILE_FOR_VISION_API]');
        } else {
          reject(new Error(`Unsupported file type: ${file.type}`));
        }
      } catch (error) {
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
  // Determine if file should be processed with Vision API
  const imageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/tiff',
    'image/bmp',
    'image/webp'
  ];
  
  // Only return true for actual image files
  // PDFs will be handled with text extraction first, then fallback to Vision if needed
  return imageTypes.includes(file.type);
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
  console.log(`🔍 Starting PDF extraction for: ${file.name}`);
  
  try {
    // Use manual extraction method since pdf-parse is not available in browser
    const manualText = await extractPDFTextManual(arrayBuffer);
    const cleanedText = cleanArabicText(manualText);
    
    if (cleanedText.length >= 20) { // Lower threshold for better compatibility
      console.log(`✅ Manual extraction succeeded: ${cleanedText.length} characters`);
      return cleanedText.substring(0, 50000);
    }
    
    // If manual extraction fails, return a placeholder that indicates limited content
    console.log(`⚠️ Manual extraction insufficient (${cleanedText.length} characters). Document may be image-based or have limited text.`);
    return `[LIMITED_TEXT_CONTENT]`;
    
  } catch (error) {
    console.error('PDF extraction failed:', error);
    // Return placeholder for limited content
    return `[LIMITED_TEXT_CONTENT]`;
  }
}

async function extractPDFTextManual(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('latin1').decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Enhanced BT/ET text object extraction
  const textObjectMatches = text.match(/BT\s*(.*?)\s*ET/gs);
  if (textObjectMatches && textObjectMatches.length > 0) {
    console.log(`Found ${textObjectMatches.length} text objects`);
    
    for (const match of textObjectMatches) {
      // Extract from Tj operators
      const tjMatches = match.match(/\((.*?)\)\s*Tj/g);
      if (tjMatches) {
        for (const tjMatch of tjMatches) {
          const textContent = tjMatch.match(/\((.*?)\)/);
          if (textContent && textContent[1]) {
            const decoded = decodePDFString(textContent[1]);
            if (decoded.trim()) {
              extractedText += decoded + ' ';
            }
          }
        }
      }
      
      // Extract from TJ arrays (better for Arabic)
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
                  const decoded = decodePDFString(content[1]);
                  if (decoded.trim()) {
                    extractedText += decoded + ' ';
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Method 2: Stream object extraction
  if (extractedText.length < 100) {
    console.log('Trying stream extraction...');
    const streamMatches = text.match(/stream\s*(.*?)\s*endstream/gs);
    if (streamMatches) {
      for (const match of streamMatches) {
        const streamContent = match.replace(/stream\s*|\s*endstream/g, '');
        
        // Look for readable text patterns
        const readableText = streamContent.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F][a-zA-Z\u0600-\u06FF\u0750-\u077F\s\d.,!?;:()]{2,}/g);
        if (readableText) {
          extractedText += readableText.join(' ') + ' ';
        }
      }
    }
  }
  
  // Method 3: Direct text search
  if (extractedText.length < 50) {
    console.log('Trying direct text search...');
    
    // Look for Arabic text patterns
    const arabicMatches = text.match(/[\u0600-\u06FF\u0750-\u077F][\u0600-\u06FF\u0750-\u077F\s\d.,!?;:()]{3,}/g);
    if (arabicMatches) {
      extractedText += arabicMatches.join(' ') + ' ';
    }
    
    // Look for English text patterns
    const englishMatches = text.match(/[a-zA-Z][a-zA-Z\s\d.,!?;:()]{3,}/g);
    if (englishMatches) {
      extractedText += englishMatches.join(' ') + ' ';
    }
  }
  
  console.log(`Manual PDF extraction result: ${extractedText.length} characters extracted`);
  return extractedText;
}

function decodePDFString(pdfString: string): string {
  let decoded = pdfString;

  try {
    // Handle octal escape sequences
    decoded = decoded.replace(/\\([0-7]{1,3})/g, (match, octal) => {
      const charCode = parseInt(octal, 8);
      return charCode > 0 && charCode < 256 ? String.fromCharCode(charCode) : match;
    });

    // Handle hex escape sequences
    decoded = decoded.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
      const charCode = parseInt(hex, 16);
      return charCode > 0 && charCode < 256 ? String.fromCharCode(charCode) : match;
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
  }

  return decoded;
}

function cleanArabicText(text: string): string {
  if (!text) return '';

  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ');

  // Remove non-printable characters except Arabic, English, numbers, and common punctuation
  text = text.replace(/[^\u0020-\u007E\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/g, ' ');

  // Normalize Arabic characters
  text = text.replace(/[إأآ]/g, 'ا'); // Normalize Alef
  text = text.replace(/[ىي]/g, 'ي');   // Normalize Yeh

  // Fix spacing around numbers and punctuation
  text = text.replace(/(\d+)/g, ' $1 ');
  text = text.replace(/([.!?؟،,;:])/g, ' $1 ');
  text = text.replace(/\s+/g, ' ');

  // Remove lines that are mostly symbols or very short
  const lines = text.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length < 3) return false;
    
    // Count meaningful characters
    const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
    const numbers = (trimmed.match(/\d/g) || []).length;
    const meaningfulChars = arabicChars + englishChars + numbers;
    
    // Keep lines with at least 20% meaningful content (more lenient)
    return meaningfulChars > trimmed.length * 0.2;
  });

  const result = cleanedLines.join('\n').trim();
  console.log(`Text cleaning: ${text.length} → ${result.length} characters`);
  
  return result;
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
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/&/g, '&')
          .replace(/"/g, '"')
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
  const cleanedText = cleanArabicText(extractedText);
  
  console.log(`DOCX extraction result: ${cleanedText.length} characters extracted`);
  return cleanedText.substring(0, 50000);
}

export function detectLanguage(text: string): 'ar' | 'en' {
  // Enhanced language detection based on Arabic characters
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const englishChars = text.match(/[a-zA-Z]/g);
  
  const arabicCount = arabicChars ? arabicChars.length : 0;
  const englishCount = englishChars ? englishChars.length : 0;
  
  // If more than 20% Arabic characters, consider it Arabic
  const totalLetters = arabicCount + englishCount;
  if (totalLetters > 0 && arabicCount / totalLetters > 0.2) {
    return 'ar';
  }
  
  return 'en';
}