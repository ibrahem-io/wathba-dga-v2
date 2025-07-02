// Enhanced file extractor with multiple fallback methods
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
          const text = await extractTextFromPDF(arrayBuffer, file.name);
          resolve(text);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const text = await extractTextFromDOCX(arrayBuffer, file.name);
          resolve(text);
        } else if (file.type === 'text/plain') {
          const text = await extractTextFromTXT(arrayBuffer, file.name);
          resolve(text);
        } else {
          reject(new Error(`Unsupported file type: ${file.type}. Please upload PDF, DOCX, or TXT files only.`));
        }
      } catch (error) {
        console.error('File extraction error:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromTXT(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Try UTF-8 first
  try {
    const text = new TextDecoder('utf-8').decode(uint8Array);
    if (text && !text.includes('�')) {
      return cleanAndLimitText(text);
    }
  } catch (error) {
    // Fall through to other encodings
  }
  
  // Try UTF-16 for Arabic text
  try {
    const text = new TextDecoder('utf-16').decode(uint8Array);
    if (text && !text.includes('�')) {
      return cleanAndLimitText(text);
    }
  } catch (error) {
    // Fall through
  }
  
  // Final fallback
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  const cleanedText = cleanAndLimitText(text);
  
  if (!cleanedText || cleanedText.trim().length < 10) {
    throw new Error(`No readable text found in TXT file "${fileName}". The file may be empty or use an unsupported encoding.`);
  }
  
  return cleanedText;
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  // First try with PDF.js if available
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    try {
      console.log('📄 Attempting PDF.js extraction...');
      return await extractWithPDFJS(arrayBuffer, fileName);
    } catch (pdfJsError) {
      console.warn('PDF.js extraction failed, trying fallback:', pdfJsError);
    }
  }
  
  // Fallback to manual extraction
  console.log('📄 Attempting manual PDF extraction...');
  return await extractPDFManually(arrayBuffer, fileName);
}

