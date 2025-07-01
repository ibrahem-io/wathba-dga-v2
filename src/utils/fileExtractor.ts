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
      return text.trim();
    }
  } catch (error) {
    // Fall through to other encodings
  }
  
  // Try UTF-16 for Arabic text
  try {
    const text = new TextDecoder('utf-16').decode(uint8Array);
    if (text && !text.includes('�')) {
      return text.trim();
    }
  } catch (error) {
    // Fall through
  }
  
  // Try Windows-1256 for Arabic text (fallback)
  try {
    const text = new TextDecoder('windows-1256').decode(uint8Array);
    return text.trim();
  } catch (error) {
    // Final fallback
    return new TextDecoder('utf-8', { fatal: false }).decode(uint8Array).trim();
  }
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  // Simple PDF text extraction using basic parsing
  // In production, you'd use a library like pdf-parse or PDF.js
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8').decode(uint8Array);
  
  // Basic text extraction - look for text between stream objects
  const textMatches = text.match(/stream\s*(.*?)\s*endstream/gs);
  if (textMatches) {
    return textMatches
      .map(match => match.replace(/stream\s*|\s*endstream/g, ''))
      .join(' ')
      .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Fallback: extract readable text
  return text
    .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 10000); // Limit to first 10k characters
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  // Simple DOCX text extraction
  // In production, you'd use a library like mammoth.js
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8').decode(uint8Array);
  
  // Extract text content from XML structure
  const xmlMatches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/gs);
  if (xmlMatches) {
    return xmlMatches
      .map(match => match.replace(/<w:t[^>]*>|<\/w:t>/g, ''))
      .join(' ')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/&/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Fallback: extract readable text
  return text
    .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 10000); // Limit to first 10k characters
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