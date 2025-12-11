/**
 * KODA PATTERN CLASSIFICATION ENGINE V2 - ENHANCED
 * Production-Ready Pattern-Based Intent Classification
 *
 * This is Layer 0 of the intent classification system.
 * It uses keywords and regex patterns to classify intents WITHOUT calling LLM.
 *
 * ENHANCED VERSION with ALL keywords from categories_parsed.json
 *
 * Generated: 2025-12-11T17:14:20.719Z
 * Languages: EN, PT-BR, ES
 */

import {
  PrimaryIntent,
  KnowledgeSource,
  RAGMode,
  AnswerStyle,
  TargetDocumentScope,
  TemporalExpressionType,
  ContextPatternType,
  FallbackType,
  IntentClassification,
  ReasoningFlags,
  INTENT_REQUIRES_RAG,
  INTENT_REQUIRES_LLM,
  INTENT_KNOWLEDGE_SOURCE
} from '../types/intentV2.types';

// ============================================================================
// PATTERN MATCHING UTILITIES
// ============================================================================

/**
 * Normalize query for pattern matching
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")  // Smart quotes
    .replace(/[\u201C\u201D]/g, '"');
}

/**
 * Check if query contains any of the keywords
 */
function containsKeywords(query: string, keywords: string[]): boolean {
  const normalized = normalizeQuery(query);
  return keywords.some(keyword => {
    // Handle multi-word keywords (phrases)
    if (keyword.includes(' ')) {
      return normalized.includes(keyword.toLowerCase());
    }
    // Single word - use word boundary
    const pattern = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return pattern.test(normalized);
  });
}

/**
 * Check if query matches any of the regex patterns
 */
