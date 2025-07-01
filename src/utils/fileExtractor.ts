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
    // Try pdf-parse first for better text extraction
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(arrayBuffer);
    
    if (data.text && data.text.trim().length > 50) {
      const cleanedText = cleanArabicText(data.text);
      console.log(`✅ pdf-parse extraction successful: ${cleanedText.length} characters`);
      return cleanedText.substring(0, 50000);
    }
    
    console.log('⚠️ pdf-parse extracted insufficient text, trying manual extraction...');
  } catch (error) {
    console.log('pdf-parse failed, falling back to manual extraction:', error);
  }
  
  // Fallback to manual extraction
  try {
    const manualText = await extractPDFTextManual(arrayBuffer);
    const cleanedText = cleanArabicText(manualText);
    
    if (cleanedText.length >= 50) {
      console.log(`✅ Manual extraction succeeded: ${cleanedText.length} characters`);
      return cleanedText.substring(0, 50000);
    }
    
    throw new Error(`Insufficient text extracted (${cleanedText.length} characters). Document may be image-based or corrupted.`);
    
  } catch (error) {
    console.error('All PDF extraction methods failed:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    
    // Keep lines with at least 30% meaningful content
    return meaningfulChars > trimmed.length * 0.3;
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