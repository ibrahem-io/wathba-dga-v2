export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        
        if (file.type === 'application/pdf') {
          const text = await extractTextFromPDF(arrayBuffer);
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
      return text.trim().substring(0, 50000); // Increased limit
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

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // Enhanced PDF text extraction
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Look for text between BT and ET markers (text objects)
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
            // Extract strings from the array
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
        // Look for readable text patterns
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
  
  console.log(`PDF extraction result: ${extractedText.length} characters extracted`);
  
  // Return up to 50k characters
  return extractedText.substring(0, 50000);
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
  
  // Return up to 50k characters
  return extractedText.substring(0, 50000);
}

export function detectLanguage(text: string): 'ar' | 'en' {
  // Simple language detection based on Arabic characters
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const totalChars = text.replace(/\s/g, '').length;
  
  if (arabicChars && arabicChars.length > totalChars * 0.3) {
    return 'ar';
  }
  return 'en';
}