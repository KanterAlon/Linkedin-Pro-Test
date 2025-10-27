declare module "pdf2json" {
  type ParserError = {
    parserError?: string;
  };

  class PDFParser {
    constructor(context?: unknown, needRawText?: number);
    on(event: "pdfParser_dataError", handler: (errData: ParserError) => void): void;
    on(event: "pdfParser_dataReady", handler: () => void): void;
    parseBuffer(buffer: Buffer): void;
    getRawTextContent(): string;
  }

  export default PDFParser;
}
