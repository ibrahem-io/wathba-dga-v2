import { fileToBase64 } from './fileUtils';

export async function extractTextFromFile(file: File): Promise<string> {
  console.log(`🔍 Starting extraction for: ${file.name}`);
  console.log(`📁 File type: ${file.type}`);
  console.log(`📊 File size: ${(file.size / 1024).toFixed(2)} KB`);
  
  try {
    // Check if this is an image file - handle gracefully
    if (isVisualDocument(file)) {
      throw new Error(`Image file detected: "${file.name}". This system currently processes text documents only. Please upload PDF, DOCX, or TXT files for text analysis.`);
    }
    
    // For text-based documents, use traditional text extraction
    if (file.type === 'application/pdf') {
      return await extractTextFromPDFRobust(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCXRobust(file);
    } else if (file.type === 'text/plain') {
      return await extractTextFromTXTRobust(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}. Please upload PDF, DOCX, or TXT files.`);
    }
  } catch (error) {
    console.error(`❌ Error extracting text from ${file.name}:`, error);
    throw error;
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
  const imageTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    'image/tiff'
  ];
  
  return imageTypes.includes(file.type.toLowerCase());
}

async function extractTextFromPDFRobust(file: File): Promise<string> {
  console.log(`🔍 Starting robust PDF extraction for: ${file.name}`);
  
  // Strategy 1: Try direct text extraction using FileReader with text
  try {
    console.log('📄 Attempting direct text extraction...');
    const directText = await extractPDFAsText(file);
    
    // Check if we got meaningful text
    const meaningfulText = directText.replace(/\s+/g, ' ').trim();
    const hasReadableContent = meaningfulText.length > 100 && 
      /[a-zA-Z\u0600-\u06FF]{10,}/.test(meaningfulText);
    
    if (hasReadableContent) {
      console.log('✅ Direct text extraction successful');
      return meaningfulText.substring(0, 10000);
    }
  } catch (error) {
    console.log('❌ Direct text extraction failed:', error);
  }

  // Strategy 2: Try reading as binary and extracting readable text
  try {
    console.log('🔧 Attempting binary text extraction...');
    const binaryText = await extractPDFAsBinary(file);
    
    if (binaryText && binaryText.length > 50) {
      console.log('✅ Binary extraction successful');
      return binaryText;
    }
  } catch (error) {
    console.log('❌ Binary extraction failed:', error);
  }

  // If all text extraction strategies fail, this might be a scanned PDF or image-based PDF
  throw new Error(`Failed to extract text from PDF "${file.name}". This may be a scanned document or image-based PDF. Please try uploading a text-based PDF or convert to a different format.`);
}

async function extractPDFAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        
        if (!text || text.length < 10) {
          throw new Error('No text content found');
        }

        // Extract readable text using regex patterns
        let extractedText = '';
        
        // Look for text between common PDF text markers
        const textPatterns = [
          /BT\s*(.*?)\s*ET/gs,           // Text objects
          /\((.*?)\)\s*Tj/g,            // Text showing operators
          /\[(.*?)\]\s*TJ/g,            // Text array operators
          /\/F\d+\s+\d+\s+Tf\s*(.*?)(?=BT|ET|$)/gs  // Font and text
        ];

        for (const pattern of textPatterns) {
          const matches = text.match(pattern);
          if (matches) {
            extractedText += matches.map(match => 
              match.replace(/[()[\]]/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim()
            ).join(' ') + ' ';
          }
        }

        // Clean up the extracted text
        extractedText = extractedText
          .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (extractedText.length < 50) {
          throw new Error('Insufficient text extracted');
        }

        resolve(extractedText);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read PDF as text'));
    reader.readAsText(file, 'utf-8');
  });
}

async function extractPDFAsBinary(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const binaryString = event.target?.result as string;
        
        if (!binaryString || binaryString.length < 100) {
          throw new Error('No binary content found');
        }

        // Extract readable text from binary content
        let extractedText = '';
        
        // Look for readable text patterns in binary data
        const readableTextRegex = /[\x20-\x7E\u0600-\u06FF\u0750-\u077F]{4,}/g;
        const matches = binaryString.match(readableTextRegex);
        
        if (matches) {
          extractedText = matches
            .filter(match => match.length > 5)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (extractedText.length < 50) {
          throw new Error('Insufficient readable text found in binary');
        }

        resolve(extractedText.substring(0, 10000));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read PDF as binary'));
    reader.readAsBinaryString(file);
  });
}

async function extractTextFromDOCXRobust(file: File): Promise<string> {
  console.log(`🔍 Starting robust DOCX extraction for: ${file.name}`);
  
  // Strategy 1: Try reading as text to extract XML content
  try {
    console.log('📄 Attempting DOCX text extraction...');
    const textContent = await readFileAsText(file);
    
    // Extract text from XML structure
    const xmlMatches = textContent.match(/<w:t[^>]*>(.*?)<\/w:t>/gs);
    if (xmlMatches && xmlMatches.length > 0) {
      const extractedText = xmlMatches
        .map(match => match.replace(/<w:t[^>]*>|<\/w:t>/g, ''))
        .join(' ')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (extractedText.length > 50) {
        console.log('✅ DOCX extraction successful');
        return extractedText.substring(0, 10000);
      }
    }
  } catch (error) {
    console.log('❌ DOCX text extraction failed:', error);
  }

  // Strategy 2: Try binary extraction
  try {
    console.log('🔧 Attempting DOCX binary extraction...');
    const binaryText = await readFileAsBinary(file);
    
    // Look for readable text in binary content
    const readableText = binaryText
      .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (readableText.length > 50) {
      console.log('✅ DOCX binary extraction successful');
      return readableText.substring(0, 10000);
    }
  } catch (error) {
    console.log('❌ DOCX binary extraction failed:', error);
  }

  throw new Error(`Failed to extract text from DOCX "${file.name}". The file may be corrupted, password-protected, or contain primarily images.`);
}

async function extractTextFromTXTRobust(file: File): Promise<string> {
  console.log(`🔍 Starting robust TXT extraction for: ${file.name}`);
  
  // Strategy 1: Try UTF-8 encoding
  try {
    console.log('📄 Attempting UTF-8 extraction...');
    const text = await readFileAsText(file, 'utf-8');
    
    if (text && text.length > 10 && !text.includes('�')) {
      console.log('✅ UTF-8 extraction successful');
      return text.trim().substring(0, 10000);
    }
  } catch (error) {
    console.log('❌ UTF-8 extraction failed:', error);
  }

  // Strategy 2: Try UTF-16 for Arabic text
  try {
    console.log('📄 Attempting UTF-16 extraction...');
    const text = await readFileAsText(file, 'utf-16');
    
    if (text && text.length > 10 && !text.includes('�')) {
      console.log('✅ UTF-16 extraction successful');
      return text.trim().substring(0, 10000);
    }
  } catch (error) {
    console.log('❌ UTF-16 extraction failed:', error);
  }

  // Strategy 3: Try Windows-1256 for Arabic text
  try {
    console.log('📄 Attempting Windows-1256 extraction...');
    const text = await readFileAsText(file, 'windows-1256');
    
    if (text && text.length > 10) {
      console.log('✅ Windows-1256 extraction successful');
      return text.trim().substring(0, 10000);
    }
  } catch (error) {
    console.log('❌ Windows-1256 extraction failed:', error);
  }

  throw new Error(`Failed to extract text from TXT "${file.name}". The file may be using an unsupported encoding.`);
}

// Helper functions that avoid ArrayBuffer entirely
async function readFileAsText(file: File, encoding: string = 'utf-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        reject(new Error('No text content'));
        return;
      }
      resolve(text);
    };
    
    reader.onerror = () => reject(new Error(`Failed to read file as ${encoding}`));
    reader.readAsText(file, encoding);
  });
}

async function readFileAsBinary(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const binaryString = event.target?.result as string;
      if (!binaryString) {
        reject(new Error('No binary content'));
        return;
      }
      resolve(binaryString);
    };
    
    reader.onerror = () => reject(new Error('Failed to read file as binary'));
    reader.readAsBinaryString(file);
  });
}