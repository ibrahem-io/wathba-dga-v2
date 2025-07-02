import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export async function extractTextFromFile(file: File): Promise<string> {
  console.log(`🔍 Starting extraction for: ${file.name}`);
  console.log(`📁 File type: ${file.type}`);
  console.log(`📊 File size: ${(file.size / 1024).toFixed(2)} KB`);
  
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
  try {
    console.log('📄 Loading PDF document...');
    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    console.log(`📄 PDF has ${pdf.numPages} pages`);
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        console.log(`📄 Processing page ${i}/${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => {
            // Handle both string items and objects with 'str' property
            if (typeof item === 'string') {
              return item;
            } else if (item && typeof item.str === 'string') {
              return item.str;
            }
            return '';
          })
          .join(' ');
        
        if (pageText.trim()) {
          fullText += pageText + '\n\n';
        }
      } catch (pageError) {
        console.warn(`Error extracting text from page ${i}:`, pageError);
        // Continue with other pages
      }
    }
    
    // Clean up the text
    const cleanedText = fullText
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log(`✅ PDF text extraction completed: ${cleanedText.length} characters`);
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No readable text found in PDF');
    }
    
    // Limit to 50k characters to stay well under API limits
    return cleanedText.substring(0, 50000);
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. The file may be corrupted, password-protected, or contain only images.');
  }
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('📄 Processing DOCX document...');
    // For DOCX files, we need a proper library like mammoth.js
    // This is a fallback that attempts basic text extraction
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string for XML parsing
    let text = '';
    try {
      text = new TextDecoder('utf-8').decode(uint8Array);
    } catch (error) {
      throw new Error('Failed to decode DOCX file');
    }
    
    let extractedText = '';
    
    // Extract text content from XML structure
    const xmlMatches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/gs);
    if (xmlMatches && xmlMatches.length > 0) {
      extractedText = xmlMatches
        .map(match => {
          // Remove XML tags and decode HTML entities
          return match
            .replace(/<w:t[^>]*>|<\/w:t>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    if (!extractedText || extractedText.length < 10) {
      // Fallback: try to extract any readable text
      extractedText = text
        .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    console.log(`✅ DOCX text extraction completed: ${extractedText.length} characters`);
    
    if (!extractedText || extractedText.length < 10) {
      throw new Error('No readable text found in DOCX file');
    }
    
    // Limit to 50k characters
    return extractedText.substring(0, 50000);
    
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX file. Please try converting to PDF or plain text.');
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