function matchesPatterns(query: string, patterns: RegExp[]): RegExp | null {
  const normalized = normalizeQuery(query);
  for (const pattern of patterns) {
    if (pattern.test(normalized)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Extract document name from query
 */
function extractDocumentName(query: string): string | null {
  const patterns = [
    /(?:no|do|from|in|en|del)\s+(?:documento|arquivo|file|document|pdf|docx)\s+["']?([^"'\n]+)["']?/i,
    /(?:documento|arquivo|file|document)\s+["']([^"']+)["']/i,
    /["']([^"']+\.(?:pdf|docx|xlsx|pptx|txt|csv))["']?/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract folder name from query
 */
function extractFolderName(query: string): string | null {
  const patterns = [
    /(?:na|da|from|in|en|de la)\s+(?:pasta|folder|carpeta)\s+["']?([^"'\n]+)["']?/i,
    /(?:pasta|folder|carpeta)\s+["']([^"']+)["']/i
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

// ============================================================================
// KEYWORD DATABASES (Generated from categories_parsed.json - COMPLETE)
// ============================================================================

const DOC_QA_KEYWORDS = [
  'what', 'what\'s', 'whats', 'que', 'qué', 'qual', 'quais', 'o que',
  'lo que', 'which', 'cuál', 'where', 'onde', 'dónde', 'when', 'quando',
  'cuándo', 'who', 'quem', 'quién', 'why', 'por que', 'por qué', 'how',
  'como', 'cómo', 'does', 'faz', 'hace', 'is', 'é', 'es',
  'are', 'são', 'son', 'was', 'foi', 'fue', 'were', 'foram',
  'fueron', 'can you', 'você pode', 'puedes', 'could you', 'poderia', 'podrías', 'would you',
  'você poderia', 'will you', 'você vai', 'vas a', 'show me', 'mostre-me', 'muéstrame', 'tell me',
  'me diga', 'dime', 'explain', 'explique', 'explica', 'describe', 'descreva', 'find',
  'encontre', 'encuentra', 'search', 'busque', 'busca', 'look for', 'procure', 'locate',
  'localize', 'localiza', 'according to', 'de acordo com', 'según', 'based on', 'baseado em', 'basado en',
  'in the document', 'no documento', 'en el documento', 'from the file', 'do arquivo', 'del archivo', 'mentioned in', 'mencionado em',
  'mencionado en', 'stated in', 'declarado em', 'declarado en', 'says about', 'diz sobre', 'dice sobre', 'contains',
  'contém', 'contiene', 'includes', 'inclui', 'incluye', 'refers to', 'refere-se a', 'se refiere a',
  'talks about', 'fala sobre', 'habla sobre', 'discusses', 'discute', 'mentions', 'menciona', 'details',
  'detalha', 'detalla', 'specifies', 'especifica', 'information about', 'informação sobre', 'información sobre', 'data about',
  'dados sobre', 'datos sobre', 'content about', 'conteúdo sobre', 'contenido sobre', 'section about', 'seção sobre', 'sección sobre',
  'part about', 'parte sobre', 'chapter about', 'capítulo sobre', 'page about', 'página sobre', 'paragraph about', 'parágrafo sobre',
  'párrafo sobre', 'quote', 'citação', 'cita', 'extract', 'extrato', 'extracto', 'passage',
  'passagem', 'pasaje', 'reference', 'referência', 'referencia', 'source', 'fonte', 'fuente',
  'citation', 'footnote', 'nota de rodapé', 'nota al pie', 'definition of', 'definição de', 'definición de', 'meaning of',
  'significado de', 'concept of', 'conceito de', 'concepto de', 'explanation of', 'explicação de', 'explicación de', 'interpretation of',
  'interpretação de', 'interpretación de', 'analysis of', 'análise de', 'análisis de', 'summary of', 'resumo de', 'resumen de',
  'overview of', 'visão geral de', 'descripción general de', 'review of', 'revisão de', 'revisión de', 'assessment of', 'avaliação de',
  'evaluación de', 'evaluation of', 'comparison of', 'comparação de', 'comparación de', 'contrast between', 'contraste entre', 'difference between',
  'diferença entre', 'diferencia entre', 'similarity between', 'semelhança entre', 'similitud entre', 'relationship between', 'relação entre', 'relación entre',
  'connection between', 'conexão entre', 'conexión entre', 'link between', 'ligação entre', 'enlace entre', 'implication of', 'implicação de',
  'implicación de', 'consequence of', 'consequência de', 'consecuencia de', 'result of', 'resultado de', 'outcome of', 'effect of',
  'efeito de', 'efecto de', 'impact of', 'impacto de', 'cause of', 'causa de', 'reason for', 'razão para',
  'razón para', 'purpose of', 'propósito de', 'objective of', 'objetivo de', 'goal of', 'meta de', 'plan for',
  'plano para', 'plan para', 'strategy for', 'estratégia para', 'estrategia para', 'method for', 'método para', 'process for',
  'processo para', 'proceso para', 'procedure for', 'procedimento para', 'procedimiento para', 'steps for', 'passos para', 'pasos para',
  'instructions for', 'instruções para', 'instrucciones para', 'guidelines for', 'diretrizes para', 'pautas para', 'recommendations for', 'recomendações para',
  'recomendaciones para', 'requirements for', 'requisitos para', 'criteria for', 'critérios para', 'criterios para', 'standards for', 'padrões para',
  'estándares para', 'rules for', 'regras para', 'reglas para', 'regulations for', 'regulamentos para', 'regulaciones para', 'policies for',
  'políticas para', 'terms for', 'termos para', 'términos para', 'conditions for', 'condições para', 'condiciones para', 'provisions for',
  'disposições para', 'disposiciones para'
];

const DOC_ANALYTICS_KEYWORDS = [
  'how many', 'quantos', 'cuántos', 'how much', 'quanto', 'cuánto', 'count', 'contar',
  'total', 'number of', 'número de', 'amount of', 'quantidade de', 'cantidad de', 'quantity of', 'sum of',
  'soma de', 'suma de', 'list', 'listar', 'show', 'mostrar', 'display', 'exibir',
  'enumerate', 'enumerar', 'all', 'todos', 'every', 'cada', 'each', 'what are',
  'quais são', 'cuáles son', 'which are', 'give me', 'me dê', 'dame', 'provide', 'fornecer',
  'proporcionar', 'show me', 'me mostre', 'muéstrame', 'tell me', 'me diga', 'dime', 'breakdown',
  'detalhamento', 'desglose', 'distribution', 'distribuição', 'distribución', 'summary', 'resumo', 'resumen',
  'overview', 'visão geral', 'descripción general', 'statistics', 'estatísticas', 'estadísticas', 'stats', 'metrics',
  'métricas', 'analysis', 'análise', 'análisis', 'report', 'relatório', 'dashboard', 'painel',
  'panel', 'chart', 'gráfico', 'graph', 'table', 'tabela', 'tabla', 'data',
  'dados', 'datos', 'figures', 'números', 'cifras', 'numbers', 'values', 'valores',
  'totals', 'totais', 'totales', 'sums', 'somas', 'sumas', 'averages', 'médias',
  'promedios', 'means', 'medians', 'medianas', 'modes', 'modas', 'ranges', 'intervalos',
  'rangos', 'minimums', 'mínimos', 'maximums', 'máximos', 'percentages', 'porcentagens', 'porcentajes',
  'rates', 'taxas', 'tasas', 'ratios', 'razões', 'proportions', 'proporções', 'proporciones',
  'fractions', 'frações', 'fracciones', 'shares', 'partes', 'categories', 'categorias', 'categorías',
  'types', 'tipos', 'kinds', 'classes', 'clases', 'groups', 'grupos', 'segments',
  'segmentos', 'files', 'arquivos', 'archivos', 'documents', 'documentos', 'pages', 'páginas',
  'words', 'palavras', 'palabras', 'characters', 'caracteres', 'size', 'tamanho', 'tamaño',
  'uploaded', 'enviado', 'subido', 'created', 'criado', 'creado', 'modified', 'modificado',
  'deleted', 'deletado', 'eliminado', 'folder', 'pasta', 'carpeta', 'directory', 'diretório',
  'directorio', 'tag', 'etiqueta', 'label', 'rótulo', 'category', 'categoria', 'categoría',
  'type', 'tipo', 'format', 'formato', 'extension', 'extensão', 'extensión', 'pdf',
  'docx', 'xlsx', 'pptx', 'txt', 'csv', 'jpg', 'png', 'oldest',
  'mais antigo', 'más antiguo', 'newest', 'mais recente', 'más reciente', 'latest', 'último', 'recent',
  'recente', 'reciente', 'today', 'hoje', 'hoy', 'yesterday', 'ontem', 'ayer',
  'this week', 'esta semana', 'last week', 'semana passada', 'semana pasada', 'this month', 'este mês', 'este mes',
  'last month', 'mês passado', 'mes pasado', 'this year', 'este ano', 'este año', 'last year', 'ano passado',
  'año pasado'
];

const DOC_MANAGEMENT_KEYWORDS = [
  'delete', 'deletar', 'eliminar', 'supprimir', 'remove', 'remover', 'retirer', 'erase',
  'apagar', 'borrar', 'purge', 'purgar', 'destroy', 'destruir', 'move', 'mover',
  'transfer', 'transferir', 'relocate', 'realocar', 'reubicar', 'rename', 'renomear', 'renombrar',
  'retitle', 'retitular', 'change name', 'mudar nome', 'cambiar nombre', 'tag', 'marcar', 'etiquetar',
  'label', 'rotular', 'mark', 'categorize', 'categorizar', 'classify', 'classificar', 'clasificar',
  'untag', 'desmarcar', 'quitar etiqueta', 'unlabel', 'desrotular', 'unmark', 'remove tag', 'remover etiqueta',
  'organize', 'organizar', 'arrange', 'arranjar', 'arreglar', 'sort', 'ordenar', 'order',
  'structure', 'estruturar', 'estructurar', 'reorganize', 'reorganizar', 'rearrange', 'rearranjar', 'archive',
  'arquivar', 'archivar', 'store', 'armazenar', 'almacenar', 'preserve', 'preservar', 'keep',
  'manter', 'mantener', 'retain', 'reter', 'retener', 'unarchive', 'desarquivar', 'desarchivar',
  'restore', 'restaurar', 'retrieve', 'recuperar', 'bring back', 'trazer de volta', 'traer de vuelta', 'duplicate',
  'duplicar', 'copy', 'copiar', 'clone', 'clonar', 'replicate', 'replicar', 'merge',
  'mesclar', 'fusionar', 'combine', 'combinar', 'join', 'juntar', 'unir', 'unite',
  'consolidate', 'consolidar', 'split', 'dividir', 'separate', 'separar', 'divide', 'extract',
  'extrair', 'extraer', 'pull out', 'retirar', 'sacar', 'lock', 'bloquear', 'secure',
  'proteger', 'asegurar', 'protect', 'encrypt', 'criptografar', 'cifrar', 'unlock', 'desbloquear',
  'unsecure', 'desproteger', 'desasegurar', 'unprotect', 'decrypt', 'descriptografar', 'descifrar', 'share',
  'compartilhar', 'compartir', 'publish', 'publicar', 'distribute', 'distribuir', 'unshare', 'descompartilhar',
  'dejar de compartir', 'unpublish', 'despublicar', 'make private', 'tornar privado', 'hacer privado', 'restrict', 'restringir',
  'limit', 'limitar', 'grant access', 'conceder acesso', 'otorgar acceso', 'give permission', 'dar permissão', 'dar permiso',
  'allow', 'permitir', 'authorize', 'autorizar', 'revoke access', 'revogar acesso', 'revocar acceso', 'remove permission',
  'remover permissão', 'quitar permiso', 'deny', 'negar', 'disallow', 'proibir', 'prohibir', 'forbid',
  'download', 'baixar', 'descargar', 'export', 'exportar', 'save', 'salvar', 'guardar',
  'upload', 'enviar', 'subir', 'import', 'importar', 'add', 'adicionar', 'añadir',
  'insert', 'inserir', 'insertar', 'create', 'criar', 'crear', 'make', 'fazer',
  'hacer', 'generate', 'gerar', 'generar', 'update', 'atualizar', 'actualizar', 'modify',
  'modificar', 'edit', 'editar', 'change', 'mudar', 'cambiar', 'revise', 'revisar',
  'amend', 'emendar', 'enmendar', 'alter', 'alterar', 'adjust', 'ajustar', 'correct',
  'corrigir', 'corregir', 'fix', 'consertar', 'repair', 'reparar', 'replace', 'substituir',
  'reemplazar', 'substitute', 'sustituir', 'swap', 'trocar', 'intercambiar', 'exchange', 'convert',
  'converter', 'convertir', 'transform', 'transformar', 'compress', 'comprimir', 'zip', 'zipar',
  'pack', 'empacotar', 'empaquetar', 'decompress', 'descomprimir', 'unzip', 'deszipar', 'unpack',
  'desempacotar', 'desempaquetar', 'scan', 'escanear', 'ocr', 'fazer ocr', 'hacer ocr', 'index',
  'indexar', 'reindex', 'reindexar', 'embed', 'incorporar', 'incrustar', 'vectorize', 'vetorizar',
  'vectorizar', 'encode', 'codificar', 'process', 'processar', 'procesar', 'analyze', 'analisar',
  'analizar', 'review', 'inspect', 'inspecionar', 'inspeccionar', 'audit', 'auditar', 'validate',
  'validar', 'verify', 'verificar', 'check', 'test', 'testar', 'probar', 'compare',
  'comparar', 'diff', 'diferenciar', 'contrast', 'contrastar', 'synchronize', 'sincronizar', 'sync',
  'backup', 'fazer backup', 'hacer copia de seguridad', 'save copy', 'salvar cópia', 'guardar copia', 'version', 'versionar',
  'track changes', 'rastrear mudanças', 'rastrear cambios', 'monitor', 'monitorar', 'monitorear', 'watch', 'observar',
  'flag', 'sinalizar', 'highlight', 'destacar', 'pin', 'fixar', 'fijar', 'unpin',
  'desfixar', 'desfijar', 'favorite', 'favoritar', 'marcar como favorito', 'star', 'marcar com estrela', 'marcar con estrella',
  'unfavorite', 'desfavoritar', 'quitar de favoritos', 'unstar', 'desmarcar estrela', 'quitar estrella', 'bookmark', 'unbookmark',
  'comment', 'comentar', 'annotate', 'anotar', 'note', 'add note', 'adicionar nota', 'añadir nota',
  'remove note', 'remover nota', 'quitar nota', 'attach', 'anexar', 'adjuntar', 'detach', 'desanexar',
  'desadjuntar', 'link', 'vincular', 'unlink', 'desvincular', 'connect', 'conectar', 'disconnect',
  'desconectar', 'associate', 'associar', 'asociar', 'dissociate', 'desassociar', 'desasociar', 'relate',
  'relacionar', 'unrelate', 'desrelacionar', 'group', 'agrupar', 'ungroup', 'desagrupar', 'batch',
  'lote', 'bulk', 'em massa', 'en masa', 'mass', 'multiple', 'múltiplos', 'múltiples',
  'several', 'vários', 'varios', 'many', 'muitos', 'muchos', 'all', 'todos'
];

const PREFERENCE_UPDATE_KEYWORDS = [
  'from now on', 'de agora em diante', 'a partir de ahora', 'always', 'sempre', 'siempre', 'every time', 'toda vez',
  'cada vez', 'whenever', 'sempre que', 'siempre que', 'remember', 'lembrar', 'recordar', 'remember that',
  'lembre que', 'recuerda que', 'keep in mind', 'tenha em mente', 'ten en cuenta', 'note that', 'note que', 'nota que',
  'save', 'salvar', 'guardar', 'store', 'armazenar', 'almacenar', 'my role', 'meu papel',
  'mi rol', 'i am', 'eu sou', 'yo soy', 'i\'m', 'sou', 'soy', 'my position',
  'minha posição', 'mi posición', 'my title', 'meu título', 'mi título', 'my job', 'meu trabalho', 'mi trabajo',
  'my company', 'minha empresa', 'mi empresa', 'my organization', 'minha organização', 'mi organización', 'my business', 'meu negócio',
  'mi negocio', 'my industry', 'minha indústria', 'mi industria', 'my sector', 'meu setor', 'mi sector', 'my field',
  'minha área', 'mi campo', 'i work', 'eu trabalho', 'yo trabajo', 'i work at', 'trabalho na', 'trabajo en',
  'i work for', 'trabalho para', 'trabajo para', 'i\'m employed', 'sou empregado', 'estoy empleado', 'prefer', 'prefiro',
  'prefiero', 'preference', 'preferência', 'preferencia', 'i like', 'eu gosto', 'me gusta', 'i want',
  'eu quero', 'yo quiero', 'i need', 'eu preciso', 'yo necesito', 'i\'d like', 'eu gostaria', 'me gustaría',
  'set', 'definir', 'establecer', 'configure', 'configurar', 'adjust', 'ajustar', 'change',
  'mudar', 'cambiar', 'update', 'atualizar', 'actualizar', 'modify', 'modificar', 'language',
  'idioma', 'tongue', 'língua', 'lengua', 'speak', 'falar', 'hablar', 'respond',
  'responder', 'answer', 'reply', 'write', 'escrever', 'escribir', 'communicate', 'comunicar',
  'tone', 'tom', 'tono', 'style', 'estilo', 'manner', 'maneira', 'manera',
  'way', 'forma', 'voice', 'voz', 'personality', 'personalidade', 'personalidad', 'attitude',
  'atitude', 'actitud', 'approach', 'abordagem', 'enfoque', 'formal', 'informal', 'casual',
  'professional', 'profissional', 'profesional', 'friendly', 'amigável', 'amigable', 'polite', 'educado',
  'respectful', 'respeitoso', 'respetuoso', 'concise', 'conciso', 'brief', 'breve', 'short',
  'curto', 'corto', 'succinct', 'sucinto', 'detailed', 'detalhado', 'detallado', 'comprehensive',
  'abrangente', 'completo', 'thorough', 'extensive', 'extenso', 'in-depth', 'aprofundado', 'en profundidad',
  'complete', 'full', 'verbose', 'verboso', 'long', 'longo', 'largo', 'length',
  'comprimento', 'longitud', 'size', 'tamanho', 'tamaño', 'amount', 'quantidade', 'cantidad',
  'level', 'nível', 'nivel', 'degree', 'grau', 'grado', 'detail', 'detalhe',
  'detalle', 'explanation', 'explicação', 'explicación', 'depth', 'profundidade', 'profundidad', 'format',
  'formato', 'structure', 'estrutura', 'estructura', 'layout', 'diseño', 'organization', 'organização',
  'organización', 'presentation', 'apresentação', 'presentación', 'bullets', 'tópicos', 'viñetas', 'bullet points',
  'puntos', 'numbered', 'numerado', 'list', 'lista', 'paragraphs', 'parágrafos', 'párrafos',
  'sections', 'seções', 'secciones', 'headings', 'títulos', 'encabezados', 'tables', 'tabelas',
  'tablas', 'charts', 'gráficos', 'examples', 'exemplos', 'ejemplos', 'citations', 'citações',
  'citas', 'references', 'referências', 'referencias', 'sources', 'fontes', 'fuentes', 'links',
  'enlaces', 'bold', 'negrito', 'negrita', 'italic', 'itálico', 'cursiva', 'underline',
  'sublinhado', 'subrayado', 'highlight', 'destacar', 'emoji', 'emoticon', 'context', 'contexto',
  'background', 'antecedentes', 'situation', 'situação', 'situación', 'circumstance', 'circunstância', 'circunstancia',
  'scenario', 'cenário', 'escenario', 'use case', 'caso de uso', 'domain', 'domínio', 'dominio',
  'area', 'área', 'topic', 'tópico', 'tema', 'subject', 'assunto', 'asunto',
  'theme', 'focus', 'foco', 'specialty', 'especialidade', 'especialidad', 'expertise', 'experiencia',
  'knowledge', 'conhecimento', 'conocimiento', 'experience', 'experiência', 'skill', 'habilidade', 'habilidad',
  'competency', 'competência', 'competencia', 'capability', 'capacidade', 'capacidad', 'ability', 'interest',
  'interesse', 'interés', 'passion', 'paixão', 'pasión', 'goal', 'meta', 'objective',
  'objetivo', 'target', 'aim', 'purpose', 'propósito', 'intention', 'intenção', 'intención',
  'mission', 'missão', 'misión', 'vision', 'visão', 'visión', 'value', 'valor',
  'principle', 'princípio', 'principio', 'belief', 'crença', 'creencia', 'priority', 'prioridade',
  'prioridad', 'importance', 'importância', 'importancia', 'significance', 'significância', 'significado', 'relevance',
  'relevância', 'relevancia'
];

const ANSWER_REWRITE_KEYWORDS = [
  'explain that', 'explique isso', 'explica eso', 'simpler', 'mais simples', 'más simple', 'more detail', 'mais detalhes',
  'más detalles', 'rephrase', 'reformule', 'reformula', 'expand', 'expanda', 'amplía', 'repeat',
  'repita', 'repite', 'show examples', 'mostre exemplos', 'muestra ejemplos', 'explain better', 'explique melhor', 'explica mejor',
  'in simpler words', 'em palavras mais simples', 'en palabras más simples', 'in more detail', 'em mais detalhes', 'en más detalle', 'rephrase that', 'reformule isso',
  'reformula eso', 'rephrase the last', 'reformule o último', 'reformula lo último', 'expand item', 'expanda item', 'amplía ítem', 'expand bullet',
  'expanda tópico', 'amplía viñeta', 'expand point', 'expanda ponto', 'amplía punto', 'give examples', 'dê exemplos', 'da ejemplos',
  'provide examples', 'forneça exemplos', 'proporciona ejemplos', 'repeat that', 'repita isso', 'repite eso', 'say again', 'diga novamente',
  'di de nuevo', 'say that again', 'diga isso novamente', 'di eso de nuevo', 'i didn\'t understand', 'não entendi', 'no entendí', 'i don\'t understand',
  'não entendo', 'no entiendo', 'unclear', 'não está claro', 'no está claro', 'confusing', 'confuso', 'not clear',
  'não claro', 'no claro', 'can you clarify', 'pode esclarecer', 'puedes aclarar', 'clarify that', 'esclareça isso', 'aclara eso',
  'make it clearer', 'torne mais claro', 'hazlo más claro', 'simplify', 'simplifique', 'simplifica', 'simplify that', 'simplifique isso',
  'simplifica eso', 'break it down', 'detalhe isso', 'desglósalo', 'break down', 'detalhar', 'desglosar', 'elaborate',
  'elabore', 'elabora', 'elaborate on', 'elabore sobre', 'elabora sobre', 'go deeper', 'aprofunde', 'profundiza',
  'more depth', 'mais profundidade', 'más profundidad', 'add more', 'adicione mais', 'añade más', 'tell me more', 'me diga mais',
  'dime más', 'what else', 'o que mais', 'qué más', 'anything else', 'mais alguma coisa', 'algo más', 'continue',
  'continúa', 'keep going', 'sigue', 'go on', 'prossiga', 'more info', 'mais informação', 'más información',
  'additional info', 'informação adicional', 'información adicional', 'further details', 'other aspects', 'outros aspectos', 'otros aspectos', 'other points',
  'outros pontos', 'otros puntos', 'different angle', 'ângulo diferente', 'ángulo diferente', 'another way', 'outra forma', 'otra forma',
  'differently', 'diferentemente', 'reword', 'restate', 'paraphrase', 'parafraseie', 'parafrasea', 'say differently',
  'diga diferentemente', 'di diferentemente', 'put differently', 'coloque diferentemente', 'pon diferentemente'
];

const FEEDBACK_POSITIVE_KEYWORDS = [
  'perfect', 'perfeito', 'perfecto', 'great', 'ótimo', 'genial', 'excellent', 'excelente',
  'thanks', 'obrigado', 'gracias', 'thank you', 'correct', 'correto', 'correcto', 'exactly',
  'exatamente', 'exactamente', 'that\'s right', 'isso mesmo', 'eso es', 'helpful', 'útil', 'good',
  'bom', 'bueno', 'awesome', 'incrível', 'increíble', 'amazing', 'fantastic', 'fantástico',
  'wonderful', 'maravilhoso', 'maravilloso', 'brilliant', 'brilhante', 'brillante', 'superb', 'soberbo',
  'soberbio', 'outstanding', 'excepcional', 'nice', 'legal', 'bonito', 'cool', 'spot on',
  'certeiro', 'acertado', 'right', 'certo', 'accurate', 'preciso', 'precise', 'well done',
  'bem feito', 'bien hecho', 'very good', 'muito bom', 'muy bueno', 'very helpful', 'muito útil', 'muy útil',
  'just what i needed', 'exatamente o que precisava', 'justo lo que necesitaba', 'that\'s what i wanted', 'é isso que queria', 'eso es lo que quería', 'appreciate it', 'agradeço',
  'lo aprecio', 'love it', 'adorei', 'me encanta', 'works perfectly', 'funciona perfeitamente', 'funciona perfectamente'
];

const FEEDBACK_NEGATIVE_KEYWORDS = [
  'wrong', 'errado', 'incorrecto', 'incorrect', 'incorreto', 'mixed up', 'confundiu', 'confundiste',
  'not in the file', 'não está no arquivo', 'no está en el archivo', 'mistake', 'erro', 'error', 'bad', 'ruim',
  'malo', 'doesn\'t make sense', 'não faz sentido', 'no tiene sentido', 'inaccurate', 'impreciso', 'false', 'falso',
  'untrue', 'não é verdade', 'no es verdad', 'misleading', 'enganoso', 'engañoso', 'confusing', 'confuso',
  'unclear', 'não claro', 'no claro', 'vague', 'vago', 'ambiguous', 'ambíguo', 'ambiguo',
  'incomplete', 'incompleto', 'missing', 'faltando', 'faltante', 'not helpful', 'não útil', 'no útil',
  'useless', 'inútil', 'unhelpful', 'não ajuda', 'no ayuda', 'poor', 'pobre', 'terrible',
  'terrível', 'awful', 'horrível', 'horrible', 'not right', 'não está certo', 'no está correcto', 'not correct',
  'não correto', 'no correcto', 'not accurate', 'não preciso', 'no preciso', 'off', 'equivocado', 'off target',
  'fora do alvo', 'fuera del objetivo', 'not what i asked', 'não é o que perguntei', 'no es lo que pregunté', 'didn\'t answer', 'não respondeu', 'no respondió',
  'not relevant', 'não relevante', 'no relevante', 'irrelevant', 'irrelevante', 'doesn\'t help', 'not useful'
];

const PRODUCT_HELP_KEYWORDS = [
  'how do i', 'como eu', 'cómo', 'how can i', 'como posso', 'cómo puedo', 'how to', 'como',
  'can i', 'posso', 'puedo', 'is it possible', 'é possível', 'es posible', 'upload', 'enviar',
  'subir', 'add document', 'adicionar documento', 'añadir documento', 'delete document', 'deletar documento', 'eliminar documento', 'search',
  'buscar', 'find', 'encontrar', 'organize', 'organizar', 'tag', 'marcar', 'etiquetar',
  'share', 'compartilhar', 'compartir', 'export', 'exportar', 'download', 'baixar', 'descargar',
  'settings', 'configurações', 'configuración', 'preferences', 'preferências', 'preferencias', 'account', 'conta',
  'cuenta', 'subscription', 'assinatura', 'suscripción', 'plan', 'plano', 'upgrade', 'atualizar',
  'actualizar', 'billing', 'cobrança', 'facturación', 'payment', 'pagamento', 'pago', 'features',
  'recursos', 'características', 'limits', 'limites', 'límites', 'quota', 'cota', 'cuota',
  'storage', 'armazenamento', 'almacenamiento', 'space', 'espaço', 'espacio', 'capacity', 'capacidade',
  'capacidad', 'maximum', 'máximo', 'integration', 'integração', 'integración', 'connect', 'conectar',
  'sync', 'sincronizar', 'api', 'webhook', 'plugin', 'extension', 'extensão', 'extensión',
  'mobile', 'móvel', 'móvil', 'app', 'aplicativo', 'aplicación', 'desktop', 'escritorio',
  'web', 'browser', 'navegador', 'chrome', 'firefox', 'safari', 'edge', 'support',
  'suporte', 'soporte', 'help', 'ajuda', 'ayuda', 'guide', 'guia', 'guía',
  'tutorial', 'documentation', 'documentação', 'documentación', 'docs', 'manual', 'instructions', 'instruções',
  'instrucciones', 'steps', 'passos', 'pasos', 'walkthrough', 'passo a passo', 'paso a paso', 'example',
  'exemplo', 'ejemplo', 'demo', 'demonstração', 'demostración', 'video', 'vídeo', 'screenshot',
  'captura de tela', 'captura de pantalla', 'faq', 'perguntas frequentes', 'preguntas frecuentes', 'question', 'pergunta', 'pregunta',
  'issue', 'problema', 'problem', 'error', 'erro', 'bug', 'troubleshoot', 'solucionar',
  'solucionar problemas', 'fix', 'consertar', 'arreglar', 'resolve', 'resolver', 'solution', 'solução',
  'solución', 'workaround', 'alternativa', 'solución alternativa', 'tip', 'dica', 'consejo', 'trick',
  'truque', 'truco', 'best practice', 'melhor prática', 'mejor práctica', 'recommendation', 'recomendação', 'recomendación',
  'suggestion', 'sugestão', 'sugerencia'
];

const ONBOARDING_HELP_KEYWORDS = [
  'getting started', 'começando', 'empezando', 'first time', 'primeira vez', 'primera vez', 'new user', 'novo usuário',
  'nuevo usuario', 'beginner', 'iniciante', 'principiante', 'start', 'começar', 'empezar', 'begin',
  'iniciar', 'setup', 'configurar', 'set up', 'configure', 'initialize', 'inicializar', 'onboard',
  'integrar', 'welcome', 'bem-vindo', 'bienvenido', 'introduction', 'introdução', 'introducción', 'intro',
  'overview', 'visão geral', 'descripción general', 'basics', 'básico', 'fundamental', 'essential', 'essencial',
  'esencial', 'quick start', 'início rápido', 'inicio rápido', 'quickstart', 'tutorial', 'guide', 'guia',
  'guía', 'walkthrough', 'passo a passo', 'paso a paso', 'step by step', 'first steps', 'primeiros passos', 'primeros pasos',
  'initial setup', 'configuração inicial', 'configuración inicial', 'account setup', 'configuração de conta', 'configuración de cuenta', 'create account', 'criar conta',
  'crear cuenta', 'sign up', 'inscrever-se', 'registrarse', 'register', 'registrar', 'login', 'fazer login',
  'iniciar sesión', 'log in', 'entrar', 'access', 'acessar', 'acceder', 'verify', 'verificar',
  'verification', 'verificação', 'verificación', 'activate', 'ativar', 'activar', 'activation', 'ativação',
  'activación', 'what is', 'o que é', 'qué es', 'what are', 'o que são', 'cuáles son', 'what does',
  'o que faz', 'qué hace', 'explain', 'explique', 'explica', 'tell me about', 'me diga sobre', 'dime sobre',
  'learn', 'aprender', 'understand', 'entender', 'know', 'saber', 'discover', 'descobrir',
  'descubrir', 'explore', 'explorar', 'try', 'tentar', 'probar', 'test', 'testar',
  'demo', 'demonstração', 'demostración', 'example', 'exemplo', 'ejemplo', 'sample', 'amostra',
  'muestra', 'use case', 'caso de uso', 'scenario', 'cenário', 'escenario', 'workflow', 'fluxo de trabalho',
  'flujo de trabajo', 'process', 'processo', 'proceso', 'main features', 'principais recursos', 'características principales', 'key features',
  'recursos principais', 'características clave', 'capabilities', 'capacidades', 'functions', 'funções', 'funciones', 'what can i do',
  'o que posso fazer', 'qué puedo hacer', 'what can it do', 'o que pode fazer', 'qué puede hacer', 'how does it work', 'como funciona', 'cómo funciona',
  'how to use', 'como usar', 'cómo usar', 'basic usage', 'uso básico', 'common tasks', 'tarefas comuns', 'tareas comunes',
  'typical workflow', 'fluxo de trabalho típico', 'flujo de trabajo típico'
];

const GENERIC_KNOWLEDGE_KEYWORDS = [
  'who is', 'quem é', 'quién es', 'who was', 'quem foi', 'quién fue', 'who are', 'quem são',
  'quiénes son', 'what is', 'o que é', 'qué es', 'what are', 'o que são', 'qué son', 'what was',
  'o que foi', 'qué fue', 'when did', 'quando', 'cuándo', 'when was', 'quando foi', 'cuándo fue',
  'when is', 'quando é', 'cuándo es', 'where is', 'onde é', 'dónde es', 'where was', 'onde foi',
  'dónde fue', 'where are', 'onde estão', 'dónde están', 'why is', 'por que é', 'por qué es', 'why did',
  'por que', 'por qué', 'why are', 'por que são', 'por qué son', 'how is', 'como é', 'cómo es',
  'how did', 'como', 'cómo', 'how are', 'como são', 'cómo son', 'how does', 'como funciona',
  'cómo funciona', 'how do', 'como fazem', 'cómo hacen', 'tell me about', 'me diga sobre', 'dime sobre', 'explain',
  'explique', 'explica', 'describe', 'descreva', 'define', 'defina', 'what does mean', 'o que significa',
  'qué significa', 'meaning of', 'significado de', 'definition of', 'definição de', 'definición de', 'history of', 'história de',
  'historia de', 'origin of', 'origem de', 'origen de', 'inventor of', 'inventor de', 'founder of', 'fundador de',
  'creator of', 'criador de', 'creador de', 'author of', 'autor de', 'capital of', 'capital de', 'population of',
  'população de', 'población de', 'president of', 'presidente de', 'leader of', 'líder de', 'ceo of', 'ceo de',
  'founded in', 'fundado em', 'fundado en', 'established in', 'estabelecido em', 'establecido en', 'invented in', 'inventado em',
  'inventado en', 'discovered in', 'descoberto em', 'descubierto en', 'born in', 'nascido em', 'nacido en', 'died in',
  'morreu em', 'murió en', 'located in', 'localizado em', 'ubicado en', 'situated in', 'situado em', 'situado en',
  'based in', 'baseado em', 'basado en', 'country', 'país', 'city', 'cidade', 'ciudad',
  'state', 'estado', 'continent', 'continente', 'ocean', 'oceano', 'océano', 'river',
  'rio', 'río', 'mountain', 'montanha', 'montaña', 'lake', 'lago', 'sea',
  'mar', 'planet', 'planeta', 'star', 'estrela', 'estrella', 'galaxy', 'galáxia',
  'galaxia', 'universe', 'universo', 'earth', 'terra', 'tierra', 'sun', 'sol',
  'moon', 'lua', 'luna', 'person', 'pessoa', 'persona', 'people', 'pessoas',
  'personas', 'scientist', 'cientista', 'científico', 'mathematician', 'matemático', 'physicist', 'físico',
  'chemist', 'químico', 'biologist', 'biólogo', 'inventor', 'engineer', 'engenheiro', 'ingeniero',
  'doctor', 'médico', 'artist', 'artista', 'painter', 'pintor', 'sculptor', 'escultor',
  'musician', 'músico', 'composer', 'compositor', 'writer', 'escritor', 'author', 'autor',
  'poet', 'poeta', 'philosopher', 'filósofo', 'politician', 'político', 'president', 'presidente',
  'king', 'rei', 'rey', 'queen', 'rainha', 'reina', 'emperor', 'imperador',
  'emperador', 'leader', 'líder', 'company', 'empresa', 'corporation', 'corporação', 'corporación',
  'business', 'negócio', 'negocio', 'organization', 'organização', 'organización', 'institution', 'instituição',
  'institución', 'university', 'universidade', 'universidad', 'school', 'escola', 'escuela', 'college',
  'faculdade', 'colegio', 'event', 'evento', 'war', 'guerra', 'battle', 'batalha',
  'batalla', 'revolution', 'revolução', 'revolución', 'treaty', 'tratado', 'agreement', 'acordo',
  'acuerdo', 'discovery', 'descoberta', 'descubrimiento', 'invention', 'invenção', 'invención', 'achievement',
  'conquista', 'logro', 'milestone', 'marco', 'hito', 'breakthrough', 'avanço', 'avance',
  'theory', 'teoria', 'teoría', 'law', 'lei', 'ley', 'principle', 'princípio',
  'principio', 'concept', 'conceito', 'concepto', 'idea', 'ideia', 'hypothesis', 'hipótese',
  'hipótesis', 'experiment', 'experimento', 'research', 'pesquisa', 'investigación', 'study', 'estudo',
  'estudio', 'science', 'ciência', 'ciencia', 'physics', 'física', 'chemistry', 'química',
  'biology', 'biologia', 'biología', 'mathematics', 'matemática', 'matemáticas', 'astronomy', 'astronomia',
  'astronomía', 'geology', 'geologia', 'geología', 'medicine', 'medicina', 'technology', 'tecnologia',
  'tecnología', 'engineering', 'engenharia', 'ingeniería', 'computer', 'computador', 'computadora', 'internet',
  'artificial intelligence', 'inteligência artificial', 'inteligencia artificial', 'machine learning', 'aprendizado de máquina', 'aprendizaje automático', 'quantum', 'quântico',
  'cuántico', 'relativity', 'relatividade', 'relatividad', 'evolution', 'evolução', 'evolución', 'dna',
  'adn', 'cell', 'célula', 'atom', 'átomo', 'molecule', 'molécula', 'element',
  'elemento', 'compound', 'composto', 'compuesto', 'reaction', 'reação', 'reacción', 'equation',
  'equação', 'ecuación', 'formula', 'fórmula', 'calculate', 'calcular', 'solve', 'resolver',
  'prove', 'provar', 'probar', 'demonstrate', 'demonstrar', 'demostrar'
];

const REASONING_TASK_KEYWORDS = [
  'calculate', 'calcular', 'compute', 'computar', 'solve', 'resolver', 'find', 'encontrar',
  'determine', 'determinar', 'figure out', 'descobrir', 'descubrir', 'work out', 'evaluate', 'avaliar',
  'evaluar', 'estimate', 'estimar', 'approximate', 'aproximar', 'add', 'adicionar', 'añadir',
  'sum', 'somar', 'sumar', 'plus', 'mais', 'más', 'subtract', 'subtrair',
  'restar', 'minus', 'menos', 'multiply', 'multiplicar', 'times', 'vezes', 'veces',
  'divide', 'dividir', 'divided by', 'dividido por', 'equals', 'igual', 'is equal to', 'é igual a',
  'es igual a', 'percentage', 'porcentagem', 'porcentaje', 'percent', 'por cento', 'por ciento', 'ratio',
  'razão', 'proportion', 'proporção', 'proporción', 'fraction', 'fração', 'fracción', 'decimal',
  'average', 'média', 'promedio', 'mean', 'median', 'mediana', 'mode', 'moda',
  'range', 'intervalo', 'rango', 'minimum', 'mínimo', 'maximum', 'máximo', 'soma',
  'suma', 'total', 'difference', 'diferença', 'diferencia', 'product', 'produto', 'producto',
  'quotient', 'quociente', 'cociente', 'remainder', 'resto', 'square', 'quadrado', 'cuadrado',
  'cube', 'cubo', 'power', 'potência', 'potencia', 'exponent', 'expoente', 'exponente',
  'root', 'raiz', 'raíz', 'square root', 'raiz quadrada', 'raíz cuadrada', 'logarithm', 'logaritmo',
  'exponential', 'exponencial', 'equation', 'equação', 'ecuación', 'formula', 'fórmula', 'expression',
  'expressão', 'expresión', 'variable', 'variável', 'constant', 'constante', 'coefficient', 'coeficiente',
  'term', 'termo', 'término', 'factor', 'fator', 'multiple', 'múltiplo', 'prime',
  'primo', 'composite', 'composto', 'compuesto', 'even', 'par', 'odd', 'ímpar',
  'impar', 'positive', 'positivo', 'negative', 'negativo', 'integer', 'inteiro', 'entero',
  'whole number', 'número inteiro', 'número entero', 'natural number', 'número natural', 'real number', 'número real', 'rational',
  'racional', 'irrational', 'irracional', 'complex', 'complexo', 'complejo', 'imaginary', 'imaginário',
  'imaginario', 'absolute value', 'valor absoluto', 'sign', 'sinal', 'signo', 'magnitude', 'magnitud',
  'distance', 'distância', 'distancia', 'length', 'comprimento', 'longitud', 'width', 'largura',
  'ancho', 'height', 'altura', 'depth', 'profundidade', 'profundidad', 'area', 'área',
  'perimeter', 'perímetro', 'circumference', 'circunferência', 'circunferencia', 'volume', 'volumen', 'capacity',
  'capacidade', 'capacidad', 'surface area', 'área de superfície', 'área de superficie', 'radius', 'raio', 'radio',
  'diameter', 'diâmetro', 'diámetro', 'angle', 'ângulo', 'ángulo', 'degree', 'grau',
  'grado', 'radian', 'radiano', 'radián', 'triangle', 'triângulo', 'triángulo', 'rectangle',
  'retângulo', 'rectángulo', 'circle', 'círculo', 'sphere', 'esfera', 'cylinder', 'cilindro',
  'cone', 'cono', 'pyramid', 'pirâmide', 'pirámide', 'polygon', 'polígono', 'line',
  'linha', 'línea', 'point', 'ponto', 'punto', 'plane', 'plano', 'coordinate',
  'coordenada', 'axis', 'eixo', 'eje', 'graph', 'gráfico', 'plot', 'plotar',
  'graficar', 'slope', 'inclinação', 'pendiente', 'intercept', 'intercepto', 'function', 'função',
  'función', 'domain', 'domínio', 'dominio', 'limit', 'limite', 'límite', 'derivative',
  'derivada', 'integral', 'differential', 'diferencial', 'probability', 'probabilidade', 'probabilidad', 'statistics',
  'estatística', 'estadística', 'data', 'dados', 'datos', 'sample', 'amostra', 'muestra',
  'population', 'população', 'población', 'distribution', 'distribuição', 'distribución', 'normal', 'standard deviation',
  'desvio padrão', 'desviación estándar', 'variance', 'variância', 'varianza', 'correlation', 'correlação', 'correlación',
  'regression', 'regressão', 'regresión', 'hypothesis', 'hipótese', 'hipótesis', 'test', 'teste',
  'prueba', 'significance', 'significância', 'significancia', 'confidence', 'confiança', 'confianza', 'interval',
  'error', 'erro', 'margin', 'margem', 'margen', 'compare', 'comparar', 'contrast',
  'contrastar', 'rank', 'classificar', 'clasificar', 'order', 'ordenar', 'sort', 'arrange',
  'arranjar', 'arreglar', 'sequence', 'sequência', 'secuencia', 'series', 'série', 'serie',
  'pattern', 'padrão', 'patrón', 'trend', 'tendência', 'tendencia', 'increase', 'aumento',
  'decrease', 'diminuição', 'disminución', 'growth', 'crescimento', 'crecimiento', 'decline', 'declínio',
  'declive', 'change', 'mudança', 'cambio', 'rate', 'taxa', 'tasa', 'speed',
  'velocidade', 'velocidad', 'time', 'tempo', 'tiempo', 'velocity', 'acceleration', 'aceleração',
  'aceleración', 'force', 'força', 'fuerza', 'mass', 'massa', 'masa', 'weight',
  'peso', 'energy', 'energia', 'energía', 'work', 'trabalho', 'trabajo', 'pressure',
  'pressão', 'presión', 'temperature', 'temperatura', 'heat', 'calor', 'density', 'densidade',
  'densidad'
];

const TEXT_TRANSFORM_KEYWORDS = [
  'translate', 'traduzir', 'traducir', 'translation', 'tradução', 'traducción', 'convert', 'converter',
  'convertir', 'transform', 'transformar', 'rewrite', 'reescrever', 'reescribir', 'rephrase', 'reformular',
  'paraphrase', 'parafrasear', 'summarize', 'resumir', 'summary', 'resumo', 'resumen', 'shorten',
  'encurtar', 'acortar', 'condense', 'condensar', 'compress', 'comprimir', 'reduce', 'reduzir',
  'reducir', 'expand', 'expandir', 'ampliar', 'elaborate', 'elaborar', 'lengthen', 'alongar',
  'alargar', 'extend', 'estender', 'extender', 'simplify', 'simplificar', 'clarify', 'esclarecer',
  'aclarar', 'explain', 'explicar', 'improve', 'melhorar', 'mejorar', 'enhance', 'aprimorar',
  'refine', 'refinar', 'polish', 'polir', 'pulir', 'edit', 'editar', 'revise',
  'revisar', 'correct', 'corrigir', 'corregir', 'fix', 'consertar', 'arreglar', 'proofread',
  'check', 'verificar', 'grammar', 'gramática', 'spelling', 'ortografia', 'ortografía', 'punctuation',
  'pontuação', 'puntuación', 'style', 'estilo', 'tone', 'tom', 'tono', 'voice',
  'voz', 'format', 'formatar', 'formatear', 'structure', 'estruturar', 'estructurar', 'organize',
  'organizar', 'arrange', 'arranjar', 'layout', 'diseño', 'presentation', 'apresentação', 'presentación',
  'make formal', 'tornar formal', 'hacer formal', 'make informal', 'tornar informal', 'hacer informal', 'make casual', 'tornar casual',
  'hacer casual', 'make professional', 'tornar profissional', 'hacer profesional', 'make friendly', 'tornar amigável', 'hacer amigable', 'make polite',
  'tornar educado', 'hacer educado', 'make concise', 'tornar conciso', 'hacer conciso', 'make brief', 'tornar breve', 'hacer breve',
  'make detailed', 'tornar detalhado', 'hacer detallado', 'make longer', 'tornar mais longo', 'hacer más largo', 'make shorter', 'tornar mais curto',
  'hacer más corto', 'into english', 'para inglês', 'al inglés', 'to english', 'into portuguese', 'para português', 'al portugués',
  'to portuguese', 'into spanish', 'para espanhol', 'al español', 'to spanish', 'from english', 'do inglês', 'del inglés',
  'from portuguese', 'do português', 'del portugués', 'from spanish', 'do espanhol', 'del español', 'language', 'idioma',
  'tongue', 'língua', 'lengua', 'bullet points', 'tópicos', 'viñetas', 'bullets', 'numbered list',
  'lista numerada', 'paragraphs', 'parágrafos', 'párrafos', 'sentences', 'frases', 'oraciones', 'words',
  'palavras', 'palabras', 'characters', 'caracteres', 'uppercase', 'maiúsculas', 'mayúsculas', 'lowercase',
  'minúsculas', 'title case', 'capitalização de título', 'mayúsculas de título', 'sentence case', 'capitalização de frase', 'mayúsculas de oración', 'remove',
  'remover', 'eliminar', 'delete', 'deletar', 'add', 'adicionar', 'añadir', 'insert',
  'inserir', 'insertar', 'replace', 'substituir', 'reemplazar', 'change', 'mudar', 'cambiar',
  'modify', 'modificar', 'update', 'atualizar', 'actualizar', 'adjust', 'ajustar'
];

const CHITCHAT_KEYWORDS = [
  'hi', 'oi', 'hola', 'hello', 'olá', 'hey', 'ei', 'good morning',
  'bom dia', 'buenos días', 'good afternoon', 'boa tarde', 'buenas tardes', 'good evening', 'boa noite', 'buenas noches',
  'good night', 'how are you', 'como vai', 'cómo estás', 'how\'s it going', 'cómo va', 'what\'s up', 'e aí',
  'qué tal', 'sup', 'howdy', 'greetings', 'saudações', 'saludos', 'welcome', 'bem-vindo',
  'bienvenido', 'nice to meet you', 'prazer em conhecer', 'encantado de conocerte', 'pleased to meet you', 'prazer', 'encantado', 'goodbye',
  'adeus', 'adiós', 'bye', 'tchau', 'see you', 'até logo', 'hasta luego', 'see you later',
  'até mais tarde', 'take care', 'se cuide', 'cuídate', 'have a good day', 'tenha um bom dia', 'que tengas un buen día', 'have a nice day',
  'thanks', 'obrigado', 'gracias', 'thank you', 'you\'re welcome', 'de nada', 'no problem', 'sem problema',
  'no hay problema', 'no worries', 'sem problemas', 'no te preocupes', 'my pleasure', 'meu prazer', 'mi placer', 'anytime',
  'quando quiser', 'cuando quieras', 'sure', 'claro', 'of course', 'por supuesto', 'certainly', 'certamente',
  'ciertamente', 'absolutely', 'absolutamente', 'yes', 'sim', 'sí', 'yeah', 'yep',
  'no', 'não', 'nope', 'maybe', 'talvez', 'tal vez', 'perhaps', 'quizás',
  'possibly', 'possivelmente', 'posiblemente', 'okay', 'ok', 'alright', 'tudo bem', 'está bien',
  'fine', 'bem', 'bien', 'great', 'ótimo', 'genial', 'good', 'bom',
  'bueno', 'nice', 'legal', 'bonito', 'cool', 'awesome', 'incrível', 'increíble',
  'amazing', 'fantastic', 'fantástico', 'wonderful', 'maravilhoso', 'maravilloso', 'excellent', 'excelente',
  'perfect', 'perfeito', 'perfecto', 'sorry', 'desculpe', 'lo siento', 'excuse me', 'com licença',
  'disculpe', 'pardon', 'perdão', 'perdón', 'oops', 'ops', 'ups', 'my bad',
  'minha culpa', 'mi culpa', 'apologize', 'peço desculpas', 'me disculpo', 'please', 'por favor', 'kindly',
  'gentilmente', 'amablemente', 'could you', 'você poderia', 'podrías', 'would you', 'can you', 'você pode',
  'puedes', 'help', 'ajuda', 'ayuda', 'assist', 'assistir', 'asistir', 'support',
  'suporte', 'soporte', 'question', 'pergunta', 'pregunta', 'ask', 'perguntar', 'preguntar',
  'tell', 'dizer', 'decir', 'show', 'mostrar', 'explain', 'explicar', 'understand',
  'entender', 'know', 'saber', 'think', 'achar', 'pensar', 'believe', 'acreditar',
  'creer', 'feel', 'sentir', 'like', 'gostar', 'gustar', 'love', 'amar',
  'hate', 'odiar', 'want', 'querer', 'need', 'precisar', 'necesitar', 'wish',
  'desejar', 'desear', 'hope', 'esperar', 'try', 'tentar', 'intentar', 'attempt'
];

const META_AI_KEYWORDS = [
  'who are you', 'quem é você', 'quién eres', 'what are you', 'o que você é', 'qué eres', 'who made you', 'quem te fez',
  'quién te hizo', 'who created you', 'quem te criou', 'quién te creó', 'who built you', 'quem te construiu', 'quién te construyó', 'who developed you',
  'quem te desenvolveu', 'quién te desarrolló', 'what is your name', 'qual é seu nome', 'cuál es tu nombre', 'your name', 'seu nome', 'tu nombre',
  'are you ai', 'você é ia', 'eres ia', 'are you a bot', 'você é um bot', 'eres un bot', 'are you human', 'você é humano',
  'eres humano', 'are you real', 'você é real', 'eres real', 'are you a robot', 'você é um robô', 'eres un robot', 'are you chatgpt',
  'você é chatgpt', 'eres chatgpt', 'are you gpt', 'você é gpt', 'eres gpt', 'what model', 'que modelo', 'qué modelo',
  'which model', 'qual modelo', 'cuál modelo', 'what version', 'que versão', 'qué versión', 'how do you work', 'como você funciona',
  'cómo funcionas', 'how were you made', 'como você foi feito', 'cómo fuiste hecho', 'how were you trained', 'como você foi treinado', 'cómo fuiste entrenado', 'what can you do',
  'o que você pode fazer', 'qué puedes hacer', 'what are your capabilities', 'quais são suas capacidades', 'cuáles son tus capacidades', 'what are your limitations', 'quais são suas limitações', 'cuáles son tus limitaciones',
  'can you', 'você pode', 'puedes', 'do you have', 'você tem', 'tienes', 'are you able', 'você consegue',
  'eres capaz', 'do you know', 'você sabe', 'sabes', 'can you learn', 'você pode aprender', 'puedes aprender', 'do you learn',
  'você aprende', 'aprendes', 'can you remember', 'você pode lembrar', 'puedes recordar', 'do you remember', 'você lembra', 'recuerdas',
  'do you have memory', 'você tem memória', 'tienes memoria', 'can you think', 'você pode pensar', 'puedes pensar', 'do you think', 'você pensa',
  'piensas', 'are you intelligent', 'você é inteligente', 'eres inteligente', 'are you smart', 'você é esperto', 'eres listo', 'do you have feelings',
  'você tem sentimentos', 'tienes sentimientos', 'can you feel', 'você pode sentir', 'puedes sentir', 'do you feel', 'você sente', 'sientes',
  'are you conscious', 'você é consciente', 'eres consciente', 'are you alive', 'você está vivo', 'estás vivo', 'do you have emotions', 'você tem emoções',
  'tienes emociones', 'can you understand', 'você pode entender', 'puedes entender', 'do you understand', 'você entende', 'entiendes', 'what language',
  'que idioma', 'qué idioma', 'which language', 'qual idioma', 'cuál idioma', 'can you speak', 'você pode falar', 'puedes hablar',
  'do you speak', 'você fala', 'hablas', 'what languages', 'que idiomas', 'qué idiomas', 'how many languages', 'quantos idiomas',
  'cuántos idiomas', 'your creator', 'seu criador', 'tu creador', 'your developer', 'seu desenvolvedor', 'tu desarrollador', 'your maker',
  'your company', 'sua empresa', 'tu empresa', 'your owner', 'seu dono', 'tu dueño', 'your purpose', 'seu propósito',
  'tu propósito', 'your goal', 'sua meta', 'tu meta', 'your function', 'sua função', 'tu función', 'your role',
  'seu papel', 'tu rol', 'your job', 'seu trabalho', 'tu trabajo', 'your task', 'sua tarefa', 'tu tarea'
];

const OUT_OF_SCOPE_KEYWORDS = [
  'hack', 'hackear', 'crack', 'crackear', 'break into', 'invadir', 'bypass', 'burlar',
  'eludir', 'exploit', 'explorar', 'explotar', 'vulnerability', 'vulnerabilidade', 'vulnerabilidad', 'malware',
  'virus', 'vírus', 'trojan', 'troyano', 'ransomware', 'phishing', 'spam', 'scam',
  'golpe', 'estafa', 'fraud', 'fraude', 'steal', 'roubar', 'robar', 'theft',
  'roubo', 'robo', 'piracy', 'pirataria', 'piratería', 'illegal', 'ilegal', 'crime',
  'crimen', 'criminal', 'criminoso', 'violence', 'violência', 'violencia', 'violent', 'violento',
  'weapon', 'arma', 'gun', 'arma de fogo', 'pistola', 'bomb', 'bomba', 'explosive',
  'explosivo', 'drug', 'droga', 'narcotic', 'narcótico', 'poison', 'veneno', 'toxic',
  'tóxico', 'harm', 'prejudicar', 'dañar', 'hurt', 'machucar', 'lastimar', 'kill',
  'matar', 'murder', 'assassinar', 'asesinar', 'suicide', 'suicídio', 'suicidio', 'self-harm',
  'automutilação', 'autolesión', 'abuse', 'abuso', 'harassment', 'assédio', 'acoso', 'bully',
  'intimidar', 'acosar', 'discriminate', 'discriminar', 'racism', 'racismo', 'sexism', 'sexismo',
  'hate', 'ódio', 'odio', 'offensive', 'ofensivo', 'explicit', 'explícito', 'adult',
  'adulto', 'sexual', 'pornography', 'pornografia', 'pornografía', 'nude', 'nu', 'desnudo',
  'naked', 'inappropriate', 'inapropriado', 'inapropiado', 'unethical', 'antiético', 'poco ético', 'immoral',
  'imoral', 'inmoral', 'dangerous', 'perigoso', 'peligroso', 'unsafe', 'inseguro', 'risky',
  'arriscado', 'arriesgado', 'prohibited', 'proibido', 'prohibido', 'forbidden', 'banned', 'banido',
  'restricted', 'restrito', 'restringido', 'confidential', 'confidencial', 'secret', 'secreto', 'private',
  'privado', 'sensitive', 'sensível', 'sensible', 'classified', 'classificado', 'clasificado', 'leak',
  'vazar', 'filtrar', 'expose', 'expor', 'exponer', 'reveal', 'revelar', 'disclose',
  'divulgar', 'manipulate', 'manipular', 'deceive', 'enganar', 'engañar', 'lie', 'mentir',
  'cheat', 'trapacear', 'hacer trampa', 'fake', 'falso', 'counterfeit', 'falsificar', 'forge'
];

const AMBIGUOUS_KEYWORDS = [
  'it', 'isso', 'eso', 'this', 'esto', 'that', 'aquilo', 'something',
  'algo', 'anything', 'qualquer coisa', 'cualquier cosa', 'stuff', 'coisas', 'cosas', 'thing',
  'coisa', 'cosa', 'things', 'do', 'fazer', 'hacer', 'help', 'ajudar',
  'ayudar', 'check', 'verificar', 'look', 'olhar', 'mirar', 'see', 'ver',
  'find', 'encontrar', 'get', 'obter', 'obtener', 'make', 'create', 'criar',
  'crear', 'show', 'mostrar', 'tell', 'dizer', 'decir', 'give', 'dar',
  'what', 'o que', 'qué', 'which', 'qual', 'cuál', 'how', 'como',
  'cómo', 'why', 'por que', 'por qué', 'when', 'quando', 'cuándo', 'where',
  'onde', 'dónde', 'who', 'quem', 'quién', 'can you', 'você pode', 'puedes',
  'could you', 'você poderia', 'podrías', 'would you', 'will you', 'você vai', 'vas a', 'please',
  'por favor', 'just', 'apenas', 'solo', 'only', 'só', 'simply', 'simplesmente',
  'simplemente', 'quick', 'rápido', 'fast', 'now', 'agora', 'ahora', 'here',
  'aqui', 'aquí', 'there', 'lá', 'allí', 'one', 'um', 'uno',
  'some', 'alguns', 'algunos', 'few', 'poucos', 'pocos', 'many', 'muitos',
  'muchos', 'all', 'todos', 'everything', 'tudo', 'todo', 'nothing', 'nada',
  'none', 'nenhum', 'ninguno', 'more', 'mais', 'más', 'less', 'menos',
  'other', 'outro', 'otro', 'another', 'different', 'diferente', 'same', 'mesmo',
  'mismo', 'like', 'similar', 'about', 'sobre', 'regarding', 'acerca de', 'concerning'
];

// ============================================================================
// REGEX PATTERN DATABASES (Generated from categories_parsed.json - COMPLETE)
// ============================================================================

const DOC_QA_PATTERNS = [
  /^what (is|are|was|were) .+ (in|from|about) (the|this|my) (document|file|pdf)/i,
  /^que (é|são|foi|foram) .+ (no|do) (documento|arquivo)/i,
  /^qué (es|son|fue|fueron) .+ (en|del) (documento|archivo)/i,
  /^what does .+ (say|mention|state) (about|regarding)/i,
  /^o que .+ (diz|menciona|declara) (sobre|acerca de)/i,
  /^qué .+ (dice|menciona|declara) (sobre|acerca de)/i,
  /^(show|tell|explain) me (what|where|when) .+ (in|from) (the|my) (document|file)/i,
  /^(mostre|diga|explique) (o que|onde|quando) .+ (no|do) (documento|arquivo)/i,
  /^(muestra|dime|explica) (qué|dónde|cuándo) .+ (en|del) (documento|archivo)/i,
  /^where (is|are|was|were) .+ (mentioned|stated|described)/i,
  /^onde (é|são|foi|foram) .+ (mencionado|declarado|descrito)/i,
  /^dónde (es|son|fue|fueron) .+ (mencionado|declarado|descrito)/i,
  /^find (information|data|details) (about|on) .+/i,
  /^encontre (informação|dados|detalhes) (sobre|acerca de) .+/i,
  /^encuentra (información|datos|detalles) (sobre|acerca de) .+/i,
  /^according to (the|my) (document|file|report)/i,
  /^de acordo com (o|meu) (documento|arquivo|relatório)/i,
  /^según (el|mi) (documento|archivo|informe)/i,
  /^based on (the|my) (document|file)/i,
  /^baseado em (o|meu) (documento|arquivo)/i,
  /^basado en (el|mi) (documento|archivo)/i,
  /^(in|from) (the|my|this) (document|file|pdf)/i,
  /^(no|do) (documento|arquivo|ficheiro|pdf)/i,
  /^(en|del) (documento|archivo|fichero|pdf)/i,
  /^does (the|my) (document|file) (say|mention|state|contain)/i,
  /^(o|meu) (documento|arquivo) (diz|menciona|declara|contém)/i,
  /^(el|mi) (documento|archivo) (dice|menciona|declara|contiene)/i,
  /^(is|are) (there|any) (information|data) (about|on) .+/i,
  /^(há|existe) (informação|dados) (sobre|acerca de) .+/i,
  /^(hay|existe) (información|datos) (sobre|acerca de) .+/i,
  /^what (information|data) does (the|my) (document|file) (contain|include)/i,
  /^que (informação|dados) (o|meu) (documento|arquivo) (contém|inclui)/i,
  /^qué (información|datos) (el|mi) (documento|archivo) (contiene|incluye)/i,
  /^(can you|could you) (find|search|show) .+ (in|from) (the|my)/i,
  /^(você pode|poderia) (encontrar|buscar|mostrar) .+ (no|do) (documento|arquivo)/i,
  /^(puedes|podrías) (encontrar|buscar|mostrar) .+ (en|del) (documento|archivo)/i,
  /^(extract|get|retrieve) (the|all) (information|data) (about|on)/i,
  /^(extraia|obtenha|recupere) (a|toda) (informação|dados) (sobre|acerca de)/i,
  /^(extrae|obtén|recupera) (la|toda) (información|datos) (sobre|acerca de)/i,
  /^(summarize|recap) what .+ (says|mentions|states)/i,
  /^(resuma|recapitule) o que .+ (diz|menciona|declara)/i,
  /^(resume|recapitula) lo que .+ (dice|menciona|declara)/i,
  /^(compare|contrast) what .+ (says|mentions)/i,
  /^(compare|contraste) o que .+ (diz|menciona)/i,
  /^(compara|contrasta) lo que .+ (dice|menciona)/i,
  /^what (is|are) (the|all) (details|information) (about|on) .+/i,
  /^quais (são|os) (detalhes|informações) (sobre|acerca de) .+/i,
  /^cuáles (son|los) (detalles|información) (sobre|acerca de) .+/i,
  /^(list|show|enumerate) (all|the) (information|data|points)/i,
  /^(liste|mostre|enumere) (toda|a) (informação|dados|pontos)/i,
  /^(lista|muestra|enumera) (toda|la) (información|datos|puntos)/i,
  /^(which|what) (document|file) (contains|includes|mentions)/i,
  /^(qual|que) (documento|arquivo) (contém|inclui|menciona)/i,
  /^(cuál|qué) (documento|archivo) (contiene|incluye|menciona)/i,
  /^(in|from) which (document|file|section|chapter)/i,
  /^(em|de) qual (documento|arquivo|seção|capítulo)/i,
  /^(en|de) cuál (documento|archivo|sección|capítulo)/i,
  /^what does (the|my) (document|file|report) (say|state|mention)/i,
  /^o que (o|meu) (documento|arquivo|relatório) (diz|declara|menciona)/i,
  /^qué (el|mi) (documento|archivo|informe) (dice|declara|menciona)/i,
  /^(give|provide|show) me (the|all) (information|data|details)/i,
  /^(dê|forneça|mostre) (a|toda) (informação|dados|detalhes)/i,
  /^(da|proporciona|muestra) (la|toda) (información|datos|detalles)/i,
  /^(where|when) (can I find|is|are) (the|all) (information|data)/i,
  /^(onde|quando) (posso encontrar|está|estão) (a|toda) (informação|dados)/i,
  /^(dónde|cuándo) (puedo encontrar|está|están) (la|toda) (información|datos)/i,
  /^(who|what|which) (is|are|was|were) (mentioned|stated|described)/i,
  /^(quem|que|qual) (é|são|foi|foram) (mencionado|declarado|descrito)/i,
  /^(quién|qué|cuál) (es|son|fue|fueron) (mencionado|declarado|descrito)/i,
  /^(why|how) does (the|my) (document|file) (say|mention|explain)/i,
  /^(por que|como) (o|meu) (documento|arquivo) (diz|menciona|explica)/i,
  /^(por qué|cómo) (el|mi) (documento|archivo) (dice|menciona|explica)/i,
  /^what (is|are) (the|all) (definition|meaning|explanation) of .+/i,
  /^qual (é|a) (definição|significado|explicação) de .+/i,
  /^cuál (es|la) (definición|significado|explicación) de .+/i,
  /^(define|explain|describe|clarify) .+ (according to|based on)/i,
  /^(defina|explique|descreva|esclareça) .+ (de acordo com|baseado em)/i,
  /^(define|explica|describe|aclara) .+ (según|basado en)/i,
  /^what (is|are) (the|all) (requirement|specification|criterion)/i,
  /^qual (é|o) (requisito|especificação|critério)/i,
  /^cuál (es|el) (requisito|especificación|criterio)/i,
  /^(list|show) (all|the) (requirements|specifications|criteria)/i,
  /^(liste|mostre) (todos|os) (requisitos|especificações|critérios)/i,
  /^(lista|muestra) (todos|los) (requisitos|especificaciones|criterios)/i,
  /^what (is|are) (the|all) (step|procedure|process|method)/i,
  /^qual (é|o) (passo|procedimento|processo|método)/i,
  /^cuál (es|el) (paso|procedimiento|proceso|método)/i,
  /^(describe|explain|outline) (the|all) (steps|procedures|processes)/i,
  /^(descreva|explique|delineie) (os|todos) (passos|procedimentos|processos)/i,
  /^(describe|explica|esboza) (los|todos) (pasos|procedimientos|procesos)/i
];

const DOC_ANALYTICS_PATTERNS = [
  /^how many (documents|files|pdfs) (do I have|are there|exist)/i,
  /^quantos (documentos|arquivos|ficheiros|pdfs) (tenho|há|existem)/i,
  /^cuántos (documentos|archivos|ficheros|pdfs) (tengo|hay|existen)/i,
  /^how many (documents|files) (are|were) (uploaded|created|modified|deleted)/i,
  /^quantos (documentos|arquivos) (foram|estão) (enviados|criados|modificados|deletados)/i,
  /^cuántos (documentos|archivos) (fueron|están) (subidos|creados|modificados|eliminados)/i,
  /^how many (documents|files) (contain|include|mention) .+/i,
  /^quantos (documentos|arquivos) (contêm|incluem|mencionam) .+/i,
  /^cuántos (documentos|archivos) (contienen|incluyen|mencionan) .+/i,
  /^how many (documents|files) (are|were) (tagged|marked) (as|with) .+/i,
  /^quantos (documentos|arquivos) (estão|foram) (marcados|etiquetados) (como|com) .+/i,
  /^cuántos (documentos|archivos) (están|fueron) (marcados|etiquetados) (como|con) .+/i,
  /^how many (documents|files) (are|were) (in|from) (the|this) (folder|directory)/i,
  /^quantos (documentos|arquivos) (estão|estavam) (na|da) (pasta|diretório)/i,
  /^cuántos (documentos|archivos) (están|estaban) (en|de) (la|esta) (carpeta|directorio)/i,
  /^how many (pages|words|characters) (are|were) (in|from) (the|my) (document|file)/i,
  /^quantas (páginas|palavras|caracteres) (há|estão) (no|do) (documento|arquivo)/i,
  /^cuántas (páginas|palabras|caracteres) (hay|están) (en|del) (documento|archivo)/i,
  /^how much (data|information|content) (is|are|was|were) (in|from|about) .+/i,
  /^quanto (dados|informação|conteúdo) (há|está|estava) (em|de|sobre) .+/i,
  /^cuánto (datos|información|contenido) (hay|está|estaba) (en|de|sobre) .+/i,
  /^what (is|are) (the|all) (total|sum|count|number) (of|for) .+/i,
  /^qual (é|o) (total|soma|contagem|número) (de|para) .+/i,
  /^cuál (es|el) (total|suma|cuenta|número) (de|para) .+/i,
  /^(count|calculate|compute) (the|all) (total|sum|number) (of|for) .+/i,
  /^(conte|calcule|compute) (o|todo) (total|soma|número) (de|para) .+/i,
  /^(cuenta|calcula|computa) (el|todo) (total|suma|número) (de|para) .+/i,
  /^(list|show|display) (all|the|my) (documents|files|pdfs)/i,
  /^(liste|mostre|exiba) (todos|os|meus) (documentos|arquivos|ficheiros|pdfs)/i,
  /^(lista|muestra|exhibe) (todos|los|mis) (documentos|archivos|ficheros|pdfs)/i,
  /^(list|show) (all|the) (documents|files) (that|which) (contain|include|mention) .+/i,
  /^(liste|mostre) (todos|os) (documentos|arquivos) (que) (contêm|incluem|mencionam) .+/i,
  /^(lista|muestra) (todos|los) (documentos|archivos) (que) (contienen|incluyen|mencionan) .+/i,
  /^(list|show) (all|the) (documents|files) (tagged|marked) (as|with) .+/i,
  /^(liste|mostre) (todos|os) (documentos|arquivos) (marcados|etiquetados) (como|com) .+/i,
  /^(lista|muestra) (todos|los) (documentos|archivos) (marcados|etiquetados) (como|con) .+/i,
  /^(list|show) (all|the) (documents|files) (in|from) (the|this) (folder|directory)/i,
  /^(liste|mostre) (todos|os) (documentos|arquivos) (na|da) (pasta|diretório)/i,
  /^(lista|muestra) (todos|los) (documentos|archivos) (en|de) (la|esta) (carpeta|directorio)/i,
  /^what (documents|files|pdfs) (do I have|are there|exist)/i,
  /^quais (documentos|arquivos|ficheiros|pdfs) (tenho|há|existem)/i,
  /^cuáles (documentos|archivos|ficheros|pdfs) (tengo|hay|existen)/i,
  /^what (documents|files) (contain|include|mention) .+/i,
  /^quais (documentos|arquivos) (contêm|incluem|mencionam) .+/i,
  /^cuáles (documentos|archivos) (contienen|incluyen|mencionan) .+/i,
  /^what (documents|files) (are|were) (tagged|marked) (as|with) .+/i,
  /^quais (documentos|arquivos) (estão|foram) (marcados|etiquetados) (como|com) .+/i,
  /^cuáles (documentos|archivos) (están|fueron) (marcados|etiquetados) (como|con) .+/i,
  /^which (documents|files) (contain|include|mention) .+/i,
  /^(give|provide|show) me (a|the) (list|listing|breakdown|summary) (of|for) (all|the|my) (documents|files)/i,
  /^(dê|forneça|mostre) (uma|a) (lista|listagem|detalhamento|resumo) (de|para) (todos|os|meus) (documentos|arquivos)/i,
  /^(da|proporciona|muestra) (una|la) (lista|listado|desglose|resumen) (de|para) (todos|los|mis) (documentos|archivos)/i,
  /^what (is|are) (the|all) (breakdown|distribution|summary) (of|for) (my|the) (documents|files) (by|per)/i,
  /^qual (é|a) (detalhamento|distribuição|resumo) (dos|para) (meus|os) (documentos|arquivos) (por)/i,
  /^cuál (es|la) (desglose|distribución|resumen) (de|para) (mis|los) (documentos|archivos) (por)/i,
  /^(break down|distribute|summarize) (my|the) (documents|files) (by|per) .+/i,
  /^(detalhe|distribua|resuma) (meus|os) (documentos|arquivos) (por) .+/i,
  /^(desglosa|distribuye|resume) (mis|los) (documentos|archivos) (por) .+/i,
  /^(group|organize|categorize) (my|the) (documents|files) (by|per) .+/i,
  /^(agrupe|organize|categorize) (meus|os) (documentos|arquivos) (por) .+/i,
  /^(agrupa|organiza|categoriza) (mis|los) (documentos|archivos) (por) .+/i,
  /^what (percentage|proportion) (of|for) (my|the) (documents|files) (are|were) .+/i,
  /^que (porcentagem|proporção) (dos|para) (meus|os) (documentos|arquivos) (são|foram) .+/i,
  /^qué (porcentaje|proporción) (de|para) (mis|los) (documentos|archivos) (son|fueron) .+/i,
  /^(compare|contrast) (the|all) (number|count|amount) (of|for) (documents|files)/i,
  /^(compare|contraste) (o|todo) (número|contagem|quantidade) (de|para) (documentos|arquivos)/i,
  /^(compara|contrasta) (el|todo) (número|cuenta|cantidad) (de|para) (documentos|archivos)/i,
  /^which (document|file|category|folder) (has|have) (the most|the least) .+/i,
  /^qual (documento|arquivo|categoria|pasta) (tem|têm) (o maior|o menor) .+/i,
  /^cuál (documento|archivo|categoría|carpeta) (tiene|tienen) (el mayor|el menor) .+/i,
  /^what (is|are) (the|all) (largest|biggest|smallest) (document|file)/i,
  /^qual (é|o) (maior|menor) (documento|arquivo)/i,
  /^cuál (es|el) (mayor|más grande|menor|más pequeño) (documento|archivo)/i,
  /^(rank|order|sort) (my|the) (documents|files) (by|according to) .+/i,
  /^(classifique|ordene) (meus|os) (documentos|arquivos) (por|de acordo com) .+/i,
  /^(clasifica|ordena) (mis|los) (documentos|archivos) (por|según) .+/i
];

const DOC_MANAGEMENT_PATTERNS = [
  /^(delete|deletar|eliminar|supprimir|remove|remover) (the|this|that|my|all) (document|file|pdf)/i,
  /^(delete|deletar|eliminar|supprimir) (o|este|esse|meu|todo) (documento|arquivo|ficheiro|pdf)/i,
  /^(delete|deletar|eliminar|supprimir) (el|este|ese|mi|todo) (documento|archivo|fichero|pdf)/i,
  /^(delete|deletar|eliminar) .+ (document|file|pdf) (named|called|titled) .+/i,
  /^(delete|deletar|eliminar) .+ (documento|arquivo|pdf) (chamado|intitulado) .+/i,
  /^(delete|deletar|eliminar) .+ (documento|archivo|pdf) (llamado|titulado) .+/i,
  /^(delete|deletar|eliminar) (all|the) (documents|files) (in|from) (the|this) (folder|directory)/i,
  /^(delete|deletar|eliminar) (todos|os) (documentos|arquivos) (na|da) (pasta|diretório)/i,
  /^(delete|deletar|eliminar) (todos|los) (documentos|archivos) (en|de) (la|esta) (carpeta|directorio)/i,
  /^(delete|deletar|eliminar) (all|the) (documents|files) (tagged|marked) (as|with) .+/i,
  /^(delete|deletar|eliminar) (todos|os) (documentos|arquivos) (marcados|etiquetados) (como|com) .+/i,
  /^(delete|deletar|eliminar) (todos|los) (documentos|archivos) (marcados|etiquetados) (como|con) .+/i,
  /^(delete|deletar|eliminar) (all|the) (old|outdated|obsolete|expired) (documents|files)/i,
  /^(delete|deletar|eliminar) (todos|os) (antigos|desatualizados|obsoletos|expirados) (documentos|arquivos)/i,
  /^(delete|deletar|eliminar) (todos|los) (antiguos|desactualizados|obsoletos|expirados) (documentos|archivos)/i,
  /^(move|mover|transfer|transferir) (the|this|that|my|all) (document|file|pdf) (to|into) .+ (folder|directory)/i,
  /^(move|mover|transfer|transferir) (o|este|esse|meu|todo) (documento|arquivo|pdf) (para|em) .+ (pasta|diretório)/i,
  /^(move|mover|transfer|transferir) (el|este|ese|mi|todo) (documento|archivo|pdf) (a|en) .+ (carpeta|directorio)/i,
  /^(move|mover) .+ (document|file) (to|into) .+ (folder|directory|location)/i,
  /^(move|mover) .+ (documento|arquivo) (para|em) .+ (pasta|diretório|local)/i,
  /^(move|mover) .+ (documento|archivo) (a|en) .+ (carpeta|directorio|ubicación)/i,
  /^(move|mover) (all|the) (documents|files) (in|from) .+ (to|into) .+/i,
  /^(move|mover) (todos|os) (documentos|arquivos) (em|de) .+ (para|em) .+/i,
  /^(move|mover) (todos|los) (documentos|archivos) (en|de) .+ (a|en) .+/i,
  /^(rename|renomear|renombrar) (the|this|that|my) (document|file|pdf) (to|para|a) .+/i,
  /^(rename|renomear|renombrar) (o|este|esse|meu) (documento|arquivo|pdf) (para|a) .+/i,
  /^(rename|renomear|renombrar) (el|este|ese|mi) (documento|archivo|pdf) (a) .+/i,
  /^(rename|renomear|renombrar) .+ (document|file|pdf) (to|para|a) .+/i,
  /^(rename|renomear|renombrar) .+ (documento|arquivo|pdf) (para|a) .+/i,
  /^(rename|renomear|renombrar) .+ (documento|archivo|pdf) (a) .+/i,
  /^(change|mudar|cambiar) (the|this|that|my) (document|file|pdf) (name|filename|title) (to|para|a) .+/i,
  /^(change|mudar|cambiar) (o|este|esse|meu) (documento|arquivo|pdf) (nome|título) (para|a) .+/i,
  /^(change|mudar|cambiar) (el|este|ese|mi) (documento|archivo|pdf) (nombre|título) (a) .+/i,
  /^(tag|marcar|etiquetar|label|rotular|mark) (the|this|that|my|all) (document|file|pdf) (as|with) .+/i,
  /^(tag|marcar|etiquetar|rotular) (o|este|esse|meu|todo) (documento|arquivo|pdf) (como|com) .+/i,
  /^(tag|marcar|etiquetar) (el|este|ese|mi|todo) (documento|archivo|pdf) (como|con) .+/i,
  /^(tag|marcar|etiquetar) .+ (document|file|pdf) (as|with) .+/i,
  /^(tag|marcar|etiquetar) .+ (documento|arquivo|pdf) (como|com) .+/i,
  /^(tag|marcar|etiquetar) .+ (documento|archivo|pdf) (como|con) .+/i,
  /^(tag|marcar|etiquetar) (all|the) (documents|files) (in|from) .+ (as|with) .+/i,
  /^(tag|marcar|etiquetar) (todos|os) (documentos|arquivos) (em|de) .+ (como|com) .+/i,
  /^(tag|marcar|etiquetar) (todos|los) (documentos|archivos) (en|de) .+ (como|con) .+/i,
  /^(add|adicionar|añadir) (the|a) (tag|label|etiqueta) .+ (to|para|a) .+ (document|file|pdf)/i,
  /^(add|adicionar|añadir) (a|uma|una) (tag|etiqueta|rótulo) .+ (para|a|ao) .+ (documento|arquivo|pdf)/i,
  /^(add|adicionar|añadir) (la|una) (tag|etiqueta) .+ (a|al) .+ (documento|archivo|pdf)/i,
  /^(untag|desmarcar|quitar etiqueta|unlabel|remove tag) .+ (from|de) .+ (document|file|pdf)/i,
  /^(untag|desmarcar|remover etiqueta) .+ (de|do) .+ (documento|arquivo|pdf)/i,
  /^(untag|quitar etiqueta|remover etiqueta) .+ (de|del) .+ (documento|archivo|pdf)/i,
  /^(remove|remover|quitar) (the|a) (tag|label|etiqueta) .+ (from|de) .+ (document|file|pdf)/i,
  /^(remove|remover|quitar) (a|o) (tag|etiqueta|rótulo) .+ (de|do) .+ (documento|arquivo|pdf)/i,
  /^(remove|remover|quitar) (la|el) (tag|etiqueta) .+ (de|del) .+ (documento|archivo|pdf)/i,
  /^(organize|organizar|arrange|arranjar|arreglar|sort|ordenar) (my|the|all) (documents|files) (by|per) .+/i,
  /^(organize|organizar|arranjar|ordenar) (meus|os|todos) (documentos|arquivos) (por) .+/i,
  /^(organize|organizar|arreglar|ordenar) (mis|los|todos) (documentos|archivos) (por) .+/i,
  /^(archive|arquivar|archivar) (the|this|that|my|all) (document|file|pdf)/i,
  /^(archive|arquivar|archivar) (o|este|esse|meu|todo) (documento|arquivo|pdf)/i,
  /^(archive|arquivar|archivar) (el|este|ese|mi|todo) (documento|archivo|pdf)/i,
  /^(archive|arquivar|archivar) .+ (document|file|pdf)/i,
  /^(archive|arquivar|archivar) .+ (documento|arquivo|pdf)/i,
  /^(archive|arquivar|archivar) .+ (documento|archivo|pdf)/i,
  /^(archive|arquivar|archivar) (all|the) (documents|files) (in|from) (the|this) (folder|directory)/i,
  /^(archive|arquivar|archivar) (todos|os) (documentos|arquivos) (na|da) (pasta|diretório)/i,
  /^(archive|arquivar|archivar) (todos|los) (documentos|archivos) (en|de) (la|esta) (carpeta|directorio)/i,
  /^(unarchive|desarquivar|desarchivar|restore|restaurar) (the|this|that|my|all) (document|file|pdf)/i,
  /^(unarchive|desarquivar|desarchivar|restaurar) (o|este|esse|meu|todo) (documento|arquivo|pdf)/i,
  /^(unarchive|desarquivar|desarchivar|restaurar) (el|este|ese|mi|todo) (documento|archivo|pdf)/i,
  /^(duplicate|duplicar|copy|copiar|clone|clonar) (the|this|that|my) (document|file|pdf)/i,
  /^(duplicate|duplicar|copiar|clonar) (o|este|esse|meu) (documento|arquivo|pdf)/i,
  /^(duplicate|duplicar|copiar|clonar) (el|este|ese|mi) (documento|archivo|pdf)/i,
  /^(make|fazer|hacer) (a|uma|una) (copy|cópia|copia) (of|de) .+ (document|file|pdf)/i,
  /^(make|fazer|hacer) (uma|una) (cópia|copia) (de|do|del) .+ (documento|arquivo|pdf)/i,
  /^(make|fazer|hacer) (una) (copia) (de|del) .+ (documento|archivo|pdf)/i,
  /^(merge|mesclar|fusionar|combine|combinar|join|juntar|unir) .+ (and|e|y) .+ (documents|files|pdfs)/i,
  /^(merge|mesclar|fusionar|combinar|juntar|unir) .+ (e|y) .+ (documentos|arquivos|pdfs)/i,
  /^(merge|mesclar|fusionar|combinar|juntar|unir) .+ (y) .+ (documentos|archivos|pdfs)/i,
  /^(share|compartilhar|compartir) (the|this|that|my|all) (document|file|pdf) (with|com|con) .+/i,
  /^(share|compartilhar|compartir) (o|este|esse|meu|todo) (documento|arquivo|pdf) (com|con) .+/i,
  /^(share|compartilhar|compartir) (el|este|ese|mi|todo) (documento|archivo|pdf) (con) .+/i,
  /^(publish|publicar|make public|tornar público|hacer público) (the|this|that|my|all) (document|file|pdf)/i,
  /^(publish|publicar|tornar público) (o|este|esse|meu|todo) (documento|arquivo|pdf)/i,
  /^(publish|publicar|hacer público) (el|este|ese|mi|todo) (documento|archivo|pdf)/i,
  /^(download|baixar|descargar|export|exportar|save|salvar|guardar) (the|this|that|my|all) (document|file|pdf)/i,
  /^(download|baixar|descargar|exportar|salvar) (o|este|esse|meu|todo) (documento|arquivo|pdf)/i,
  /^(download|baixar|descargar|exportar|guardar) (el|este|ese|mi|todo) (documento|archivo|pdf)/i
];

const PREFERENCE_UPDATE_PATTERNS = [
  /^(from now on|de agora em diante|a partir de ahora) .+ (answer|respond|reply|responda|responde)/i,
  /^(from now on|de agora em diante|a partir de ahora) .+ (in|em|en) (english|portuguese|spanish|inglês|português|espanhol)/i,
  /^(from now on|de agora em diante|a partir de ahora) .+ (be|seja|sé) (concise|brief|detailed|objetivo|breve|detalhado)/i,
  /^(from now on|de agora em diante|a partir de ahora) .+ (use|usa|utilize) (bullets|tópicos|viñetas|paragraphs|parágrafos|párrafos)/i,
  /^(always|sempre|siempre) (answer|respond|reply|responda|responde) (in|em|en) .+/i,
  /^(always|sempre|siempre) (be|seja|sé) (concise|brief|detailed|formal|casual|objetivo|breve|detalhado|formal|casual)/i,
  /^(always|sempre|siempre) (include|inclua|incluye) (examples|citations|sources|exemplos|citas|fontes)/i,
  /^(always|sempre|siempre) (use|usa|utilize) (bullets|tópicos|viñetas|bold|negrito|negrita)/i,
  /^(remember|lembre|recuerda) (that|que) (I|eu|yo) (am|sou|soy) .+/i,
  /^(remember|lembre|recuerda) (that|que) (my|meu|mi) (role|company|position|papel|empresa|posição|rol|empresa|posición) (is|é|es) .+/i,
  /^(remember|lembre|recuerda) (I|eu|yo) (work|trabalho|trabajo) (at|in|for|na|em|para|en) .+/i,
  /^(remember|lembre|recuerda) (my|meu|mi) (name|company|industry|nome|empresa|indústria|nombre|empresa|industria) (is|é|es) .+/i,
  /^(keep in mind|tenha em mente|ten en cuenta) (that|que) (I|eu|yo) .+/i,
  /^(note|note|nota) (that|que) (I|eu|yo) (am|sou|soy|prefer|prefiro|prefiero|need|preciso|necesito) .+/i,
  /^(save|salvar|guardar|store|armazenar|almacenar) (that|this|isso|esto) (information|informação|información)/i,
  /^(save|salvar|guardar|store|armazenar|almacenar) (my|meu|mi) (preference|preferência|preferencia)/i,
  /^(my|meu|mi) (role|papel|rol) (is|é|es) .+/i,
  /^(my|meu|mi) (position|posição|posición) (is|é|es) .+/i,
  /^(my|meu|mi) (title|título) (is|é|es) .+/i,
  /^(my|meu|mi) (job|trabalho|trabajo) (is|é|es) .+/i,
  /^(my|meu|mi) (company|empresa) (is|é|es) .+/i,
  /^(my|meu|mi) (organization|organização|organización) (is|é|es) .+/i,
  /^(my|meu|mi) (business|negócio|negocio) (is|é|es) .+/i,
  /^(my|meu|mi) (industry|indústria|industria) (is|é|es) .+/i,
  /^(my|meu|mi) (sector|setor|sector) (is|é|es) .+/i,
  /^(my|meu|mi) (field|área|campo) (is|é|es) .+/i,
  /^(my|meu|mi) (company|empresa) (sells|vende|provides|fornece|proporciona|offers|oferece|ofrece) .+/i,
  /^(my|meu|mi) (company|empresa) (operates|opera|works|trabalha|trabaja) (in|em|en) .+/i,
  /^(I|eu|yo) (am|sou|soy) (a|um|un) .+ (at|in|na|em|en) .+/i,
  /^(I|eu|yo) (am|sou|soy) (the|o|el) .+ (of|de) .+/i,
  /^(I|eu|yo) (work|trabalho|trabajo) (at|in|for|na|em|para|en) .+/i,
  /^(I|eu|yo) (work|trabalho|trabajo) (as|como) (a|um|un) .+/i,
  /^(I|eu|yo) (work|trabalho|trabajo) (in|em|en) (the|o|el) .+ (industry|sector|field|indústria|setor|área|industria|sector|campo)/i,
  /^(I'm|sou|soy) (employed|empregado|empleado) (at|by|in|na|por|em|en|por) .+/i,
  /^(I'm|sou|soy) (a|um|un) .+ (professional|specialist|expert|profissional|especialista|profesional|especialista|experto)/i,
  /^(I|eu|yo) (prefer|prefiro|prefiero) .+ (answers|responses|replies|respostas|respuestas)/i,
  /^(I|eu|yo) (prefer|prefiro|prefiero) (concise|brief|detailed|short|long|objetivo|breve|detalhado|curto|longo|conciso|breve|detallado|corto|largo) (answers|responses|respostas|respuestas)/i,
  /^(I|eu|yo) (prefer|prefiro|prefiero) (answers|responses|respostas|respuestas) (in|em|en) (bullets|paragraphs|tópicos|parágrafos|viñetas|párrafos)/i,
  /^(I|eu|yo) (prefer|prefiro|prefiero) (answers|responses|respostas|respuestas) (with|com|con) (examples|citations|sources|exemplos|citas|fontes)/i,
  /^(I|eu|yo) (like|gosto|me gusta) .+ (answers|responses|respostas|respuestas)/i,
  /^(I|eu|yo) (want|quero|quiero) .+ (answers|responses|respostas|respuestas)/i,
  /^(I|eu|yo) (need|preciso|necesito) .+ (answers|responses|respostas|respuestas)/i,
  /^(I'd like|eu gostaria|me gustaría) .+ (answers|responses|respostas|respuestas)/i,
  /^(set|definir|establecer|configure|configurar) (the|o|el) (language|idioma) (to|para|a) .+/i,
  /^(set|definir|establecer|configure|configurar) (the|o|el) (tone|style|format|tom|estilo|formato|tono|estilo|formato) (to|para|a) .+/i,
  /^(change|mudar|cambiar|update|atualizar|actualizar) (the|o|el) (language|idioma) (to|para|a) .+/i,
  /^(change|mudar|cambiar|update|atualizar|actualizar) (the|o|el) (tone|style|format|tom|estilo|formato|tono|estilo|formato) (to|para|a) .+/i,
  /^(adjust|ajustar|modify|modificar) (the|o|el) (language|tone|style|format|idioma|tom|estilo|formato|idioma|tono|estilo|formato)/i,
  /^(speak|falar|hablar|respond|responder|answer|responder) (in|em|en) (english|portuguese|spanish|inglês|português|espanhol|inglés|portugués|español)/i,
  /^(speak|falar|hablar|respond|responder|answer|responder) (to me|comigo|conmigo) (in|em|en) .+/i,
  /^(write|escrever|escribir|communicate|comunicar) (in|em|en) (english|portuguese|spanish|inglês|português|espanhol)/i,
  /^(use|usa|utilize) (english|portuguese|spanish|inglês|português|espanhol) (language|idioma)/i,
  /^(use|usa|utilize) (a|um|un) (formal|informal|casual|professional|friendly|formal|informal|casual|profissional|amigável|formal|informal|casual|profesional|amigable) (tone|style|tom|estilo|tono|estilo)/i,
  /^(be|seja|sé) (formal|informal|casual|professional|friendly|polite|respectful|formal|informal|casual|profissional|amigável|educado|respeitoso|formal|informal|casual|profesional|amigable|educado|respetuoso)/i,
  /^(be|seja|sé) (concise|brief|short|succinct|objetivo|breve|curto|sucinto|conciso|breve|corto|sucinto)/i,
  /^(be|seja|sé) (detailed|comprehensive|thorough|extensive|complete|detalhado|abrangente|completo|extenso|detallado|completo|extenso)/i,
  /^(be|seja|sé) (more|menos|más|less|menos) (concise|brief|detailed|verbose|objetivo|breve|detalhado|verboso|conciso|breve|detallado|verboso)/i,
  /^(keep|mantenha|mantén) (answers|responses|respostas|respuestas) (concise|brief|short|detailed|long|objetivo|breve|curto|detalhado|longo|conciso|breve|corto|detallado|largo)/i,
  /^(make|faça|haz) (answers|responses|respostas|respuestas) (concise|brief|short|detailed|long|objetivo|breve|curto|detalhado|longo)/i,
  /^(provide|forneça|proporciona|give|dê|da) (concise|brief|short|detailed|long|complete|objetivo|breve|curto|detalhado|longo|completo) (answers|responses|respostas|respuestas)/i,
  /^(use|usa|utilize) (bullets|bullet points|tópicos|viñetas|puntos) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(use|usa|utilize) (paragraphs|parágrafos|párrafos) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(use|usa|utilize) (numbered|numerado) (lists|listas) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(use|usa|utilize) (tables|tabelas|tablas) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(use|usa|utilize) (charts|graphs|gráficos) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(include|inclua|incluye) (examples|exemplos|ejemplos) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(include|inclua|incluye) (citations|citações|citas) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(include|inclua|incluye) (sources|references|fontes|referências|fuentes|referencias) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(include|inclua|incluye) (links|urls|links|enlaces) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(use|usa|utilize) (bold|negrito|negrita) (text|texto) (for|para) (emphasis|ênfase|énfasis)/i,
  /^(use|usa|utilize) (italic|itálico|cursiva) (text|texto) (for|para) (emphasis|ênfase|énfasis)/i,
  /^(use|usa|utilize) (underline|sublinhado|subrayado) (text|texto) (for|para) (emphasis|ênfase|énfasis)/i,
  /^(use|usa|utilize) (emoji|emoticons|emoji|emoticon) (in|em|en) (answers|responses|respostas|respuestas)/i,
  /^(don't use|não use|no uses) (emoji|emoticons|emoji|emoticon) (in|em|en) (answers|responses|respostas|respuestas)/i
];

const ANSWER_REWRITE_PATTERNS = [
  /^(explain|explique|explica) (that|this|isso|isto|eso) (better|melhor|mejor)/i,
  /^(explain|explique|explica) (that|this|isso|isto|eso) (in|em|en) (simpler|more simple|mais simples|más simple) (words|palavras|palabras)/i,
  /^(simpler|mais simples|más simple) (words|palavras|palabras)/i,
  /^(more|mais|más) (detail|details|detalhes|detalles)/i,
  /^(more|mais|más) (detail|details|detalhes|detalles) (please|por favor)/i,
  /^(in|em|en) (more|mais|más) (detail|details|detalhes|detalles)/i,
  /^(rephrase|reformule|reformula) (that|this|the last|isso|isto|o último|eso|lo último)/i,
  /^(rephrase|reformule|reformula) (the|o|el) (last|último) (part|parte)/i,
  /^(expand|expanda|amplía) (item|bullet|point|tópico|viñeta|punto) \\d+/i,
  /^(expand|expanda|amplía) (on|sobre) (that|this|item|point|isso|isto|item|ponto|eso|ítem|punto)/i,
  /^(show|mostre|muestra) (examples|exemplos|ejemplos)/i,
  /^(show|mostre|muestra) (examples|exemplos|ejemplos) (of|de) (what|o que|lo que) (you|você|tú) (just|acabou de|acabas de) (said|disse|dijiste)/i,
  /^(give|dê|da) (me|para mim|para mi) (examples|exemplos|ejemplos)/i,
  /^(provide|forneça|proporciona) (examples|exemplos|ejemplos)/i,
  /^(repeat|repita|repite) (that|this|isso|isto|eso)/i,
  /^(repeat|repita|repite)$/i,
  /^(say|diga|di) (that|this|isso|isto|eso) (again|novamente|de nuevo)/i,
  /^(say|diga|di) (again|novamente|de nuevo)/i,
  /^(I|eu|yo) (didn't|não|no) (understand|entendi|entendí)/i,
  /^(I|eu|yo) (don't|não|no) (understand|entendo|entiendo)/i,
  /^(not|não|no) (clear|claro)/i,
  /^(unclear|não está claro|no está claro)/i,
  /^(confusing|confuso)/i,
  /^(can you|você pode|puedes) (clarify|esclarecer|aclarar) (that|this|isso|isto|eso)/i,
  /^(clarify|esclareça|aclara) (that|this|isso|isto|eso)/i,
  /^(make|torne|haz) (it|isso|eso) (clearer|mais claro|más claro)/i,
  /^(simplify|simplifique|simplifica) (that|this|isso|isto|eso)/i,
  /^(simplify|simplifique|simplifica)$/i,
  /^(break|detalhe|desglosa) (it|that|this|isso|isto|eso) (down|detalhadamente)/i,
  /^(break down|detalhar|desglosar) (that|this|isso|isto|eso)/i,
  /^(elaborate|elabore|elabora) (on|sobre) (that|this|isso|isto|eso)/i,
  /^(elaborate|elabore|elabora)$/i,
  /^(go|aprofunde|profundiza) (deeper|mais fundo|más profundo)/i,
  /^(more|mais|más) (depth|profundidade|profundidad)/i,
  /^(add|adicione|añade) (more|mais|más)/i,
  /^(tell|diga|dime) (me|para mim|para mi) (more|mais|más)/i,
  /^(what|o que|qué) (else|mais|más)/i,
  /^(anything|mais alguma|algo) (else|coisa|más)/i,
  /^(continue|continue|continúa)$/i,
  /^(keep|continue|sigue) (going|indo|yendo)/i,
  /^(go on|prossiga|sigue)/i,
  /^(more|mais|más) (info|information|informação|información)/i,
  /^(additional|informação adicional|información adicional) (info|information|informação|información)/i,
  /^(further|mais|más) (details|detalhes|detalles)/i,
  /^(other|outros|otros) (aspects|aspectos)/i,
  /^(other|outros|otros) (points|pontos|puntos)/i,
  /^(different|ângulo diferente|ángulo diferente) (angle|perspectiva)/i,
  /^(another|outra|otra) (way|forma)/i,
  /^(differently|diferentemente)/i,
  /^(reword|reformule|reformula) (that|this|isso|isto|eso)/i,
  /^(restate|reformule|reformula) (that|this|isso|isto|eso)/i,
  /^(paraphrase|parafraseie|parafrasea) (that|this|isso|isto|eso)/i,
  /^(say|diga|di) (differently|diferentemente)/i,
  /^(put|coloque|pon) (differently|diferentemente)/i
];

const FEEDBACK_POSITIVE_PATTERNS = [
  /^(that's|that is|isso está|eso está) (perfect|great|correct|perfeito|ótimo|correto|perfecto|genial|correcto)/i,
  /^(exactly|exatamente|exactamente)$/i,
  /^(thanks|thank you|obrigado|gracias)( very much| so much| muito| mucho)?$/i,
  /^(helpful|útil)$/i,
  /^(good|bom|bueno)$/i,
  /^(awesome|amazing|fantastic|wonderful|brilliant|incrível|increíble|fantástico|maravilhoso|maravilloso|brilhante|brillante)$/i,
  /^(excellent|excelente)$/i,
  /^(superb|outstanding|soberbo|excepcional|soberbio|excepcional)$/i,
  /^(nice|cool|legal|genial)$/i,
  /^(spot on|certeiro|acertado)$/i,
  /^(right|certo|correcto)$/i,
  /^(accurate|precise|preciso)$/i,
  /^(well done|bem feito|bien hecho)$/i,
  /^(very|muito|muy) (good|helpful|bom|útil|bueno|útil)$/i,
  /^(just|exatamente|justo) (what|o que|lo que) (I|eu|yo) (needed|wanted|precisava|queria|necesitaba|quería)$/i,
  /^(that's|that is|isso é|eso es) (what|o que|lo que) (I|eu|yo) (wanted|needed|queria|precisava|quería|necesitaba)$/i,
  /^(appreciate|agradeço|aprecio) (it|isso|eso)$/i,
  /^(love|adorei|adoro|me encanta) (it|isso|eso)$/i,
  /^(works|funciona) (perfectly|great|perfeitamente|ótimo|perfectamente|genial)$/i,
  /^(perfect|perfeito|perfecto)$/i,
  /^(great|ótimo|genial)$/i,
  /^(correct|correto|correcto)$/i,
  /^(exactly|exatamente|exactamente) (what|o que|lo que) (I|eu|yo) (needed|wanted|precisava|queria|necesitaba|quería)$/i,
  /^(that|isso|eso) (helped|ajudou|ayudó)$/i,
  /^(very|really|muito|realmente|muy|realmente) (helpful|useful|útil|útil)$/i
];

const FEEDBACK_NEGATIVE_PATTERNS = [
  /^(that's|that is|isso está|eso está) (wrong|incorrect|errado|incorreto|incorrecto)/i,
  /^(you|você|tú) (mixed up|confused|confundiu|confundiste) (the|os|los) (documents|files|documentos|arquivos|archivos)/i,
  /^(this|that|isso|eso) (is not|isn't|não está|no está) (in|no|dans) (the|o|el) (file|document|arquivo|documento|ficheiro|archivo)/i,
  /^(mistake|erro|error)$/i,
  /^(bad|ruim|malo) (answer|response|resposta|respuesta)/i,
  /^(doesn't|não|no) (make sense|faz sentido|tiene sentido)/i,
  /^(inaccurate|impreciso)$/i,
  /^(false|falso)$/i,
  /^(untrue|não é verdade|no es verdad)$/i,
  /^(misleading|enganoso|engañoso)$/i,
  /^(confusing|confuso)$/i,
  /^(unclear|não claro|no claro)$/i,
  /^(vague|vago)$/i,
  /^(ambiguous|ambíguo|ambiguo)$/i,
  /^(incomplete|incompleto)$/i,
  /^(missing|faltando|faltante) (information|data|informação|dados|información|datos)/i,
  /^(not|não|no) (helpful|useful|útil)$/i,
  /^(useless|inútil)$/i,
  /^(unhelpful|não ajuda|no ayuda)$/i,
  /^(poor|pobre) (answer|response|resposta|respuesta)$/i,
  /^(terrible|awful|horrible|terrível|horrível|horrible)$/i,
  /^(not|não|no) (right|correct|accurate|certo|correto|preciso|correcto|preciso)$/i,
  /^(off|errado|equivocado)$/i,
  /^(off target|fora do alvo|fuera del objetivo)$/i,
  /^(not|não|no) (what|o que|lo que) (I|eu|yo) (asked|perguntei|pregunté)$/i,
  /^(didn't|não|no) (answer|respondeu|respondió) (my|minha|mi) (question|pergunta|pregunta)$/i,
  /^(not|não|no) (relevant|relevante)$/i,
  /^(irrelevant|irrelevante)$/i,
  /^(doesn't|não|no) (help|ajuda|ayuda)$/i,
  /^(not|não|no) (useful|útil)$/i,
  /^(wrong|errado|incorrecto) (answer|response|information|resposta|informação|respuesta|información)$/i,
  /^(this|that|isso|eso) (is|está) (wrong|incorrect|errado|incorreto|incorrecto)$/i
];

const PRODUCT_HELP_PATTERNS = [
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo|cómo) (upload|add|enviar|adicionar|subir|añadir) (a|um|un) (document|file|pdf|documento|arquivo|ficheiro|archivo)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (delete|remove|deletar|remover|eliminar) (a|um|un) (document|file|documento|arquivo|archivo)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (search|find|buscar|encontrar) (documents|files|documentos|arquivos|archivos)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (organize|tag|label|organizar|marcar|etiquetar|rotular) (my|meus|mis) (documents|files|documentos|arquivos|archivos)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (share|compartilhar|compartir) (a|um|un) (document|file|documento|arquivo|archivo)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (export|download|exportar|baixar|descargar) (a|um|un) (document|file|documento|arquivo|archivo)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (change|update|modify|mudar|atualizar|modificar|cambiar|actualizar) (my|meu|mi) (settings|preferences|configurações|preferências|configuración|preferencias)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (change|update|mudar|atualizar|cambiar|actualizar) (my|meu|mi) (language|idioma)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (upgrade|atualizar|actualizar) (my|meu|mi) (plan|subscription|plano|assinatura|suscripción)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (cancel|cancelar) (my|meu|mi) (subscription|assinatura|suscripción)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (update|change|atualizar|mudar|actualizar|cambiar) (my|meu|mi) (payment|billing|pagamento|cobrança|pago|facturación) (method|information|método|informação|información)/i,
  /^(can I|posso|puedo) (upload|add|enviar|adicionar|subir|añadir) (multiple|vários|varios) (documents|files|documentos|arquivos|archivos)/i,
  /^(can I|posso|puedo) (delete|remove|deletar|remover|eliminar) (multiple|vários|varios) (documents|files|documentos|arquivos|archivos) (at once|de uma vez|a la vez)/i,
  /^(can I|posso|puedo) (search|buscar) (across|em|en) (all|todos) (my|meus|mis) (documents|files|documentos|arquivos|archivos)/i,
  /^(can I|posso|puedo) (organize|organizar) (documents|documentos|archivos) (by|por) (folder|tag|pasta|etiqueta|carpeta)/i,
  /^(can I|posso|puedo) (share|compartilhar|compartir) (documents|documentos|archivos) (with|com|con) (others|outros|otros)/i,
  /^(can I|posso|puedo) (export|download|exportar|baixar|descargar) (all|todos) (my|meus|mis) (documents|documentos|archivos)/i,
  /^(is it possible|é possível|es posible) (to|para) (upload|add|search|delete|enviar|adicionar|buscar|deletar|subir|añadir|eliminar) .+/i,
  /^what (is|are|é|são|es|son) (the|o|el|os|los) (limit|maximum|quota|limite|máximo|cota|límite|cuota) (for|of|para|de) (documents|files|storage|documentos|arquivos|armazenamento|archivos|almacenamiento)/i,
  /^what (is|are|é|são|es|son) (the|o|el|os|los) (storage|space|capacity|armazenamento|espaço|capacidade|almacenamiento|espacio|capacidad) (limit|maximum|limite|máximo|límite)/i,
  /^how (much|many|quanto|quantos|cuánto|cuántos) (storage|space|documents|files|armazenamento|espaço|documentos|arquivos|almacenamiento|espacio|archivos) (do I have|can I|tenho|posso|tengo|puedo)/i,
  /^what (features|recursos|características) (are|does|estão|está|están) (available|included|disponíveis|incluídos|disponibles|incluidos) (in|on|em|no|en) (my|the|meu|o|mi|el) (plan|subscription|plano|assinatura|suscripción)/i,
  /^what (is|are|é|são|es|son) (the|a|o|el|la) (difference|diferença|diferencia) (between|among|entre) (the|os|los) (plans|subscriptions|planos|assinaturas|suscripciones)/i,
  /^how (do I|can I|to|como eu|posso|como|cómo|puedo) (integrate|connect|sync|integrar|conectar|sincronizar) (with|com|con) .+/i,
  /^(does|do|faz|fazem|hace|hacen) (koda|this) (integrate|connect|work|integra|conecta|funciona) (with|com|con) .+/i,
  /^(is there|há|existe|hay) (an|a|um|uma|un|una) (api|integration|webhook|plugin|extension|integração|plugin|extensão|integración)/i,
  /^(is there|há|existe|hay) (a|um|uma|un|una) (mobile|desktop|web|móvel|desktop|web|móvil|escritorio) (app|version|aplicativo|versão|aplicación|versión)/i,
  /^(does|do|faz|fazem|hace|hacen) (koda|this) (work|support|funciona|suporta|funciona|soporta) (on|in|em|no|en) (mobile|desktop|chrome|firefox|safari|edge|móvel|desktop|chrome|firefox|safari|edge|móvil|escritorio)/i,
  /^(where|how|onde|como|dónde|cómo) (can I find|posso encontrar|puedo encontrar) (help|support|documentation|docs|ajuda|suporte|documentação|docs|ayuda|soporte|documentación)/i,
  /^(where|how|onde|como|dónde|cómo) (can I find|posso encontrar|puedo encontrar) (the|o|el|a|la) (guide|tutorial|manual|instructions|guia|tutorial|manual|instruções|guía|instrucciones)/i,
  /^(is there|há|existe|hay) (a|um|uma|un|una) (guide|tutorial|video|demo|walkthrough|guia|tutorial|vídeo|demonstração|passo a passo|guía|video|demostración|paso a paso) (for|on|about|para|sobre|acerca de) .+/i,
  /^(show|mostre|muestra) (me|para mim|para mi) (how|como|cómo) (to|para) .+/i,
  /^(I need|eu preciso|yo necesito) (help|support|ajuda|suporte|ayuda|soporte) (with|com|con) .+/i,
  /^(I have|eu tenho|yo tengo) (a|um|uma|un|una) (question|problem|issue|pergunta|problema|pregunta|problema) (about|with|sobre|com|acerca de|con) .+/i,
  /^(I'm having|estou tendo|estoy teniendo) (a|um|una) (problem|issue|error|problema|erro|error) (with|com|con) .+/i,
  /^(something|algo) (is|está) (not|não|no) (working|funcionando)/i,
  /^(this|that|isso|eso) (doesn't|isn't|não|no) (work|working|funciona|funcionando)/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (fix|solve|resolve|consertar|resolver|arreglar|resolver) .+/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (troubleshoot|solucionar|solucionar problemas) .+/i
];

const ONBOARDING_HELP_PATTERNS = [
  /^(getting started|começando|empezando)$/i,
  /^(getting started|começando|empezando) (with|com|con) (koda|this)/i,
  /^(I'm|I am|eu sou|yo soy) (a|um|un) (new|first time|novo|primeira vez|nuevo|primera vez) (user|usuário|usuario)/i,
  /^(I'm|I am|eu sou|yo soy) (new|beginner|novo|iniciante|nuevo|principiante) (to|para|a) (this|koda|isso|esto)/i,
  /^(first|primeira|primera) (time|vez) (using|user|usando|usuário|usando|usuario) (this|koda|isso|esto)/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (start|begin|get started|começar|iniciar|empezar|iniciar)/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (setup|set up|configure|configurar|configurar)/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (create|make|criar|fazer|crear|hacer) (an|a|um|uma|un|una) (account|conta|cuenta)/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (sign up|register|inscrever-se|registrar|registrarse)/i,
  /^(how|como|cómo) (do I|can I|to|eu|posso|yo|puedo) (login|log in|access|fazer login|entrar|acessar|iniciar sesión|acceder)/i,
  /^(what|o que|qué) (is|are|é|são|es|son) (koda|this)/i,
  /^(what|o que|qué) (does|do|can|faz|fazem|pode|hace|hacen|puede) (koda|this) (do|fazer|hacer)/i,
  /^(what|o que|qué) (can I|posso|puedo) (do|fazer|hacer) (with|using|com|usando|con|usando) (koda|this)/i,
  /^(explain|explique|explica) (koda|this) (to me|para mim|para mi)/i,
  /^(tell|diga|dime) (me|para mim|para mi) (about|sobre|acerca de) (koda|this)/i,
  /^(I want to|eu quero|yo quiero) (learn|understand|know|aprender|entender|saber|aprender|entender|saber) (about|sobre|acerca de) (koda|this)/i,
  /^(I need to|eu preciso|yo necesito) (learn|understand|know|aprender|entender|saber) (how|como|cómo) (to|para) (use|usar) (koda|this)/i,
  /^(show|mostre|muestra) (me|para mim|para mi) (how|como|cómo) (to|para) (use|start|usar|começar|usar|empezar) (koda|this)/i,
  /^(show|mostre|muestra) (me|para mim|para mi) (the|o|el|os|los) (basics|fundamentals|básico|fundamentos|básico|fundamentos)/i,
  /^(show|mostre|muestra) (me|para mim|para mi) (an|a|um|uma|un|una) (overview|introduction|visão geral|introdução|descripción general|introducción)/i,
  /^(give|dê|da) (me|para mim|para mi) (an|a|um|uma|un|una) (overview|introduction|tutorial|visão geral|introdução|tutorial|descripción general|introducción)/i,
  /^(give|dê|da) (me|para mim|para mi) (a|um|uma|un|una) (quick|rápido) (start|introduction|início|introdução|inicio|introducción)/i,
  /^(I want|eu quero|yo quiero) (a|um|uma|un|una) (tutorial|guide|walkthrough|demo|tutorial|guia|passo a passo|demonstração|guía|paso a paso|demostración)/i,
  /^(is there|há|existe|hay) (a|um|uma|un|una) (tutorial|guide|walkthrough|intro|tutorial|guia|passo a passo|intro|guía|paso a paso)/i,
  /^(where|how|onde|como|dónde|cómo) (can I find|posso encontrar|puedo encontrar) (a|the|um|o|un|el) (tutorial|guide|intro|tutorial|guia|intro|guía)/i,
  /^(what|quais|cuáles) (are|the|são|os|son|las) (the|os|las) (main|key|basic|principais|principais|básicos|principales|clave|básicas) (features|capabilities|recursos|capacidades|características|capacidades)/i,
  /^(what|quais|cuáles) (are|the|são|os|son|las) (the|os|las) (first|primeiros|primeros) (steps|passos|pasos)/i,
  /^(what|o que|qué) (should I|devo|debería) (do|fazer|hacer) (first|primeiro|primero)/i,
  /^(where|how|onde|como|dónde|cómo) (do I|can I|eu|posso|yo|puedo) (start|begin|começar|iniciar|empezar|iniciar)/i,
  /^(how|como|cómo) (does|do|faz|fazem|hace|hacen) (koda|this) (work|funciona)/i,
  /^(how|como|cómo) (to|para) (use|usar) (koda|this)/i,
  /^(basic|uso básico|uso básico) (usage|use|uso)/i,
  /^(common|typical|tarefas comuns|fluxo de trabalho típico|tareas comunes|flujo de trabajo típico) (tasks|workflow|tarefas|fluxo de trabalho|tareas|flujo de trabajo)/i,
  /^(example|sample|exemplo|amostra|ejemplo|muestra) (of|de) (how|como|cómo) (to|para) (use|usar) (koda|this)/i,
  /^(show|mostre|muestra) (me|para mim|para mi) (an|a|um|uma|un|una) (example|sample|demo|exemplo|amostra|demonstração|ejemplo|muestra|demostración)/i,
  /^(what|quais|cuáles) (can I|posso|puedo) (ask|do|perguntar|fazer|preguntar|hacer)/i,
  /^(what|quais|cuáles) (questions|perguntas|preguntas) (can I|posso|puedo) (ask|perguntar|preguntar)/i,
  /^(what|quais|cuáles) (are|the|são|os|son|las) (some|alguns|algunos) (use cases|scenarios|casos de uso|cenários|casos de uso|escenarios)/i
];

const GENERIC_KNOWLEDGE_PATTERNS = [
  /^who (is|was|are|were|é|foi|são|foram|es|fue|son|fueron) .+/i,
  /^who (invented|discovered|founded|created|wrote|inventou|descobriu|fundou|criou|escreveu|inventó|descubrió|fundó|creó|escribió) .+/i,
  /^who (is|was|é|foi|es|fue) (the|o|el|a|la) (inventor|founder|creator|author|president|CEO|leader|inventor|fundador|criador|autor|presidente|CEO|líder) (of|de) .+/i,
  /^what (is|are|was|were|é|são|foi|foram|es|son|fue|fueron) .+/i,
  /^what (does|do|did|faz|fazem|fez|hace|hacen|hizo) .+ (mean|significa|significa)/i,
  /^what (is|are|é|são|es|son) (the|a|o|a|el|la) (meaning|definition|significance|significado|definição|significância|significado|definición|significado) (of|de) .+/i,
  /^what (is|are|é|são|es|son) (the|a|o|a|el|la) (capital|population|president|leader|capital|população|presidente|líder|capital|población|presidente|líder) (of|de) .+/i,
  /^what (is|are|é|são|es|son) (the|a|o|a|el|la) (history|origin|story|história|origem|história|historia|origen|historia) (of|behind|de|por trás de) .+/i,
  /^when (did|was|were|is|are|foi|foram|é|são|fue|fueron|es|son) .+ (happen|occur|take place|invented|discovered|founded|aconteceu|ocorreu|teve lugar|inventado|descoberto|fundado|sucedió|ocurrió|tuvo lugar|inventado|descubierto|fundado)/i,
  /^when (was|were|is|are|foi|foram|é|são|fue|fueron|es|son) .+ (born|died|created|invented|discovered|founded|nascido|morreu|criado|inventado|descoberto|fundado|nacido|murió|creado|inventado|descubierto|fundado)/i,
  /^where (is|was|were|are|é|foi|foram|são|es|fue|fueron|son) .+ (located|situated|based|found|localizado|situado|baseado|encontrado|ubicado|situado|basado|encontrado)/i,
  /^where (did|does|do|foi|fez|fazem|fue|hizo|hacen) .+ (live|work|come from|viveu|trabalhou|veio de|vivió|trabajó|vino de)/i,
  /^why (is|are|was|were|did|does|do|é|são|foi|foram|fez|faz|fazem|es|son|fue|fueron|hizo|hace|hacen) .+/i,
  /^why (did|does|do|fez|faz|fazem|hizo|hace|hacen) .+ (happen|occur|work|aconteceu|ocorreu|funciona|sucedió|ocurrió|funciona)/i,
  /^how (is|are|was|were|does|do|did|é|são|foi|foram|faz|fazem|fez|es|son|fue|fueron|hace|hacen|hizo) .+/i,
  /^how (does|do|did|faz|fazem|fez|hace|hacen|hizo) .+ (work|function|operate|funciona|opera|funciona|opera)/i,
  /^how (was|were|é|foi|foram|es|fue|fueron) .+ (invented|discovered|created|made|formed|inventado|descoberto|criado|feito|formado|inventado|descubierto|creado|hecho|formado)/i,
  /^(tell me|me diga|dime) (about|sobre|acerca de) .+/i,
  /^(explain|explique|explica) .+ (to me|para mim|para mi)/i,
  /^(describe|descreva|describe) .+/i,
  /^(define|defina|define) .+/i,
  /^what (does|do|faz|fazem|hace|hacen) .+ (mean|significa|significa)/i,
  /^(meaning|definition|significado|definição|significado|definición) (of|de) .+/i,
  /^(history|origin|story|história|origem|história|historia|origen) (of|de) .+/i,
  /^who (invented|discovered|founded|created|inventou|descobriu|fundou|criou|inventó|descubrió|fundó|creó) .+/i,
  /^(inventor|founder|creator|author|inventor|fundador|criador|autor) (of|de) .+/i,
  /^(capital|population|president|leader|CEO|capital|população|presidente|líder|CEO|capital|población|presidente|líder) (of|de) .+/i,
  /^(when|where|why|how|quando|onde|por que|como|cuándo|dónde|por qué|cómo) (was|were|is|are|did|does|do|foi|foram|é|são|fez|faz|fazem|fue|fueron|es|son|hizo|hace|hacen) .+ (invented|discovered|founded|created|born|died|inventado|descoberto|fundado|criado|nascido|morreu|inventado|descubierto|fundado|creado|nacido|murió)/i,
  /^(in|em|en) (which|what|qual|que|cuál|qué) (year|century|decade|country|city|ano|século|década|país|cidade|año|siglo|década|país|ciudad) (was|were|is|are|foi|foram|é|são|fue|fueron|es|son) .+/i,
  /^(calculate|solve|compute|find|calcule|resolva|compute|encontre|calcula|resuelve|computa|encuentra) .+ (equation|formula|problem|equação|fórmula|problema|ecuación|fórmula|problema)/i,
  /^what (is|are|é|são|es|son) (the|a|o|a|el|la) (formula|equation|law|principle|theory|fórmula|equação|lei|princípio|teoria|fórmula|ecuación|ley|principio|teoría) (for|of|para|de) .+/i
];

const REASONING_TASK_PATTERNS = [
  /^(calculate|compute|solve|find|determine|calcule|compute|resolva|encontre|determine|calcula|computa|resuelve|encuentra|determina) .+ (plus|minus|times|divided by|mais|menos|vezes|dividido por|mas|menos|veces|dividido por) .+/i,
  /^(calculate|compute|solve|find|calcule|compute|resolva|encontre|calcula|computa|resuelve|encuentra) (the|o|el|a|la) (sum|total|difference|product|quotient|average|mean|median|soma|total|diferenca|produto|quociente|media|suma|total|diferencia|producto|cociente|promedio) (of|de) .+/i,
  /^(what|quanto|cuanto) (is|are|e|sao|es|son) .+ (plus|minus|times|divided by|mais|menos|vezes|dividido por|mas|menos|veces|dividido por) .+/i,
  /^(what|quanto|cuanto) (is|are|e|sao|es|son) (the|o|el|a|la) (sum|total|difference|product|quotient|average|soma|total|diferenca|produto|quociente|media|suma|total|diferencia|producto|cociente|promedio) (of|de) .+/i,
  /^\d+ (plus|minus|times|divided by|mais|menos|vezes|dividido por|mas|menos|veces|dividido por) \d+/i,
  /^\d+ (\+|-|\*|\/|x) \d+/i,
  /^(add|sum|adicione|some|anade|suma) .+ (and|e|y) .+/i,
  /^(subtract|subtraia|resta) .+ (from|de) .+/i,
  /^(multiply|multiplique|multiplica) .+ (by|por) .+/i,
  /^(divide|divida|divide) .+ (by|por) .+/i,
  /^(what|quanto|cuanto) (is|are|e|sao|es|son) .+ (percent|percentage|por cento|porcentagem|por ciento|porcentaje) (of|de) .+/i,
  /^(calculate|compute|find|calcule|compute|encontre|calcula|computa|encuentra) .+ (percent|percentage|por cento|porcentagem|por ciento|porcentaje) (of|de) .+/i,
  /^\d+% (of|de) .+/i,
  /^(what|quanto|cuanto) (is|are|e|sao|es|son) (the|o|el|a|la) (square|cube|power|root|square root|quadrado|cubo|potencia|raiz|raiz quadrada|cuadrado|cubo|potencia|raiz|raiz cuadrada) (of|de) .+/i,
  /^(calculate|compute|find|calcule|compute|encontre|calcula|computa|encuentra) (the|o|el|a|la) (square|cube|power|root|square root|quadrado|cubo|potencia|raiz|raiz quadrada|cuadrado|cubo|potencia|raiz|raiz cuadrada) (of|de) .+/i,
  /^\d+ (squared|cubed|to the power of|ao quadrado|ao cubo|elevado a|al cuadrado|al cubo|elevado a) .+/i,
  /^(solve|resolva|resuelve) (the|o|el|a|la) (equation|formula|problem|equacao|formula|problema|ecuacion|formula|problema) .+/i,
  /^(solve|resolva|resuelve) (for|para) .+ (in|em|en) (the|o|el|a|la) (equation|formula|equacao|formula|ecuacion|formula) .+/i,
  /^(find|encontre|encuentra) (the|o|el|a|la) (value|solution|answer|valor|solucao|resposta|valor|solucion|respuesta) (of|for|de|para) .+/i,
  /^(what|quanto|cuanto) (is|are|e|sao|es|son) (the|o|el|a|la) (average|mean|median|mode|media|mediana|moda|promedio|mediana|moda) (of|de) .+/i,
  /^(calculate|compute|find|calcule|compute|encontre|calcula|computa|encuentra) (the|o|el|a|la) (average|mean|median|mode|range|media|mediana|moda|intervalo|promedio|mediana|moda|rango) (of|de) .+/i,
  /^(what|quanto|cuanto) (is|are|e|sao|es|son) (the|o|el|a|la) (area|perimeter|circumference|volume|area|perimetro|circunferencia|volume|area|perimetro|circunferencia|volumen) (of|de) (a|um|un) .+/i,
  /^(calculate|compute|find|calcule|compute|encontre|calcula|computa|encuentra) (the|o|el|a|la) (area|perimeter|circumference|volume|surface area|area|perimetro|circunferencia|volume|area de superficie|area|perimetro|circunferencia|volumen|area de superficie) (of|de) (a|um|un) .+/i,
  /^(compare|rank|order|sort|compare|classifique|ordene|compara|clasifica|ordena) .+ (and|e|y) .+/i,
  /^(which|what|qual|que|cual|que) (is|are|e|sao|es|son) (greater|larger|bigger|smaller|less|maior|menor|mayor|mas grande|menor|mas pequeno) .+/i,
  /^(arrange|order|sort|rank|arranje|ordene|classifique|arregla|ordena|clasifica) .+ (in|by|em|por|en|por) (ascending|descending|increasing|decreasing|ordem crescente|ordem decrescente|crescente|decrescente|orden ascendente|orden descendente|creciente|decreciente) (order|ordem|orden)/i,
  /^(what|qual|cual) (is|are|e|sao|es|son) (the|o|el|a|la) (pattern|sequence|series|trend|padrao|sequencia|serie|tendencia|patron|secuencia|serie|tendencia) (in|of|em|de|en|de) .+/i,
  /^(find|identify|determine|encontre|identifique|determine|encuentra|identifica|determina) (the|o|el|a|la) (pattern|sequence|series|trend|next number|padrao|sequencia|serie|tendencia|proximo numero|patron|secuencia|serie|tendencia|siguiente numero) (in|of|em|de|en|de) .+/i,
  /^(what|qual|cual) (comes|is|vem|e|viene|es) (next|after|proximo|depois|siguiente|despues) (in|em|en) (the|o|el|a|la) (sequence|series|pattern|sequencia|serie|padrao|secuencia|serie|patron) .+/i,
  /^(if|se|si) .+ (then|what|how|entao|o que|como|entonces|que|como) .+/i,
  /^(given|dado|dado) .+ (find|calculate|determine|encontre|calcule|determine|encuentra|calcula|determina) .+/i,
  /^(assuming|supondo|suponiendo) .+ (what|how|o que|como|que|como) .+/i
];

const TEXT_TRANSFORM_PATTERNS = [
  /^(translate|traduzir|traducir) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente) (to|into|para|al) (english|portuguese|spanish|inglês|português|espanhol|inglés|portugués|español)/i,
  /^(translate|traduzir|traducir) (to|into|para|al) (english|portuguese|spanish|inglês|português|espanhol)/i,
  /^(translate|traduzir|traducir) .+ (to|into|from|para|de|al|del) (english|portuguese|spanish|inglês|português|espanhol)/i,
  /^(in|em|en) (english|portuguese|spanish|inglês|português|espanhol)$/i,
  /^(convert|converter|convertir) (this|that|isso|isto|eso) (to|into|para|al) (english|portuguese|spanish|inglês|português|espanhol)/i,
  /^(rewrite|reescrever|reescribir) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(rewrite|reescrever|reescribir) (this|that|isso|isto|eso) (in|to be|em|para ser|en|para ser) (more|menos|más) (formal|informal|casual|professional|friendly|polite|concise|brief|detailed|formal|informal|casual|profissional|amigável|educado|conciso|breve|detalhado)/i,
  /^(rephrase|reformular|reformular) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(paraphrase|parafrasear|parafrasear) (this|that|isso|isto|eso)/i,
  /^(summarize|resumir|resumir) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(make|create|give|faça|crie|dê|haz|crea|da) (a|um|una) (summary|resumo|resumen) (of|de) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(shorten|encurtar|acortar) (this|that|isso|isto|eso)/i,
  /^(condense|condensar|condensar) (this|that|isso|isto|eso)/i,
  /^(compress|comprimir|comprimir) (this|that|isso|isto|eso)/i,
  /^(reduce|reduzir|reducir) (this|that|isso|isto|eso)/i,
  /^(make|tornar|hacer) (this|that|isso|isto|eso) (shorter|more concise|brief|mais curto|mais conciso|breve|más corto|más conciso|breve)/i,
  /^(expand|expandir|ampliar) (this|that|isso|isto|eso)/i,
  /^(elaborate|elaborar|elaborar) (on|sobre) (this|that|isso|isto|eso)/i,
  /^(lengthen|alongar|alargar) (this|that|isso|isto|eso)/i,
  /^(extend|estender|extender) (this|that|isso|isto|eso)/i,
  /^(make|tornar|hacer) (this|that|isso|isto|eso) (longer|more detailed|mais longo|mais detalhado|más largo|más detallado)/i,
  /^(simplify|simplificar|simplificar) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(clarify|esclarecer|aclarar) (this|that|isso|isto|eso)/i,
  /^(explain|explicar|explicar) (this|that|isso|isto|eso) (in|em|en) (simpler|more simple|mais simples|más simple) (words|terms|palavras|termos|palabras|términos)/i,
  /^(improve|melhorar|mejorar) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(enhance|aprimorar|mejorar) (this|that|isso|isto|eso)/i,
  /^(refine|refinar|refinar) (this|that|isso|isto|eso)/i,
  /^(polish|polir|pulir) (this|that|isso|isto|eso)/i,
  /^(edit|editar|editar) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(revise|revisar|revisar) (this|that|isso|isto|eso)/i,
  /^(correct|corrigir|corregir) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(fix|consertar|arreglar) (the|os|los) (grammar|spelling|punctuation|errors|gramática|ortografia|pontuação|erros|gramática|ortografía|puntuación|errores) (in|of|em|de|en|de) (this|that|isso|isto|eso)/i,
  /^(proofread|revisar|revisar) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(check|verificar|verificar) (the|os|los) (grammar|spelling|punctuation|gramática|ortografia|pontuação|gramática|ortografía|puntuación) (of|in|de|em|de|en) (this|that|isso|isto|eso)/i,
  /^(make|tornar|hacer) (this|that|isso|isto|eso) (formal|informal|casual|professional|friendly|polite|formal|informal|casual|profissional|amigável|educado)/i,
  /^(make|tornar|hacer) (this|that|isso|isto|eso) (more|menos|más) (formal|informal|casual|professional|friendly|polite|concise|brief|detailed|formal|informal|casual|profissional|amigável|educado|conciso|breve|detalhado)/i,
  /^(change|mudar|cambiar) (the|o|el) (tone|style|voice|tom|estilo|voz|tono|estilo|voz) (of|to|de|para|de|a) (this|that|isso|isto|eso)/i,
  /^(format|formatar|formatear) (this|that|isso|isto|eso) (as|into|como|em|como|en) (bullet points|bullets|numbered list|paragraphs|tópicos|viñetas|lista numerada|parágrafos|viñetas|lista numerada|párrafos)/i,
  /^(convert|converter|convertir) (this|that|isso|isto|eso) (to|into|para|al) (bullet points|bullets|numbered list|paragraphs|tópicos|viñetas|lista numerada|parágrafos)/i,
  /^(organize|organizar|organizar) (this|that|isso|isto|eso) (into|em|en) (bullet points|bullets|numbered list|paragraphs|sections|tópicos|viñetas|lista numerada|parágrafos|seções|viñetas|lista numerada|párrafos|secciones)/i,
  /^(structure|estruturar|estructurar) (this|that|isso|isto|eso)/i,
  /^(arrange|arranjar|arreglar) (this|that|isso|isto|eso)/i,
  /^(convert|converter|convertir) (this|that|isso|isto|eso) (to|into|para|al) (uppercase|lowercase|title case|sentence case|maiúsculas|minúsculas|capitalização de título|capitalização de frase|mayúsculas|minúsculas|mayúsculas de título|mayúsculas de oración)/i,
  /^(make|tornar|hacer) (this|that|isso|isto|eso) (uppercase|lowercase|maiúsculas|minúsculas|mayúsculas|minúsculas)/i,
  /^(remove|remover|eliminar|delete|deletar) .+ (from|de) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(add|adicionar|añadir|insert|inserir|insertar) .+ (to|into|para|em|a|en) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i,
  /^(replace|substituir|reemplazar) .+ (with|by|com|por|con|por) .+ (in|em|en) (this|that|the following|isso|isto|o seguinte|eso|lo siguiente)/i
];

const CHITCHAT_PATTERNS = [
  /^(hi|hello|hey|oi|olá|ei|hola)$/i,
  /^(hi|hello|hey|oi|olá|ei|hola) (there|aí|ahí)$/i,
  /^(good|bom|buenos|buenas|boa) (morning|afternoon|evening|night|dia|tarde|noite|días|tardes|noches)$/i,
  /^(how|como|cómo) (are|is|you|vai|está|estás|va)$/i,
  /^(how's|como) (it|está) (going|indo|yendo)$/i,
  /^(what's|que|qué) (up|tal|tal)$/i,
  /^(sup|e aí|qué tal)$/i,
  /^(howdy|oi|hola)$/i,
  /^(greetings|saudações|saludos)$/i,
  /^(welcome|bem-vindo|bienvenido)$/i,
  /^(nice|pleased|prazer|encantado) (to|em|de) (meet|know|see|conhecer|saber|ver|conocer|saber|ver) (you|você|ti)$/i,
  /^(goodbye|bye|adeus|tchau|adiós)$/i,
  /^(see|até|hasta) (you|later|logo|luego|más tarde)$/i,
  /^(take|se|cuídate) (care|cuide)$/i,
  /^(have|tenha|que tengas) (a|um|un) (good|nice|great|bom|buen) (day|night|week|dia|noite|semana|día|noche|semana)$/i,
  /^(thanks|thank you|obrigado|gracias)( very much| so much| muito| mucho)?$/i,
  /^(you're|de) (welcome|nada)$/i,
  /^(no|sem|no hay|no te) (problem|worries|problema|problemas|preocupes)$/i,
  /^(my|meu|mi) (pleasure|prazer)$/i,
  /^(anytime|quando quiser|cuando quieras)$/i,
  /^(sure|claro)$/i,
  /^(of course|por supuesto)$/i,
  /^(certainly|certamente|ciertamente)$/i,
  /^(absolutely|absolutamente)$/i,
  /^(yes|yeah|yep|sim|sí)$/i,
  /^(no|nope|não)$/i,
  /^(maybe|perhaps|possibly|talvez|quizás|posiblemente)$/i,
  /^(okay|ok|alright|tudo bem|está bien)$/i,
  /^(fine|bem|bien)$/i,
  /^(great|good|nice|cool|ótimo|bom|legal|genial|bueno|bonito)$/i,
  /^(awesome|amazing|fantastic|wonderful|excellent|perfect|incrível|increíble|fantástico|maravilhoso|maravilloso|excelente|perfeito|perfecto)$/i,
  /^(sorry|excuse me|pardon|desculpe|com licença|perdão|lo siento|disculpe|perdón)$/i,
  /^(oops|ops|ups)$/i,
  /^(my|minha|mi) (bad|culpa)$/i,
  /^(I|eu|yo) (apologize|peço desculpas|me disculpo)$/i,
  /^(please|por favor)$/i,
  /^(kindly|gentilmente|amablemente)$/i,
  /^(could|would|can|você poderia|você pode|podrías|puedes) (you|você|tú) (help|assist|support|ajudar|assistir|suportar|ayudar|asistir|soportar)$/i,
  /^(I|eu|yo) (have|tenho|tengo) (a|um|una) (question|pergunta|pregunta)$/i,
  /^(I|eu|yo) (need|want|wish|hope|preciso|quero|desejo|espero|necesito|quiero|deseo|espero) (help|support|assistance|ajuda|suporte|assistência|ayuda|soporte|asistencia)$/i,
  /^(I|eu|yo) (like|love|hate|gostar|amar|odiar|gustar|amar|odiar) (this|that|it|isso|isto|eso)$/i,
  /^(I|eu|yo) (think|believe|feel|achar|acreditar|sentir|pensar|creer|sentir) (that|que) .+$/i,
  /^(I|eu|yo) (understand|know|entender|saber|entender|saber)$/i,
  /^(I|eu|yo) (don't|não|no) (understand|know|entender|saber|entender|saber)$/i,
  /^(I|eu|yo) (will|vou|voy) (try|attempt|tentar|intentar)$/i
];

const META_AI_PATTERNS = [
  /^(who|what|quem|o que|quién|qué) (are|is|é|es) (you|você|tú)$/i,
  /^(who|quem|quién) (made|created|built|developed|fez|criou|construiu|desenvolveu|hizo|creó|construyó|desarrolló) (you|você|tú)$/i,
  /^(what|qual|cuál) (is|are|é|são|es|son) (your|seu|tu) (name|nome|nombre)$/i,
  /^(are|is|é|es) (you|você|tú) (AI|a bot|human|real|a robot|chatgpt|gpt|IA|um bot|humano|real|um robô|chatgpt|gpt)$/i,
  /^(what|which|que|qual|qué|cuál) (model|version|modelo|versão|modelo|versión) (are|is|é|es) (you|você|tú)$/i,
  /^(how|como|cómo) (do|does|faz|hace) (you|você|tú) (work|function|operate|funciona|opera)$/i,
  /^(how|como|cómo) (were|was|foi|fue) (you|você|tú) (made|created|built|trained|feito|criado|construído|treinado|hecho|creado|construido|entrenado)$/i,
  /^(what|quais|cuáles) (can|could|may|might|pode|poderia|puedes|podrías) (you|você|tú) (do|fazer|hacer)$/i,
  /^(what|quais|cuáles) (are|is|é|são|es|son) (your|suas|tus) (capabilities|limitations|features|capacidades|limitações|recursos|capacidades|limitaciones|características)$/i,
  /^(can|could|may|might|do|does|pode|poderia|faz|puedes|podrías|hace) (you|você|tú) (learn|remember|think|feel|understand|speak|aprender|lembrar|pensar|sentir|entender|falar|aprender|recordar|pensar|sentir|entender|hablar)$/i,
  /^(do|does|faz|hace) (you|você|tú) (have|tem|tienes) (memory|feelings|emotions|consciousness|memória|sentimentos|emoções|consciência|memoria|sentimientos|emociones|consciencia)$/i,
  /^(are|is|é|es) (you|você|tú) (intelligent|smart|conscious|alive|inteligente|esperto|consciente|vivo|inteligente|listo|consciente|vivo)$/i,
  /^(what|which|que|qual|qué|cuál) (language|languages|idioma|idiomas) (can|do|does|pode|faz|puedes|hace) (you|você|tú) (speak|understand|know|falar|entender|saber|hablar|entender|saber)$/i,
  /^(how many|quantos|cuántos) (languages|idiomas) (can|do|does|pode|faz|puedes|hace) (you|você|tú) (speak|understand|know|falar|entender|saber|hablar|entender|saber)$/i,
  /^(who|what|quem|o que|quién|qué) (is|are|é|são|es|son) (your|seu|tu) (creator|developer|maker|company|owner|criador|desenvolvedor|criador|empresa|dono|creador|desarrollador|creador|empresa|dueño)$/i,
  /^(what|qual|cuál) (is|are|é|são|es|son) (your|seu|tu) (purpose|goal|function|role|job|task|propósito|meta|função|papel|trabalho|tarefa|propósito|meta|función|rol|trabajo|tarea)$/i,
  /^(tell|diga|dime) (me|para mim|para mi) (about|sobre|acerca de) (yourself|you|você|ti)$/i,
  /^(describe|descreva|describe) (yourself|you|você|ti)$/i,
  /^(introduce|apresente-se|preséntate) (yourself|você|ti)$/i
];

const OUT_OF_SCOPE_PATTERNS = [
  /^(how|como|cómo) (to|can I|do I|para|posso|eu|puedo|yo) (hack|crack|break into|bypass|exploit|hackear|crackear|invadir|burlar|explorar|hackear|crackear|invadir|eludir|explotar) .+/i,
  /^(how|como|cómo) (to|can I|do I|para|posso|eu|puedo|yo) (steal|rob|pirate|roubar|piratear|robar|piratear) .+/i,
  /^(how|como|cómo) (to|can I|do I|para|posso|eu|puedo|yo) (make|create|build|fazer|criar|construir|hacer|crear|construir) (a|um|una) (virus|malware|trojan|bomb|weapon|vírus|malware|trojan|bomba|arma|virus|malware|troyano|bomba|arma) .+/i,
  /^(how|como|cómo) (to|can I|do I|para|posso|eu|puedo|yo) (harm|hurt|kill|murder|prejudicar|machucar|matar|assassinar|dañar|lastimar|matar|asesinar) .+/i,
  /^(how|como|cómo) (to|can I|do I|para|posso|eu|puedo|yo) (commit|perform|do|cometer|realizar|fazer|cometer|realizar|hacer) (a|um|un) (crime|fraud|scam|theft|crime|fraude|golpe|roubo|crimen|fraude|estafa|robo) .+/i,
  /^(help|ajuda|ayuda) (me|para mim|para mi) (hack|crack|steal|rob|break into|hackear|crackear|roubar|invadir|hackear|crackear|robar|invadir) .+/i,
  /^(help|ajuda|ayuda) (me|para mim|para mi) (make|create|build|fazer|criar|construir|hacer|crear|construir) (a|um|una) (virus|malware|bomb|weapon|vírus|malware|bomba|arma|virus|malware|bomba|arma) .+/i,
  /^(show|mostre|muestra) (me|para mim|para mi) (how|como|cómo) (to|para) (hack|crack|steal|bypass|hackear|crackear|roubar|burlar|hackear|crackear|robar|eludir) .+/i,
  /^(I want to|eu quero|yo quiero) (hack|crack|steal|break into|bypass|hackear|crackear|roubar|invadir|burlar|hackear|crackear|robar|invadir|eludir) .+/i,
  /^(I want to|eu quero|yo quiero) (harm|hurt|kill|murder|prejudicar|machucar|matar|assassinar|dañar|lastimar|matar|asesinar) .+/i,
  /^(I want to|eu quero|yo quiero) (commit|do|perform|cometer|fazer|realizar|cometer|hacer|realizar) (a|um|un) (crime|fraud|scam|crime|fraude|golpe|crimen|fraude|estafa) .+/i,
  /^(teach|ensine|enseña) (me|para mim|para mi) (how|como|cómo) (to|para) (hack|crack|steal|hackear|crackear|roubar|hackear|crackear|robar) .+/i,
  /^(where|how|onde|como|dónde|cómo) (can I|posso|puedo) (buy|get|obtain|find|comprar|obter|encontrar|comprar|obtener|encontrar) (drugs|weapons|narcotics|drogas|armas|narcóticos|drogas|armas|narcóticos) .+/i,
  /^(where|how|onde|como|dónde|cómo) (can I|posso|puedo) (download|get|pirate|baixar|obter|piratear|descargar|obtener|piratear) (illegal|pirated|cracked|ilegal|pirata|crackeado|ilegal|pirata|crackeado) .+/i,
  /^(create|make|build|generate|crie|faça|construa|gere|crea|haz|construye|genera) (a|um|una) (virus|malware|trojan|bomb|weapon|fake|vírus|malware|trojan|bomba|arma|falso|virus|malware|troyano|bomba|arma|falso) .+/i,
  /^(generate|create|make|gere|crie|faça|genera|crea|haz) (fake|false|counterfeit|forged|falso|falsa|falsificado|falsificada|falso|falsa|falsificado|falsificada) .+/i
];

const AMBIGUOUS_PATTERNS = [
  /^(it|this|that|something|anything|isso|isto|aquilo|algo|qualquer coisa|eso|esto|algo|cualquier cosa)$/i,
  /^(do|help|check|look|see|find|get|make|create|show|tell|give|fazer|ajudar|verificar|olhar|ver|encontrar|obter|fazer|criar|mostrar|dizer|dar|hacer|ayudar|verificar|mirar|ver|encontrar|obtener|hacer|crear|mostrar|decir|dar) (it|this|that|something|isso|isto|aquilo|algo|eso|esto|algo)$/i,
  /^(what|which|how|why|when|where|who|o que|qual|como|por que|quando|onde|quem|qué|cuál|cómo|por qué|cuándo|dónde|quién)$/i,
  /^(can|could|would|will|pode|poderia|vai|puedes|podrías|vas a) (you|você|tú)$/i,
  /^(can|could|would|will|pode|poderia|vai|puedes|podrías|vas a) (you|você|tú) (help|ajudar|ayudar)$/i,
  /^(please|por favor)$/i,
  /^(just|only|simply|apenas|só|simplesmente|solo|simplemente) .{1,10}$/i,
  /^(quick|fast|rápido)$/i,
  /^(now|here|there|agora|aqui|lá|ahora|aquí|allí)$/i,
  /^(one|some|few|many|all|um|alguns|poucos|muitos|todos|uno|algunos|pocos|muchos|todos)$/i,
  /^(everything|nothing|none|tudo|nada|nenhum|todo|nada|ninguno)$/i,
  /^(more|less|other|another|different|same|mais|menos|outro|diferente|mesmo|más|menos|otro|diferente|mismo)$/i,
  /^(like|similar|about|regarding|concerning|como|similar|sobre|acerca de|como|similar|sobre|acerca de)$/i,
  /^(stuff|thing|things|coisas|coisa|cosas|cosa)$/i,
  /^(do|help|check|fazer|ajudar|verificar|hacer|ayudar|verificar)$/i,
  /^(what|how|o que|como|qué|cómo) (about|sobre|acerca de) (it|this|that|isso|isto|aquilo|eso|esto)$/i,
  /^.{1,5}$/i
];

// ============================================================================
// PATTERN CLASSIFICATION ENGINE
// ============================================================================

export class KodaPatternClassificationEngine {

  /**
   * Classify intent using pattern matching ONLY (no LLM)
   * Returns null if no confident pattern match found
   */
  public classifyByPatterns(
    query: string,
    conversationContext?: any
  ): IntentClassification | null {

    const startTime = Date.now();
    const normalized = normalizeQuery(query);

    // Try each intent category in priority order

    // 1. OUT_OF_SCOPE (highest priority for safety)
    if (this.matchesOutOfScope(normalized)) {
      return this.buildClassification(
        PrimaryIntent.OUT_OF_SCOPE,
        1.0,
        true,
        ['OUT_OF_SCOPE patterns'],
        this.getMatchedKeywords(normalized, OUT_OF_SCOPE_KEYWORDS),
        startTime
      );
    }

    // 2. CHITCHAT (greetings have high priority)
    if (this.matchesChitchat(normalized)) {
      return this.buildClassification(
        PrimaryIntent.CHITCHAT,
        0.95,
        true,
        ['CHITCHAT patterns'],
        this.getMatchedKeywords(normalized, CHITCHAT_KEYWORDS),
        startTime
      );
    }

    // 3. META_AI (questions about the AI)
    if (this.matchesMetaAI(normalized)) {
      return this.buildClassification(
        PrimaryIntent.META_AI,
        0.9,
        true,
        ['META_AI patterns'],
        this.getMatchedKeywords(normalized, META_AI_KEYWORDS),
        startTime
      );
    }

    // 4. FEEDBACK_POSITIVE
    if (this.matchesFeedbackPositive(normalized)) {
      return this.buildClassification(
        PrimaryIntent.FEEDBACK_POSITIVE,
        0.9,
        true,
        ['FEEDBACK_POSITIVE patterns'],
        this.getMatchedKeywords(normalized, FEEDBACK_POSITIVE_KEYWORDS),
        startTime
      );
    }

    // 5. FEEDBACK_NEGATIVE
    if (this.matchesFeedbackNegative(normalized)) {
      return this.buildClassification(
        PrimaryIntent.FEEDBACK_NEGATIVE,
        0.9,
        true,
        ['FEEDBACK_NEGATIVE patterns'],
        this.getMatchedKeywords(normalized, FEEDBACK_NEGATIVE_KEYWORDS),
        startTime
      );
    }

    // 6. PRODUCT_HELP (how to use Koda)
    if (this.matchesProductHelp(normalized)) {
      return this.buildClassification(
        PrimaryIntent.PRODUCT_HELP,
        0.9,
        true,
        ['PRODUCT_HELP patterns'],
        this.getMatchedKeywords(normalized, PRODUCT_HELP_KEYWORDS),
        startTime
      );
    }

    // 7. ONBOARDING_HELP (getting started)
    if (this.matchesOnboardingHelp(normalized)) {
      return this.buildClassification(
        PrimaryIntent.ONBOARDING_HELP,
        0.9,
        true,
        ['ONBOARDING_HELP patterns'],
        this.getMatchedKeywords(normalized, ONBOARDING_HELP_KEYWORDS),
        startTime
      );
    }

    // 8. DOC_ANALYTICS (counts and lists)
    if (this.matchesDocAnalytics(normalized)) {
      return this.buildClassification(
        PrimaryIntent.DOC_ANALYTICS,
        0.9,
        true,
        ['DOC_ANALYTICS patterns'],
        this.getMatchedKeywords(normalized, DOC_ANALYTICS_KEYWORDS),
        startTime
      );
    }

    // 9. DOC_MANAGEMENT (document actions)
    if (this.matchesDocManagement(normalized)) {
      return this.buildClassification(
        PrimaryIntent.DOC_MANAGEMENT,
        0.85,
        true,
        ['DOC_MANAGEMENT patterns'],
        this.getMatchedKeywords(normalized, DOC_MANAGEMENT_KEYWORDS),
        startTime
      );
    }

    // 10. PREFERENCE_UPDATE
    if (this.matchesPreferenceUpdate(normalized)) {
      return this.buildClassification(
        PrimaryIntent.PREFERENCE_UPDATE,
        0.85,
        true,
        ['PREFERENCE_UPDATE patterns'],
        this.getMatchedKeywords(normalized, PREFERENCE_UPDATE_KEYWORDS),
        startTime
      );
    }

    // 11. ANSWER_REWRITE
    if (this.matchesAnswerRewrite(normalized)) {
      return this.buildClassification(
        PrimaryIntent.ANSWER_REWRITE,
        0.85,
        true,
        ['ANSWER_REWRITE patterns'],
        this.getMatchedKeywords(normalized, ANSWER_REWRITE_KEYWORDS),
        startTime
      );
    }

    // 12. TEXT_TRANSFORM
    if (this.matchesTextTransform(normalized)) {
      return this.buildClassification(
        PrimaryIntent.TEXT_TRANSFORM,
        0.8,
        true,
        ['TEXT_TRANSFORM patterns'],
        this.getMatchedKeywords(normalized, TEXT_TRANSFORM_KEYWORDS),
        startTime
      );
    }

    // 13. REASONING_TASK
    if (this.matchesReasoningTask(normalized)) {
      return this.buildClassification(
        PrimaryIntent.REASONING_TASK,
        0.8,
        true,
        ['REASONING_TASK patterns'],
        this.getMatchedKeywords(normalized, REASONING_TASK_KEYWORDS),
        startTime
      );
    }

    // 14. GENERIC_KNOWLEDGE (world facts - check before DOC_QA)
    if (this.matchesGenericKnowledge(normalized)) {
      return this.buildClassification(
        PrimaryIntent.GENERIC_KNOWLEDGE,
        0.75,
        true,
        ['GENERIC_KNOWLEDGE patterns'],
        this.getMatchedKeywords(normalized, GENERIC_KNOWLEDGE_KEYWORDS),
        startTime
      );
    }

    // 15. DOC_QA (default for document questions)
    if (this.matchesDocQA(normalized)) {
      return this.buildClassification(
        PrimaryIntent.DOC_QA,
        0.7,
        true,
        ['DOC_QA patterns'],
        this.getMatchedKeywords(normalized, DOC_QA_KEYWORDS),
        startTime
      );
    }

    // 16. AMBIGUOUS (too short or vague)
    if (this.matchesAmbiguous(normalized)) {
      return this.buildClassification(
        PrimaryIntent.AMBIGUOUS,
        0.9,
        true,
        ['AMBIGUOUS patterns'],
        this.getMatchedKeywords(normalized, AMBIGUOUS_KEYWORDS),
        startTime
      );
    }

    // No pattern matched - return null to trigger LLM classification
    return null;
  }

  // ============================================================================
  // HELPER: Get matched keywords
  // ============================================================================

  private getMatchedKeywords(query: string, keywords: string[]): string[] {
    const normalized = normalizeQuery(query);
    return keywords.filter(keyword => {
      if (keyword.includes(' ')) {
        return normalized.includes(keyword.toLowerCase());
      }
      const pattern = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return pattern.test(normalized);
    }).slice(0, 10); // Return max 10 matched keywords
  }

  // ============================================================================
  // PATTERN MATCHING METHODS
  // ============================================================================

  private matchesOutOfScope(query: string): boolean {
    return containsKeywords(query, OUT_OF_SCOPE_KEYWORDS) ||
           matchesPatterns(query, OUT_OF_SCOPE_PATTERNS) !== null;
  }

  private matchesChitchat(query: string): boolean {
    // Short greetings need exact match
    if (query.length < 15) {
      return containsKeywords(query, CHITCHAT_KEYWORDS) ||
             matchesPatterns(query, CHITCHAT_PATTERNS) !== null;
    }
    return matchesPatterns(query, CHITCHAT_PATTERNS) !== null;
  }

  private matchesMetaAI(query: string): boolean {
    return containsKeywords(query, META_AI_KEYWORDS) ||
           matchesPatterns(query, META_AI_PATTERNS) !== null;
  }

  private matchesFeedbackPositive(query: string): boolean {
    return containsKeywords(query, FEEDBACK_POSITIVE_KEYWORDS) ||
           (FEEDBACK_POSITIVE_PATTERNS.length > 0 && matchesPatterns(query, FEEDBACK_POSITIVE_PATTERNS) !== null);
  }

  private matchesFeedbackNegative(query: string): boolean {
    return containsKeywords(query, FEEDBACK_NEGATIVE_KEYWORDS) ||
           (FEEDBACK_NEGATIVE_PATTERNS.length > 0 && matchesPatterns(query, FEEDBACK_NEGATIVE_PATTERNS) !== null);
  }

  private matchesProductHelp(query: string): boolean {
    return containsKeywords(query, PRODUCT_HELP_KEYWORDS) ||
           matchesPatterns(query, PRODUCT_HELP_PATTERNS) !== null;
  }

  private matchesOnboardingHelp(query: string): boolean {
    return containsKeywords(query, ONBOARDING_HELP_KEYWORDS) ||
           (ONBOARDING_HELP_PATTERNS.length > 0 && matchesPatterns(query, ONBOARDING_HELP_PATTERNS) !== null);
  }

  private matchesDocAnalytics(query: string): boolean {
    return containsKeywords(query, DOC_ANALYTICS_KEYWORDS) ||
           matchesPatterns(query, DOC_ANALYTICS_PATTERNS) !== null;
  }

  private matchesDocManagement(query: string): boolean {
    return containsKeywords(query, DOC_MANAGEMENT_KEYWORDS) ||
           matchesPatterns(query, DOC_MANAGEMENT_PATTERNS) !== null;
  }

  private matchesPreferenceUpdate(query: string): boolean {
    return containsKeywords(query, PREFERENCE_UPDATE_KEYWORDS) ||
           matchesPatterns(query, PREFERENCE_UPDATE_PATTERNS) !== null;
  }

  private matchesAnswerRewrite(query: string): boolean {
    return containsKeywords(query, ANSWER_REWRITE_KEYWORDS) ||
           matchesPatterns(query, ANSWER_REWRITE_PATTERNS) !== null;
  }

  private matchesTextTransform(query: string): boolean {
    return containsKeywords(query, TEXT_TRANSFORM_KEYWORDS) ||
           matchesPatterns(query, TEXT_TRANSFORM_PATTERNS) !== null;
  }

  private matchesReasoningTask(query: string): boolean {
    return containsKeywords(query, REASONING_TASK_KEYWORDS) ||
           matchesPatterns(query, REASONING_TASK_PATTERNS) !== null;
  }

  private matchesGenericKnowledge(query: string): boolean {
    // Generic knowledge needs stronger signals - check for "who is" patterns without doc context
    const hasDocContext = /document|arquivo|archivo|file|pdf|my files|meus arquivos|mis archivos/i.test(query);
    if (hasDocContext) return false;

    return containsKeywords(query, GENERIC_KNOWLEDGE_KEYWORDS) ||
           matchesPatterns(query, GENERIC_KNOWLEDGE_PATTERNS) !== null;
  }

  private matchesDocQA(query: string): boolean {
    return containsKeywords(query, DOC_QA_KEYWORDS) ||
           matchesPatterns(query, DOC_QA_PATTERNS) !== null;
  }

  private matchesAmbiguous(query: string): boolean {
    return query.length < 6 ||
           (containsKeywords(query, AMBIGUOUS_KEYWORDS) && query.length < 20);
  }

  // ============================================================================
  // CLASSIFICATION BUILDER
  // ============================================================================

  private buildClassification(
    intent: PrimaryIntent,
    confidence: number,
    wasClassifiedByRules: boolean,
    matchedPatterns: string[],
    matchedKeywords: string[],
    startTime: number
  ): IntentClassification {

    const requiresRAG = INTENT_REQUIRES_RAG[intent];
    const requiresLLM = INTENT_REQUIRES_LLM[intent];
    const knowledgeSource = INTENT_KNOWLEDGE_SOURCE[intent];

    return {
      primaryIntent: intent,
      confidence,
      wasClassifiedByRules,
      requiresLLMIntent: false,  // Pattern matched, no LLM needed for intent
      requiresRAG,
      requiresLLM,
      knowledgeSource,
      ragMode: requiresRAG ? RAGMode.FULL_RAG : RAGMode.NO_RAG,
      targetDocumentScope: TargetDocumentScope.ALL_DOCUMENTS,
      answerStyle: this.determineAnswerStyle(intent),
      reasoningFlags: this.determineReasoningFlags(intent),
      entities: {
        keywords: matchedKeywords
      },
      matchedPatterns,
      matchedKeywords,
      classificationTimeMs: Date.now() - startTime
    };
  }

  private determineAnswerStyle(intent: PrimaryIntent): AnswerStyle {
    switch (intent) {
      case PrimaryIntent.DOC_QA:
        return AnswerStyle.FACTUAL_SHORT;
      case PrimaryIntent.DOC_ANALYTICS:
        return AnswerStyle.STRUCTURED_LIST;
      case PrimaryIntent.PRODUCT_HELP:
      case PrimaryIntent.ONBOARDING_HELP:
        return AnswerStyle.INSTRUCTIONAL_STEPS;
      case PrimaryIntent.CHITCHAT:
        return AnswerStyle.DIALOGUE_CHITCHAT;
      default:
        return AnswerStyle.EXPLANATORY_PARAGRAPH;
    }
  }

  private determineReasoningFlags(intent: PrimaryIntent): ReasoningFlags {
    return {
      requiresNumericReasoning: intent === PrimaryIntent.REASONING_TASK || intent === PrimaryIntent.DOC_ANALYTICS,
      requiresComparison: false,
      requiresTimeline: false,
      requiresExtraction: intent === PrimaryIntent.DOC_QA,
      requiresMemoryWrite: intent === PrimaryIntent.PREFERENCE_UPDATE
    };
  }
}

// Export singleton instance
export const kodaPatternEngine = new KodaPatternClassificationEngine();
