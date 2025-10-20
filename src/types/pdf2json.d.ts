declare module "pdf2json" {
  class PDFParser {
    constructor(context?: any, needRawText?: number);
    on(event: "pdfParser_dataError", handler: (errData: any) => void): void;
    on(event: "pdfParser_dataReady", handler: () => void): void;
    parseBuffer(buffer: Buffer): void;
    getRawTextContent(): string;
  }
  export default PDFParser;
}