async function extractWithPDFJS(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    // Use the global pdfjsLib if available
    const pdfjsLib = (window as any).pdfjsLib;
    
    if (!pdfjsLib) {
      throw new Error('PDF.js not available');
    }
    
    console.log('📄 Loading PDF with PDF.js...');
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`📄 PDF loaded successfully: ${pdf.numPages} pages`);
    let fullText = '';
    
    // Extract text from each page (limit to 50 pages for performance)
    const maxPages = Math.min(pdf.numPages, 50);
    for (let i = 1; i <= maxPages; i++) {
      try {
        console.log(`📄 Processing page ${i}/${maxPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => {
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
        
        // Stop if we have enough text
        if (fullText.length > 40000) {
          console.log('📄 Reached text limit, stopping extraction');
          break;
        }
      } catch (pageError) {
        console.warn(`Error extracting text from page ${i}:`, pageError);
      }
    }
    
    if (!fullText.trim() || fullText.trim().length < 10) {
      throw new Error('No readable text found with PDF.js');
    }
    
    console.log(`✅ PDF.js extraction successful: ${fullText.length} characters`);
    return cleanAndLimitText(fullText);
    
  } catch (error) {
    console.error('PDF.js extraction error:', error);
    throw error;
  }
}

async function extractPDFManually(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check if it's actually a PDF
    const pdfHeader = new TextDecoder('utf-8').decode(uint8Array.slice(0, 5));
    if (!pdfHeader.startsWith('%PDF')) {
      throw new Error(`Invalid PDF file format for "${fileName}"`);
    }
    
    console.log('📄 Attempting manual PDF text extraction...');
    
    // Convert to string for parsing
    const pdfString = new TextDecoder('latin1').decode(uint8Array);
    
    let extractedText = '';
    
    // Method 1: Extract from content streams with better patterns
    const patterns = [
      // Text showing operators
      /\(((?:[^\\()]|\\.)*)?\)\s*Tj/g,
      /\[((?:[^\]\\]|\\.)*)\]\s*TJ/g,
      /\(((?:[^\\()]|\\.)*)?\)\s*'/g,
      /\(((?:[^\\()]|\\.)*)?\)\s*"/g,
      // Text with positioning
      /\(((?:[^\\()]|\\.)*)?\)\s*\d+\.?\d*\s+\d+\.?\d*\s+Td/g,
      /\(((?:[^\\()]|\\.)*)?\)\s*Td/g,
      // Simple text patterns
      /BT\s*\/\w+\s+\d+\.?\d*\s+Tf\s*\(((?:[^\\()]|\\.)*)\)\s*Tj\s*ET/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        if (match[1]) {
          let text = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\(/g, '(')
            .replace(/\\\\)/g, ')')
            .replace(/\\\\/g, '\\');
          
          if (text.trim() && text.length > 1) {
            extractedText += text + ' ';
          }
        }
      }
    }
    
    // Method 2: Extract from xref and object streams
    if (!extractedText.trim()) {
      console.log('📄 Trying xref extraction...');
      const xrefMatches = pdfString.match(/xref[\s\S]*?trailer/g);
      if (xrefMatches) {
        for (const xref of xrefMatches) {
          const textInXref = xref.match(/\b[A-Za-z\u0600-\u06FF\u0750-\u077F]{3,}\b/g);
          if (textInXref && textInXref.length > 5) {
            extractedText += textInXref.join(' ') + ' ';
          }
        }
      }
    }
    
    // Method 3: Look for readable text patterns
    if (!extractedText.trim()) {
      console.log('📄 Trying readable text pattern extraction...');
      const readableMatches = pdfString.match(/[A-Za-z\u0600-\u06FF\u0750-\u077F][A-Za-z\u0600-\u06FF\u0750-\u077F\s]{10,}/g);
      if (readableMatches) {
        extractedText = readableMatches
          .filter(text => text.trim().length > 10)
          .slice(0, 100) // Limit to first 100 matches
          .join(' ');
      }
    }
    
    // Method 4: Final fallback - extract any word-like patterns
    if (!extractedText.trim()) {
      console.log('📄 Trying word pattern extraction...');
      const words = pdfString.match(/\b[A-Za-z\u0600-\u06FF\u0750-\u077F]{2,}\b/g);
      if (words && words.length > 20) {
        extractedText = words
          .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
          .slice(0, 200) // Limit words
          .join(' ');
      }
    }
    
    if (!extractedText.trim() || extractedText.trim().length < 20) {
      throw new Error(`No readable text found in PDF "${fileName}". This PDF may contain only images, be password-protected, corrupted, or require OCR processing.`);
    }
    
    console.log(`✅ Manual PDF extraction successful: ${extractedText.length} characters`);
    return cleanAndLimitText(extractedText);
    
  } catch (error) {
    console.error('Manual PDF extraction error:', error);
    
    if (error instanceof Error && error.message.includes('No readable text found')) {
      throw error; // Re-throw our specific error
    }
    
    throw new Error(
      `Failed to extract text from PDF "${fileName}". ` +
      'This PDF may contain scanned images, be password-protected, corrupted, ' +
      'or use advanced formatting. Please try: ' +
      '1) Converting to a text file, ' +
      '2) Copying and pasting the text into a document, or ' +
      '3) Using a different PDF file with selectable text.'
    );
  }
}

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check if it's actually a DOCX (ZIP format)
    const zipSignature = uint8Array.slice(0, 4);
    const isPossiblyZip = zipSignature[0] === 0x50 && zipSignature[1] === 0x4B;
    
    if (!isPossiblyZip) {
      throw new Error(`Invalid DOCX file format for "${fileName}"`);
    }
    
    console.log('📄 Processing DOCX document...');
    
    // Convert to string for XML parsing
    const docxString = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
    
    let extractedText = '';
    
    // Method 1: Extract from document.xml structure
    const patterns = [
      /<w:t[^>]*>(.*?)<\/w:t>/gs,
      /<t[^>]*>(.*?)<\/t>/gs,
      /<text[^>]*>(.*?)<\/text>/gs
    ];
    
    for (const pattern of patterns) {
      const matches = docxString.match(pattern);
      if (matches) {
        const text = matches
          .map(match => {
            return match
              .replace(/<[^>]*>/g, '')
              .replace(/</g, '<')
              .replace(/>/g, '>')
              .replace(/&/g, '&')
              .replace(/"/g, '"')
              .replace(/&apos;/g, "'");
          })
          .filter(text => text.trim().length > 0)
          .join(' ');
        
        if (text.trim().length > extractedText.length) {
          extractedText = text;
        }
      }
    }
    
    // Method 2: Extract readable content
    if (!extractedText.trim()) {
      console.log('📄 Trying fallback DOCX extraction...');
      const readableContent = docxString
        .replace(/<[^>]*>/g, ' ')
        .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (readableContent.length > 50) {
        extractedText = readableContent;
      }
    }
    
    if (!extractedText.trim() || extractedText.length < 10) {
      throw new Error(`No readable text found in DOCX file "${fileName}". The file may be corrupted or empty.`);
    }
    
    console.log(`✅ DOCX extraction successful: ${extractedText.length} characters`);
    return cleanAndLimitText(extractedText);
    
  } catch (error) {
    console.error('DOCX extraction error:', error);
    
    if (error instanceof Error && error.message.includes('No readable text found')) {
      throw error; // Re-throw our specific error
    }
    
    throw new Error(
      `Failed to extract text from DOCX file "${fileName}". ` +
      'Please try saving the document as a PDF or plain text file, ' +
      'or copy and paste the content into a text document.'
    );
  }
}

function cleanAndLimitText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
    .replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\n]/g, ' ') // Keep only readable chars
    .trim()
    .substring(0, 50000); // Limit to 50k characters
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