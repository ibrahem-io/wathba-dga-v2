// src/utils/fileExtractor.ts - Enhanced file extraction with proper debugging

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
        } else {
          throw new Error(`❌ Unsupported file type: ${file.type}`);
        }
        
        console.log(`✅ Extraction complete for ${file.name}`);
        console.log(`📝 Text length: ${text.length} characters`);
        console.log(`🔤 First 200 chars: "${text.substring(0, 200)}..."`);
        console.log(`🈁 Language detected: ${detectLanguage(text)}`);
        
        if (!text || text.trim().length < 20) {
          throw new Error(`❌ Insufficient text extracted from ${file.name}. Got only ${text.length} characters. Please try converting to TXT format.`);
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

async function extractTextFromTXT(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  console.log(`📄 Processing TXT file: ${fileName}`);
  
  const uint8Array = new Uint8Array(arrayBuffer);
  let text = '';
  
  // Try UTF-8 first
  try {
    text = new TextDecoder('utf-8').decode(uint8Array);
    if (text && !text.includes('�')) {
      console.log(`✅ UTF-8 decoding successful for ${fileName}`);
      return text.trim();
    }
  } catch (error) {
    console.warn(`⚠️ UTF-8 decoding failed for ${fileName}, trying other encodings`);
  }
  
  // Try UTF-16 for Arabic text
  try {
    text = new TextDecoder('utf-16').decode(uint8Array);
    if (text && !text.includes('�') && text.length > 10) {
      console.log(`✅ UTF-16 decoding successful for ${fileName}`);
      return text.trim();
    }
  } catch (error) {
    console.warn(`⚠️ UTF-16 decoding failed for ${fileName}`);
  }
  
  // Try Windows-1256 for Arabic text
  try {
    text = new TextDecoder('windows-1256').decode(uint8Array);
    if (text && text.length > 10) {
      console.log(`✅ Windows-1256 decoding successful for ${fileName}`);
      return text.trim();
    }
  } catch (error) {
    console.warn(`⚠️ Windows-1256 decoding failed for ${fileName}`);
  }
  
  // Final fallback
  text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  console.log(`🔄 Using UTF-8 fallback for ${fileName}, extracted ${text.length} characters`);
  return text.trim();
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  console.log(`📕 Processing PDF file: ${fileName}`);
  console.warn(`⚠️ Basic PDF extraction - for production, recommend using server-side PDF processing`);
  
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    let extractedText = '';
    
    // Convert to string to search for text patterns
    let pdfContent = '';
    for (let i = 0; i < Math.min(uint8Array.length, 500000); i++) {
      pdfContent += String.fromCharCode(uint8Array[i]);
    }
    
    // Method 1: Look for text objects between BT and ET
    const textObjectRegex = /BT\s*(.*?)\s*ET/gs;
    const textMatches = pdfContent.match(textObjectRegex);
    
    if (textMatches && textMatches.length > 0) {
      console.log(`📖 Found ${textMatches.length} text objects in PDF`);
      
      extractedText = textMatches
        .map(match => {
          let text = match.replace(/BT\s*|\s*ET/g, '');
          
          // Extract text from parentheses and brackets
          const textInParens = text.match(/\(([^)]*)\)/g);
          const textInBrackets = text.match(/\[([^\]]*)\]/g);
          
          let extracted = '';
          if (textInParens) {
            extracted += textInParens.map(t => t.replace(/[()]/g, '')).join(' ');
          }
          if (textInBrackets) {
            extracted += ' ' + textInBrackets.map(t => t.replace(/[\[\]]/g, '')).join(' ');
          }
          
          return extracted;
        })
        .join(' ')
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Method 2: Look for stream content
    if (!extractedText || extractedText.length < 50) {
      console.log(`🔄 Trying stream extraction for PDF ${fileName}`);
      
      const streamRegex = /stream\s*(.*?)\s*endstream/gs;
      const streamMatches = pdfContent.match(streamRegex);
      
      if (streamMatches) {
        extractedText = streamMatches
          .map(match => match.replace(/stream\s*|\s*endstream/g, ''))
          .join(' ')
          .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    
    // Method 3: Fallback - extract readable characters
    if (!extractedText || extractedText.length < 50) {
      console.log(`🔄 Using character extraction fallback for PDF ${fileName}`);
      
      let fallbackText = '';
      for (let i = 0; i < Math.min(uint8Array.length, 200000); i++) {
        const char = uint8Array[i];
        
        // Include readable ASCII and Arabic characters
        if ((char >= 32 && char <= 126) || (char >= 0xD8 && char <= 0xDF)) {
          fallbackText += String.fromCharCode(char);
        } else if (char === 10 || char === 13) {
          fallbackText += ' ';
        }
      }
      
      extractedText = fallbackText
        .replace(/\s+/g, ' ')
        .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
        .trim();
    }
    
    console.log(`📊 PDF extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 30) {
      throw new Error(`PDF extraction yielded insufficient text (${extractedText.length} chars). Please convert the PDF to TXT format for better results.`);
    }
    
    return extractedText;
  } catch (error) {
    console.error(`❌ PDF extraction failed for ${fileName}:`, error);
    throw new Error(`Failed to extract text from PDF "${fileName}". Please convert to TXT format.`);
  }
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
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
          return text;
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
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
        .join(' ')
        .trim();
    }
    
    console.log(`📊 DOCX extraction result: ${extractedText.length} characters`);
    
    if (extractedText.length < 30) {
      throw new Error(`DOCX extraction yielded insufficient text (${extractedText.length} chars). Please convert to TXT format for better results.`);
    }
    
    return extractedText;
  } catch (error) {
    console.error(`❌ DOCX extraction failed for ${fileName}:`, error);
    throw new Error(`Failed to extract text from DOCX "${fileName}". Please convert to TXT format.`);
  }
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

export function detectLanguage(text: string): 'ar' | 'en' {
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const totalChars = text.replace(/\s/g, '').length;
  
  const arabicRatio = arabicChars ? arabicChars.length / totalChars : 0;
  console.log(`🌐 Language detection - Arabic characters: ${arabicChars?.length || 0}, Total: ${totalChars}, Ratio: ${(arabicRatio * 100).toFixed(1)}%`);
  
  return arabicRatio > 0.15 ? 'ar' : 'en';
}