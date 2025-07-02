// خدمة تحليل جودة النص المستخرج وتحسينه
export class TextQualityAnalyzer {
  
  /**
   * تحليل جودة النص المستخرج وتنظيفه
   */
  public static analyzeAndCleanText(text: string, language: 'ar' | 'en'): {
    cleanedText: string;
    quality: 'high' | 'medium' | 'low' | 'poor';
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // تنظيف النص الأساسي
    let cleanedText = this.basicTextCleaning(text);
    
    // تحليل جودة النص
    const qualityMetrics = this.calculateQualityMetrics(cleanedText, language);
    
    // تحديد المشاكل والاقتراحات
    if (qualityMetrics.readabilityScore < 0.3) {
      issues.push(language === 'ar' 
        ? 'النص يحتوي على رموز غير مقروءة أو مشوشة'
        : 'Text contains unreadable or garbled characters');
      
      suggestions.push(language === 'ar'
        ? 'جرب تحويل الملف إلى تنسيق نصي أو نسخ النص مباشرة'
        : 'Try converting the file to text format or copying text directly');
    }
    
    if (qualityMetrics.languageConsistency < 0.5) {
      issues.push(language === 'ar'
        ? 'النص يحتوي على خليط من اللغات أو ترميز غير صحيح'
        : 'Text contains mixed languages or incorrect encoding');
      
      suggestions.push(language === 'ar'
        ? 'تأكد من أن الملف محفوظ بترميز UTF-8 الصحيح'
        : 'Ensure the file is saved with correct UTF-8 encoding');
    }
    
    if (qualityMetrics.structureScore < 0.4) {
      issues.push(language === 'ar'
        ? 'النص يفتقر إلى البنية الواضحة (فقرات، جمل)'
        : 'Text lacks clear structure (paragraphs, sentences)');
      
      suggestions.push(language === 'ar'
        ? 'قد يكون الملف ممسوحاً ضوئياً - استخدم أداة OCR'
        : 'File may be scanned - use OCR tool');
    }
    
    // تحسين النص
    cleanedText = this.enhanceTextStructure(cleanedText, language);
    
    // تحديد مستوى الجودة الإجمالي
    const overallScore = (qualityMetrics.readabilityScore + qualityMetrics.languageConsistency + qualityMetrics.structureScore) / 3;
    
    let quality: 'high' | 'medium' | 'low' | 'poor';
    if (overallScore >= 0.8) quality = 'high';
    else if (overallScore >= 0.6) quality = 'medium';
    else if (overallScore >= 0.4) quality = 'low';
    else quality = 'poor';
    
    return {
      cleanedText,
      quality,
      issues,
      suggestions
    };
  }
  
  /**
   * تنظيف النص الأساسي
   */
  private static basicTextCleaning(text: string): string {
    return text
      // إزالة الرموز الغريبة والتحكم
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      // إزالة الرموز المكررة
      .replace(/(.)\1{4,}/g, '$1$1$1')
      // تنظيف المسافات
      .replace(/\s+/g, ' ')
      // إزالة الأسطر الفارغة المتعددة
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // تنظيف علامات الترقيم المكررة
      .replace(/([.!?؟]){2,}/g, '$1')
      .trim();
  }
  
  /**
   * حساب مقاييس جودة النص
   */
  private static calculateQualityMetrics(text: string, language: 'ar' | 'en'): {
    readabilityScore: number;
    languageConsistency: number;
    structureScore: number;
  } {
    const totalChars = text.length;
    if (totalChars === 0) {
      return { readabilityScore: 0, languageConsistency: 0, structureScore: 0 };
    }
    
    // حساب نسبة الأحرف القابلة للقراءة
    const readableChars = language === 'ar' 
      ? (text.match(/[\u0600-\u06FF\u0750-\u077F\s\d.,!?؟]/g) || []).length
      : (text.match(/[a-zA-Z\s\d.,!?]/g) || []).length;
    
    const readabilityScore = readableChars / totalChars;
    
    // حساب اتساق اللغة
    const targetLanguageChars = language === 'ar'
      ? (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length
      : (text.match(/[a-zA-Z]/g) || []).length;
    
    const nonSpaceChars = text.replace(/\s/g, '').length;
    const languageConsistency = nonSpaceChars > 0 ? targetLanguageChars / nonSpaceChars : 0;
    
    // حساب نقاط البنية
    const sentences = text.split(/[.!?؟]/).filter(s => s.trim().length > 10);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 1);
    
    let structureScore = 0;
    if (sentences.length > 0) structureScore += 0.4;
    if (paragraphs.length > 1) structureScore += 0.3;
    if (words.length > 10) structureScore += 0.3;
    
    return {
      readabilityScore: Math.min(1, readabilityScore),
      languageConsistency: Math.min(1, languageConsistency),
      structureScore: Math.min(1, structureScore)
    };
  }
  
  /**
   * تحسين بنية النص
   */
  private static enhanceTextStructure(text: string, language: 'ar' | 'en'): string {
    // إضافة فواصل بين الجمل إذا كانت مفقودة
    let enhanced = text.replace(/([a-zA-Z\u0600-\u06FF])\s+([A-Z\u0600-\u06FF])/g, '$1. $2');
    
    // تحسين تنسيق الفقرات
    enhanced = enhanced.replace(/([.!?؟])\s*([A-Z\u0600-\u06FF])/g, '$1\n\n$2');
    
    // إزالة المسافات الزائدة
    enhanced = enhanced.replace(/\s+/g, ' ').trim();
    
    return enhanced;
  }
  
  /**
   * اقتراح طرق بديلة لاستخراج النص
   */
  public static suggestAlternativeMethods(fileName: string, language: 'ar' | 'en'): string[] {
    const suggestions: string[] = [];
    
    if (language === 'ar') {
      suggestions.push('جرب نسخ النص من الملف الأصلي ولصقه في ملف نصي جديد');
      suggestions.push('استخدم برنامج قراءة PDF مختلف وجرب "حفظ باسم نص"');
      suggestions.push('إذا كان الملف ممسوحاً ضوئياً، استخدم أداة OCR مثل Google Drive أو Adobe Acrobat');
      suggestions.push('تأكد من أن الملف غير محمي بكلمة مرور');
      suggestions.push('جرب تحويل الملف إلى تنسيق DOCX أو RTF أولاً');
    } else {
      suggestions.push('Try copying text from the original file and pasting into a new text file');
      suggestions.push('Use a different PDF reader and try "Save as Text"');
      suggestions.push('If the file is scanned, use OCR tools like Google Drive or Adobe Acrobat');
      suggestions.push('Ensure the file is not password-protected');
      suggestions.push('Try converting the file to DOCX or RTF format first');
    }
    
    return suggestions;
  }
}