/** Query Parser Service - Minimal Stub */
class QueryParserService {
  parse(query: string) { return { original: query, parsed: query, entities: [] }; }
}
export default new QueryParserService();
