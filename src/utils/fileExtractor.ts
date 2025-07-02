// PDF to image conversion and OpenAI Vision API extraction

export async function extractTextFromFile(file: File, language: 'ar' | 'en' = 'ar'): Promise<string> {
  console.log(`📤 Processing ${file.name} for OpenAI Vision API...`);
  
  try {
    let base64: string;
    let mimeType: string;
    
    // Check if file is PDF
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log(`📄 Converting PDF ${file.name} to image...`);
      const pdfImageData = await convertPdfToImage(file);
      base64 = pdfImageData.base64;
      mimeType = pdfImageData.mimeType;
    } else {
      // For image files, convert directly to base64
      base64 = await fileToBase64(file);
      mimeType = file.type || 'image/jpeg';
    }
    
    // Use OpenAI Vision API with the converted image
    const extractedText = await extractTextWithOpenAIVision(base64, file.name, mimeType, language);
    
    console.log(`✅ Successfully extracted ${extractedText.length} characters from ${file.name}`);
    return extractedText;
    
  } catch (error) {
    console.error(`❌ Error processing ${file.name}:`, error);
    
    if (error instanceof Error) {
      // Check for specific API errors
      if (error.message.includes('rate limit')) {
        throw new Error(language === 'ar'
          ? 'تم تجاوز الحد المسموح لاستخدام خدمة الذكاء الاصطناعي. يرجى المحاولة لاحقاً.'
          : 'AI service rate limit exceeded. Please try again later.');
      } else if (error.message.includes('invalid_request_error')) {
        throw new Error(language === 'ar'
          ? 'خطأ في معالجة الملف. قد يكون الملف كبيراً جداً أو بصيغة غير مدعومة.'
          : 'Error processing file. The file may be too large or in an unsupported format.');
      }
    }
    
    throw new Error(language === 'ar'
      ? `فشل في معالجة الملف "${file.name}". يرجى التحقق من صحة الملف والمحاولة مرة أخرى.`
      : `Failed to process file "${file.name}". Please check the file and try again.`);
  }
}

async function convertPdfToImage(file: File): Promise<{ base64: string; mimeType: string }> {
  // Import PDF.js dynamically
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  
  try {
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Get first page
    const page = await pdf.getPage(1);
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Failed to get canvas context');
    }
    
    // Set up viewport with high resolution for better text recognition
    const viewport = page.getViewport({ scale: 2.0 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Render page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Convert canvas to base64 PNG
    const dataUrl = canvas.toDataURL('image/png', 0.95);
    const base64 = dataUrl.split(',')[1];
    
    if (!base64) {
      throw new Error('Failed to convert PDF page to base64');
    }
    
    console.log(`✅ Successfully converted PDF page to image (${base64.length} characters)`);
    
    return {
      base64,
      mimeType: 'image/png'
    };
    
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Failed to convert PDF to image for processing');
  }
}

async function extractTextWithOpenAIVision(
  base64: string, 
  fileName: string, 
  mimeType: string,
  language: 'ar' | 'en' = 'ar'
): Promise<string> {
  // Import OpenAI dynamically
  const OpenAI = (await import('openai')).default;
  
  // Get API key from environment variable
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(language === 'ar'
      ? 'مفتاح OpenAI API غير موجود. يرجى إضافة VITE_OPENAI_API_KEY إلى ملف .env'
      : 'OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file');
  }
  
  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });
  
  try {
    // Ensure we have a valid image MIME type
    const validMimeType = mimeType.startsWith('image/') ? mimeType : 'image/png';
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o for vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: language === 'ar' 
                ? `استخرج كل النص من هذا المستند "${fileName}". قد يكون النص بالعربية أو الإنجليزية. يرجى:
1. استخراج كل النص المرئي بدقة
2. الحفاظ على بنية النص والتنسيق قدر الإمكان
3. إذا كانت هناك جداول، حافظ على بنيتها
4. إذا كانت هناك عناوين أو نقاط أو قوائم مرقمة، احتفظ بها
5. إذا كان النص بالعربية، تأكد من ترتيب القراءة الصحيح من اليمين إلى اليسار
6. أعد النص المستخرج فقط، بدون تعليقات

ركز بشكل خاص على المحتوى المتعلق بـ:
- التحول الرقمي
- الثقافة الرقمية
- البرامج التدريبية
- الأدوات التقنية
- المعايير الحكومية`
                : `Extract all text from this document "${fileName}". The text may be in Arabic or English. Please:
1. Extract ALL visible text accurately
2. Preserve the text structure and formatting as much as possible
3. If there are tables, maintain their structure
4. If there are headers, bullet points, or numbered lists, preserve them
5. If text is in Arabic, ensure proper RTL reading order
6. Return only the extracted text, no commentary

Focus especially on content related to:
- Digital transformation
- Digital culture
- Training programs
- Technical tools
- Government standards`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${validMimeType};base64,${base64}`,
                detail: "high" // High detail for better text recognition
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1 // Low temperature for accurate text extraction
    });
    
    const extractedText = response.choices[0].message.content || '';
    
    // Clean up the extracted text
    const cleanText = extractedText
      .replace(/^(Here's the extracted text:|The extracted text is:|Text from the image:)/i, '')
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .trim();
    
    if (!cleanText || cleanText.length < 10) {
      throw new Error(language === 'ar'
        ? 'لم يتم العثور على نص في المستند'
        : 'No text found in the document');
    }
    
    // Limit to 10,000 characters to prevent token overflow
    return cleanText.substring(0, 10000);
    
  } catch (error) {
    console.error('OpenAI Vision API error:', error);
    throw error;
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64 string
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to convert file to base64'));
        return;
      }
      resolve(base64);
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function detectLanguage(text: string): 'ar' | 'en' {
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
  const totalChars = text.replace(/\s/g, '').length;
  
  if (arabicChars && arabicChars.length > totalChars * 0.3) {
    return 'ar';
  }
  return 'en';
}

export function isVisualDocument(file: File): boolean {
  // Since we're using Vision API for everything, all documents are considered visual
  return true;
}