// Add this to your CriteriaUploadBox.tsx in the analyzeFiles function
const analyzeFiles = async (files: File[]) => {
  if (files.length === 0) return;

  setIsAnalyzing(true);
  setError('');

  try {
    // Extract text from all files with better error handling
    const extractedTexts = await Promise.all(
      files.map(async (file) => {
        try {
          const text = await extractTextFromFile(file);
          
          if (!text || text.trim().length < 20) {
            throw new Error(
              language === 'ar' 
                ? `الملف "${file.name}" لا يحتوي على نص كافٍ للتحليل`
                : `File "${file.name}" does not contain sufficient text for analysis`
            );
          }
          
          return text;
        } catch (extractError) {
          console.error(`Error extracting from ${file.name}:`, extractError);
          
          // Provide specific error messages based on error type
          if (extractError instanceof Error) {
            if (extractError.message.includes('password')) {
              throw new Error(
                language === 'ar' 
                  ? `الملف "${file.name}" محمي بكلمة مرور. يرجى رفع ملف غير محمي`
                  : `File "${file.name}" is password-protected. Please upload an unprotected file`
              );
            } else if (extractError.message.includes('corrupted') || extractError.message.includes('images')) {
              throw new Error(
                language === 'ar' 
                  ? `الملف "${file.name}" قد يحتوي على صور فقط أو تالف. يرجى رفع ملف يحتوي على نص قابل للتحديد`
                  : `File "${file.name}" may contain only images or be corrupted. Please upload a file with selectable text`
              );
            } else if (extractError.message.includes('format')) {
              throw new Error(
                language === 'ar' 
                  ? `تنسيق الملف "${file.name}" غير صالح. يرجى رفع ملف PDF أو DOCX أو TXT صحيح`
                  : `File "${file.name}" has invalid format. Please upload a valid PDF, DOCX, or TXT file`
              );
            }
          }
          
          // Generic error for unknown issues
          throw new Error(
            language === 'ar' 
              ? `فشل في قراءة الملف "${file.name}". يرجى المحاولة بملف آخر أو تحويله إلى تنسيق نصي`
              : `Failed to read file "${file.name}". Please try another file or convert it to text format`
          );
        }
      })
    );

    // Combine all text content
    let combinedText = extractedTexts.join('\n\n');
    
    // Limit combined text to prevent API issues
    const maxCombinedLength = 80000;
    if (combinedText.length > maxCombinedLength) {
      combinedText = combinedText.substring(0, maxCombinedLength) + '\n\n[Text truncated due to length...]';
    }

    if (!combinedText || combinedText.trim().length < 50) {
      throw new Error(language === 'ar' 
        ? 'لم يتم العثور على نص كافٍ في الملفات للتحليل. يرجى التأكد من أن الملفات تحتوي على نص قابل للقراءة'
        : 'Insufficient text found in files for analysis. Please ensure files contain readable text');
    }

    // Analyze against specific criteria
    const result = await analyzeDocumentForCriteria(combinedText, criteriaId, language);
    
    setAnalysis(result);
    onAnalysisComplete(criteriaId, result);

  } catch (error) {
    console.error('Analysis error:', error);
    
    let errorMessage = '';
    
    if (error instanceof Error) {
      // Use the specific error message if it's already user-friendly
      if (error.message.includes('محمي بكلمة مرور') || error.message.includes('password-protected') ||
          error.message.includes('صور فقط') || error.message.includes('only images') ||
          error.message.includes('تنسيق') || error.message.includes('format') ||
          error.message.includes('نص كافٍ') || error.message.includes('sufficient text')) {
        errorMessage = error.message;
      } else if (error.message.includes('API key')) {
        errorMessage = language === 'ar' 
          ? 'مفتاح OpenAI API غير صحيح. يرجى التحقق من الإعدادات'
          : 'Invalid OpenAI API key. Please check your configuration';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = language === 'ar' 
          ? 'خطأ في الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى'
          : 'Network connection error. Please check your connection and try again';
      } else {
        errorMessage = language === 'ar' 
          ? 'حدث خطأ أثناء تحليل الملفات. يرجى المحاولة مرة أخرى أو استخدام ملفات أخرى'
          : 'An error occurred while analyzing the files. Please try again or use different files';
      }
    } else {
      errorMessage = language === 'ar' 
        ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى'
        : 'An unexpected error occurred. Please try again';
    }
    
    setError(errorMessage);
  } finally {
    setIsAnalyzing(false);
  }
};