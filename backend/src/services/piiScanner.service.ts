/** PII Scanner Service - Minimal Stub */
class PiiScannerService {
  scan(text: string) { return { hasPII: false, redacted: text }; }
}
export default new PiiScannerService();
