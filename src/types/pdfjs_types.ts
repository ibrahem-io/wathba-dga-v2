// Type declarations for PDF.js
declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (params: { data: ArrayBuffer }) => {
        promise: Promise<{
          numPages: number;
          getPage: (pageNum: number) => Promise<{
            getTextContent: () => Promise<{
              items: Array<{ str: string } | string>;
            }>;
          }>;
        }>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}

export {};