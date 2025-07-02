import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, File, X, MessageSquare, Bot, User, Loader, AlertCircle, FileText, Eye, Brain } from 'lucide-react';
import { langchainService } from '../services/langchainService';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface UploadedDocument {
  file: File;
  id: string;
  extractedText: string;
  isProcessing: boolean;
  error?: string;
}

interface DocumentChatPageProps {
  language: 'ar' | 'en';
}

export default function DocumentChatPage({ language }: DocumentChatPageProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'assistant',
        content: language === 'ar' 
          ? 'مرحباً! أنا مساعدك الذكي لتحليل الوثائق. ارفع وثائقك واسألني أي سؤال عنها.'
          : 'Hello! I\'m your smart document analysis assistant. Upload your documents and ask me any questions about them.',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [language]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp',
      'image/webp'
    ];

    for (const file of files) {
      if (file.size > maxSize) {
        addMessage('assistant', language === 'ar' 
          ? `حجم الملف ${file.name} كبير جداً. الحد الأقصى 10 ميجابايت.`
          : `File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        addMessage('assistant', language === 'ar' 
          ? `نوع الملف ${file.name} غير مدعوم. يرجى رفع PDF أو DOCX أو TXT أو صور.`
          : `File type ${file.name} is not supported. Please upload PDF, DOCX, TXT, or image files.`);
        continue;
      }

      const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add document to list as processing
      const newDocument: UploadedDocument = {
        file,
        id: documentId,
        extractedText: '',
        isProcessing: true
      };

      setDocuments(prev => [...prev, newDocument]);

      // Add message about processing
      addMessage('assistant', language === 'ar' 
        ? `جاري معالجة الملف "${file.name}"... سأقوم باستخراج النص وتحليله.`
        : `Processing file "${file.name}"... I'll extract and analyze the text.`);

      try {
        // Extract text using the existing document parser
        const parseResult = await langchainService.analyzeCriteria(file, 'document_extraction', language);
        
        if (parseResult) {
          // Update document with extracted text
          setDocuments(prev => prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, extractedText: parseResult.documentContent || '', isProcessing: false }
              : doc
          ));

          addMessage('assistant', language === 'ar' 
            ? `تم تحليل الملف "${file.name}" بنجاح! يمكنك الآن طرح أسئلة حول محتواه.`
            : `Successfully analyzed file "${file.name}"! You can now ask questions about its content.`);
        }
      } catch (error) {
        console.error('Document processing error:', error);
        
        setDocuments(prev => prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, isProcessing: false, error: error instanceof Error ? error.message : 'Unknown error' }
            : doc
        ));

        addMessage('assistant', language === 'ar' 
          ? `عذراً، فشل في معالجة الملف "${file.name}". ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
          : `Sorry, failed to process file "${file.name}". ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const addMessage = (type: 'user' | 'assistant', content: string, isLoading = false) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      isLoading
    };
    setMessages(prev => [...prev, message]);
    return message.id;
  };

  const updateMessage = (messageId: string, content: string, isLoading = false) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content, isLoading }
        : msg
    ));
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message
    addMessage('user', userMessage);

    // Check if we have documents
    const processedDocuments = documents.filter(doc => !doc.isProcessing && !doc.error);
    
    if (processedDocuments.length === 0) {
      addMessage('assistant', language === 'ar' 
        ? 'يرجى رفع وثيقة أولاً حتى أتمكن من الإجابة على أسئلتك.'
        : 'Please upload a document first so I can answer your questions.');
      return;
    }

    // Add loading message
    setIsTyping(true);
    const loadingMessageId = addMessage('assistant', language === 'ar' ? 'جاري التفكير...' : 'Thinking...', true);

    try {
      // Combine all document texts
      const combinedText = processedDocuments
        .map(doc => `=== ${doc.file.name} ===\n${doc.extractedText}`)
        .join('\n\n');

      // Create a prompt for the AI to answer questions about the documents
      const systemPrompt = language === 'ar' ? `
أنت مساعد ذكي متخصص في تحليل الوثائق العربية. لديك النصوص التالية من الوثائق المرفوعة:

${combinedText}

تعليمات:
1. أجب على أسئلة المستخدم بناءً على محتوى الوثائق فقط
2. إذا لم تجد الإجابة في الوثائق، قل ذلك بوضوح
3. اقتبس من النص عند الإمكان
4. كن دقيقاً ومفيداً
5. أجب باللغة العربية

سؤال المستخدم: ${userMessage}
` : `
You are a smart assistant specialized in analyzing Arabic documents. You have the following texts from uploaded documents:

${combinedText}

Instructions:
1. Answer user questions based only on the document content
2. If you can't find the answer in the documents, say so clearly
3. Quote from the text when possible
4. Be accurate and helpful
5. Answer in English

User question: ${userMessage}
`;

      // Use OpenAI to answer the question
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'أنت مساعد ذكي متخصص في تحليل الوثائق العربية. أجب بدقة ووضوح.'
            },
            {
              role: 'user',
              content: systemPrompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || (
        language === 'ar' 
          ? 'عذراً، لم أتمكن من معالجة سؤالك.'
          : 'Sorry, I couldn\'t process your question.'
      );

      updateMessage(loadingMessageId, aiResponse, false);

    } catch (error) {
      console.error('Chat error:', error);
      updateMessage(loadingMessageId, language === 'ar' 
        ? 'عذراً، حدث خطأ أثناء معالجة سؤالك. يرجى المحاولة مرة أخرى.'
        : 'Sorry, an error occurred while processing your question. Please try again.', false);
    } finally {
      setIsTyping(false);
    }
  };

  const removeDocument = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    
    addMessage('assistant', language === 'ar' 
      ? 'تم حذف الوثيقة.'
      : 'Document removed.');
  };

  const formatFileSize = (bytes: number) => {
    const k = 1024;
    const sizes = language === 'ar' 
      ? ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت']
      : ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Eye className="w-5 h-5 text-purple-600" />;
    } else if (file.type === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-600" />;
    }
    return <File className="w-5 h-5 text-blue-600" />;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className={`text-xl font-bold text-gray-800 mb-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? 'رفع الوثائق' : 'Upload Documents'}
        </h2>

        {/* File Upload */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-4 ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            {language === 'ar' 
              ? 'اسحب وأفلت الملفات هنا أو انقر للتحديد'
              : 'Drag and drop files here or click to select'}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            {language === 'ar' 
              ? 'ملفات PDF أو DOCX أو TXT أو صور (حد أقصى 10 ميجابايت لكل ملف)'
              : 'PDF, DOCX, TXT, or image files (Max 10MB each)'}
          </p>
          <p className="text-xs text-blue-600 mb-2">
            {language === 'ar' 
              ? '🤖 تحليل ذكي للوثائق العربية'
              : '🤖 Smart analysis for Arabic documents'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.tiff,.bmp,.webp"
            onChange={handleFileInput}
            className="hidden"
            multiple
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors text-sm ${language === 'ar' ? 'space-x-reverse' : ''}`}
          >
            <Upload className="w-4 h-4" />
            <span>{language === 'ar' ? 'اختر ملفات' : 'Choose Files'}</span>
          </button>
        </div>

        {/* Uploaded Documents */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <h3 className={`font-medium text-gray-700 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'الوثائق المرفوعة:' : 'Uploaded Documents:'}
            </h3>
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className={`flex items-center space-x-3 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                  {getFileIcon(doc.file)}
                  <div>
                    <p className={`text-sm font-medium text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      {doc.file.name}
                    </p>
                    <p className={`text-xs text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      {formatFileSize(doc.file.size)}
                      {doc.isProcessing && (
                        <span className="ml-2 text-blue-600">
                          {language === 'ar' ? '(جاري المعالجة...)' : '(Processing...)'}
                        </span>
                      )}
                      {doc.error && (
                        <span className="ml-2 text-red-600">
                          {language === 'ar' ? '(خطأ)' : '(Error)'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                  {doc.isProcessing && <Loader className="w-4 h-4 text-blue-500 animate-spin" />}
                  {doc.error && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {!doc.isProcessing && !doc.error && <Brain className="w-4 h-4 text-green-500" />}
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                    title={language === 'ar' ? 'إزالة الملف' : 'Remove file'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="bg-white rounded-lg shadow-md flex flex-col h-96">
        {/* Chat Header */}
        <div className="border-b border-gray-200 p-4">
          <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse flex-row-reverse' : ''}`}>
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">
              {language === 'ar' ? 'محادثة الوثائق' : 'Document Chat'}
            </h3>
            <div className="flex-1"></div>
            <span className="text-xs text-gray-500">
              {documents.filter(d => !d.isProcessing && !d.error).length} {language === 'ar' ? 'وثيقة جاهزة' : 'documents ready'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.type === 'user' 
                  ? (language === 'ar' ? 'flex-row-reverse space-x-reverse' : 'flex-row-reverse') 
                  : (language === 'ar' ? 'space-x-reverse' : '')
              }`}
            >
              <div className={`p-2 rounded-full ${
                message.type === 'user' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4 text-blue-600" />
                ) : (
                  <Bot className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className={`flex-1 ${message.type === 'user' ? 'text-right' : (language === 'ar' ? 'text-right' : 'text-left')}`}>
                <div className={`inline-block p-3 rounded-lg max-w-xs lg:max-w-md ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {message.isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>{message.content}</span>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                <p className={`text-xs text-gray-500 mt-1 ${message.type === 'user' ? 'text-right' : (language === 'ar' ? 'text-right' : 'text-left')}`}>
                  {message.timestamp.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={language === 'ar' ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
              className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className={`font-semibold text-blue-800 mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? 'كيفية الاستخدام' : 'How to Use'}
        </h3>
        <ul className={`text-sm text-blue-700 space-y-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>1.</span>
            <span>
              {language === 'ar' 
                ? 'ارفع وثيقة أو أكثر (PDF، DOCX، TXT، أو صور)'
                : 'Upload one or more documents (PDF, DOCX, TXT, or images)'}
            </span>
          </li>
          <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>2.</span>
            <span>
              {language === 'ar' 
                ? 'انتظر حتى يتم تحليل الوثائق بالذكاء الاصطناعي'
                : 'Wait for the documents to be analyzed by AI'}
            </span>
          </li>
          <li className={`flex items-start ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <span className={`${language === 'ar' ? 'ml-2' : 'mr-2'} text-blue-500`}>3.</span>
            <span>
              {language === 'ar' 
                ? 'اطرح أي سؤال عن محتوى الوثائق وستحصل على إجابات ذكية'
                : 'Ask any question about the document content and get smart answers'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}