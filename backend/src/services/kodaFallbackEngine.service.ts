/**
 * ============================================================================
 * KODA FALLBACK ENGINE SERVICE - LAYER 2B (V3 Enhanced)
 * ============================================================================
 *
 * PURPOSE: Template-based fallback answers (NOT LLM-generated)
 *
 * STYLE SYSTEM:
 * - one_liner: Short, concise (max 140 chars)
 * - short_guidance: Medium with actions (max 350-400 chars)
 * - detailed_help: Full with examples (max 500-600 chars)
 *
 * FEATURES:
 * - Multilingual (en, pt, es)
 * - Multiple style options per fallback
 * - Placeholder support ({{documentName}}, {{topic}}, etc.)
 * - Template-based (fast, consistent)
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type FallbackKey =
  | 'NO_DOCUMENTS'
  | 'DOC_NOT_FOUND'
  | 'DOC_NOT_PROCESSED_YET'
  | 'INFO_NOT_FOUND_IN_DOCS'
  | 'QUERY_TOO_VAGUE'
  | 'OUT_OF_SCOPE'
  | 'TOOL_ERROR'
  | 'TIMEOUT'
  | 'FILE_TYPE_NOT_SUPPORTED'
  | 'CONTEXT_TOO_LARGE'
  | 'SAFETY_BLOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'EMPTY_DOCUMENT'
  | 'MULTIPLE_DOCUMENTS_FOUND';

export type FallbackStyle = 'one_liner' | 'short_guidance' | 'detailed_help';

export interface FallbackContext {
  documentName?: string;
  topic?: string;
  fileType?: string;
  count?: number;
  query?: string;
  documentList?: string;
  [key: string]: any;
}

export interface FallbackOptions {
  fallbackKey: FallbackKey;
  language: string;
  style?: FallbackStyle;
  context?: FallbackContext;
}

interface LanguageTemplate {
  template: string;
  placeholders: string[];
}

interface StyleDefinition {
  id: FallbackStyle;
  maxLength: number;
  languages: {
    en: LanguageTemplate;
    pt: LanguageTemplate;
    es: LanguageTemplate;
  };
}

interface FallbackDefinition {
  key: FallbackKey;
  defaultStyleId: FallbackStyle;
  styles: StyleDefinition[];
}

// ============================================================================
// FALLBACK TEMPLATES
// ============================================================================

const FALLBACK_TEMPLATES: Record<FallbackKey, FallbackDefinition> = {
  NO_DOCUMENTS: {
    key: 'NO_DOCUMENTS',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "Your workspace is empty. Upload documents in **Knowledge** to get started!",
            placeholders: []
          },
          pt: {
            template: "Seu workspace está vazio. Envie documentos em **Conhecimento** para começar!",
            placeholders: []
          },
          es: {
            template: "Tu espacio de trabajo está vacío. ¡Sube documentos en **Conocimiento** para comenzar!",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 350,
        languages: {
          en: {
            template: "I couldn't find any documents in your workspace yet.\n\nTo get started, upload your files in the **Knowledge** area, and then you can ask me questions about them.\n\nFor example: *\"After uploading my contracts, tell me which one has an annual rent adjustment clause.\"*",
            placeholders: []
          },
          pt: {
            template: "Ainda não encontrei nenhum documento no seu workspace.\n\nPara começar, envie seus arquivos na aba **Conhecimento** e depois pode fazer perguntas sobre eles.\n\nPor exemplo: *\"Depois de enviar meus contratos, me diga qual tem cláusula de reajuste anual.\"*",
            placeholders: []
          },
          es: {
            template: "No pude encontrar ningún documento en tu espacio de trabajo aún.\n\nPara comenzar, sube tus archivos en el área de **Conocimiento**, y luego podrás hacerme preguntas sobre ellos.\n\nPor ejemplo: *\"Después de subir mis contratos, dime cuál tiene una cláusula de ajuste de renta anual.\"*",
            placeholders: []
          }
        }
      },
      {
        id: 'detailed_help',
        maxLength: 600,
        languages: {
          en: {
            template: "Welcome! Your workspace is empty right now, but I'm ready to help you get started.\n\n**Here's how to begin:**\n\n1. Upload your documents in the Knowledge area\n2. Wait for processing (usually 2-4 seconds per document)\n3. Ask me anything about your documents\n\n**I can help you:**\n- Find specific information across all documents\n- Summarize long documents\n- Compare multiple files\n\n**Example questions:**\n- *\"Which contract has the highest value?\"*\n- *\"Summarize the key points from my meeting notes\"*\n- *\"What are the deadlines mentioned in my project files?\"*",
            placeholders: []
          },
          pt: {
            template: "Bem-vindo! Seu workspace está vazio agora, mas estou pronto para ajudá-lo a começar.\n\n**Veja como começar:**\n\n1. Envie seus documentos na área de Conhecimento\n2. Aguarde o processamento (geralmente 2-4 segundos por documento)\n3. Pergunte-me qualquer coisa sobre seus documentos\n\n**Posso ajudá-lo a:**\n- Encontrar informações específicas em todos os documentos\n- Resumir documentos longos\n- Comparar vários arquivos\n\n**Exemplos de perguntas:**\n- *\"Qual contrato tem o maior valor?\"*\n- *\"Resuma os pontos-chave das minhas notas de reunião\"*\n- *\"Quais são os prazos mencionados nos meus arquivos de projeto?\"*",
            placeholders: []
          },
          es: {
            template: "¡Bienvenido! Tu espacio de trabajo está vacío ahora, pero estoy listo para ayudarte a comenzar.\n\n**Así es como empezar:**\n\n1. Sube tus documentos en el área de Conocimiento\n2. Espera el procesamiento (generalmente 2-4 segundos por documento)\n3. Pregúntame lo que quieras sobre tus documentos\n\n**Puedo ayudarte a:**\n- Encontrar información específica en todos los documentos\n- Resumir documentos largos\n- Comparar varios archivos\n\n**Ejemplos de preguntas:**\n- *\"¿Qué contrato tiene el valor más alto?\"*\n- *\"Resume los puntos clave de mis notas de reunión\"*\n- *\"¿Cuáles son los plazos mencionados en mis archivos de proyecto?\"*",
            placeholders: []
          }
        }
      }
    ]
  },

  DOC_NOT_FOUND: {
    key: 'DOC_NOT_FOUND',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "I couldn't find **{{documentName}}** in your workspace. Check the filename or upload it first.",
            placeholders: ['documentName']
          },
          pt: {
            template: "Não encontrei **{{documentName}}** no seu workspace. Verifique o nome ou envie-o primeiro.",
            placeholders: ['documentName']
          },
          es: {
            template: "No pude encontrar **{{documentName}}** en tu espacio de trabajo. Verifica el nombre o súbelo primero.",
            placeholders: ['documentName']
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "I couldn't find a document named **{{documentName}}** in your workspace.\n\n**This could mean:**\n- The document hasn't been uploaded yet\n- The filename might be slightly different\n- The document is still being processed\n\n**Try:**\n- Check the exact filename in your Knowledge area\n- Ask *\"What documents do I have?\"* to see all available files\n- Upload the document if it's missing",
            placeholders: ['documentName']
          },
          pt: {
            template: "Não encontrei um documento chamado **{{documentName}}** no seu workspace.\n\n**Isso pode significar:**\n- O documento ainda não foi enviado\n- O nome do arquivo pode ser ligeiramente diferente\n- O documento ainda está sendo processado\n\n**Tente:**\n- Verificar o nome exato do arquivo na área de Conhecimento\n- Perguntar *\"Quais documentos eu tenho?\"* para ver todos os arquivos disponíveis\n- Enviar o documento se estiver faltando",
            placeholders: ['documentName']
          },
          es: {
            template: "No pude encontrar un documento llamado **{{documentName}}** en tu espacio de trabajo.\n\n**Esto podría significar:**\n- El documento aún no ha sido subido\n- El nombre del archivo podría ser ligeramente diferente\n- El documento todavía se está procesando\n\n**Intenta:**\n- Verificar el nombre exacto del archivo en tu área de Conocimiento\n- Preguntar *\"¿Qué documentos tengo?\"* para ver todos los archivos disponibles\n- Subir el documento si falta",
            placeholders: ['documentName']
          }
        }
      }
    ]
  },

  DOC_NOT_PROCESSED_YET: {
    key: 'DOC_NOT_PROCESSED_YET',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "Your documents are still processing (2-4 seconds each). Please wait a moment and try again.",
            placeholders: []
          },
          pt: {
            template: "Seus documentos ainda estão sendo processados (2-4 segundos cada). Aguarde um momento e tente novamente.",
            placeholders: []
          },
          es: {
            template: "Tus documentos aún se están procesando (2-4 segundos cada uno). Espera un momento e intenta de nuevo.",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 350,
        languages: {
          en: {
            template: "Your documents are currently being processed. This usually takes 2-4 seconds per document.\n\n**What's happening:**\n- Extracting text from your files\n- Creating searchable embeddings\n- Indexing content for fast retrieval\n\n**Please wait a moment and try again.** You'll be able to ask questions as soon as processing completes.",
            placeholders: []
          },
          pt: {
            template: "Seus documentos estão sendo processados no momento. Isso geralmente leva 2-4 segundos por documento.\n\n**O que está acontecendo:**\n- Extraindo texto dos seus arquivos\n- Criando embeddings pesquisáveis\n- Indexando conteúdo para recuperação rápida\n\n**Por favor, aguarde um momento e tente novamente.** Você poderá fazer perguntas assim que o processamento for concluído.",
            placeholders: []
          },
          es: {
            template: "Tus documentos se están procesando actualmente. Esto generalmente toma 2-4 segundos por documento.\n\n**Lo que está sucediendo:**\n- Extrayendo texto de tus archivos\n- Creando embeddings buscables\n- Indexando contenido para recuperación rápida\n\n**Por favor, espera un momento e intenta de nuevo.** Podrás hacer preguntas tan pronto como se complete el procesamiento.",
            placeholders: []
          }
        }
      }
    ]
  },

  INFO_NOT_FOUND_IN_DOCS: {
    key: 'INFO_NOT_FOUND_IN_DOCS',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "I couldn't find information about **{{topic}}** in your documents. Try rephrasing or check if the right files are uploaded.",
            placeholders: ['topic']
          },
          pt: {
            template: "Não encontrei informações sobre **{{topic}}** nos seus documentos. Tente reformular ou verificar se os arquivos certos foram enviados.",
            placeholders: ['topic']
          },
          es: {
            template: "No pude encontrar información sobre **{{topic}}** en tus documentos. Intenta reformular o verifica si los archivos correctos están subidos.",
            placeholders: ['topic']
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "I searched through your documents but couldn't find information about **{{topic}}**.\n\n**This could mean:**\n- The information isn't in your uploaded documents\n- The topic might be phrased differently in your files\n\n**Try:**\n- Rephrasing your question with different keywords\n- Asking about related topics\n- Checking if the relevant documents are uploaded",
            placeholders: ['topic']
          },
          pt: {
            template: "Pesquisei seus documentos mas não encontrei informações sobre **{{topic}}**.\n\n**Isso pode significar:**\n- A informação não está nos seus documentos enviados\n- O tópico pode estar formulado de forma diferente nos seus arquivos\n\n**Tente:**\n- Reformular sua pergunta com palavras-chave diferentes\n- Perguntar sobre tópicos relacionados\n- Verificar se os documentos relevantes foram enviados",
            placeholders: ['topic']
          },
          es: {
            template: "Busqué en tus documentos pero no pude encontrar información sobre **{{topic}}**.\n\n**Esto podría significar:**\n- La información no está en tus documentos subidos\n- El tema podría estar formulado de manera diferente en tus archivos\n\n**Intenta:**\n- Reformular tu pregunta con diferentes palabras clave\n- Preguntar sobre temas relacionados\n- Verificar si los documentos relevantes están subidos",
            placeholders: ['topic']
          }
        }
      }
    ]
  },

  QUERY_TOO_VAGUE: {
    key: 'QUERY_TOO_VAGUE',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "Could you be more specific? Which document or topic are you asking about?",
            placeholders: []
          },
          pt: {
            template: "Você poderia ser mais específico? Sobre qual documento ou tópico você está perguntando?",
            placeholders: []
          },
          es: {
            template: "¿Podrías ser más específico? ¿Sobre qué documento o tema estás preguntando?",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "I'd be happy to help, but I need a bit more information to give you an accurate answer.\n\n**Could you please clarify:**\n- Which specific document(s) are you asking about?\n- What particular aspect or information are you looking for?\n\n**For example, instead of:**\n*\"Tell me about the contract\"*\n\n**Try:**\n*\"What is the termination clause in the Smith Services contract?\"*",
            placeholders: []
          },
          pt: {
            template: "Ficaria feliz em ajudar, mas preciso de um pouco mais de informações para dar uma resposta precisa.\n\n**Você poderia esclarecer:**\n- Sobre qual(is) documento(s) específico(s) você está perguntando?\n- Que aspecto ou informação particular você está procurando?\n\n**Por exemplo, em vez de:**\n*\"Me fale sobre o contrato\"*\n\n**Tente:**\n*\"Qual é a cláusula de rescisão no contrato da Smith Services?\"*",
            placeholders: []
          },
          es: {
            template: "Estaría encantado de ayudar, pero necesito un poco más de información para darte una respuesta precisa.\n\n**¿Podrías aclarar:**\n- ¿Sobre qué documento(s) específico(s) estás preguntando?\n- ¿Qué aspecto o información particular estás buscando?\n\n**Por ejemplo, en lugar de:**\n*\"Cuéntame sobre el contrato\"*\n\n**Intenta:**\n*\"¿Cuál es la cláusula de terminación en el contrato de Smith Services?\"*",
            placeholders: []
          }
        }
      }
    ]
  },

  OUT_OF_SCOPE: {
    key: 'OUT_OF_SCOPE',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "I'm designed to help with document-related tasks. Is there anything about your documents I can help you with?",
            placeholders: []
          },
          pt: {
            template: "Sou projetado para ajudar com tarefas relacionadas a documentos. Há algo sobre seus documentos com que eu possa ajudá-lo?",
            placeholders: []
          },
          es: {
            template: "Estoy diseñado para ayudar con tareas relacionadas con documentos. ¿Hay algo sobre tus documentos en lo que pueda ayudarte?",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 300,
        languages: {
          en: {
            template: "I appreciate your question, but I'm specifically designed to help with document-related tasks.\n\nI work best when answering questions about your uploaded files, summarizing content, finding specific information, or analyzing documents.\n\nIs there anything about your documents I can help you with?",
            placeholders: []
          },
          pt: {
            template: "Agradeço sua pergunta, mas sou especificamente projetado para ajudar com tarefas relacionadas a documentos.\n\nFunciono melhor quando respondo perguntas sobre seus arquivos enviados, resumo conteúdo, encontro informações específicas ou analiso documentos.\n\nHá algo sobre seus documentos com que eu possa ajudá-lo?",
            placeholders: []
          },
          es: {
            template: "Aprecio tu pregunta, pero estoy específicamente diseñado para ayudar con tareas relacionadas con documentos.\n\nFunciono mejor cuando respondo preguntas sobre tus archivos subidos, resumo contenido, encuentro información específica o analizo documentos.\n\n¿Hay algo sobre tus documentos en lo que pueda ayudarte?",
            placeholders: []
          }
        }
      }
    ]
  },

  TOOL_ERROR: {
    key: 'TOOL_ERROR',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "I encountered a technical issue. Please try again or rephrase your question.",
            placeholders: []
          },
          pt: {
            template: "Encontrei um problema técnico. Por favor, tente novamente ou reformule sua pergunta.",
            placeholders: []
          },
          es: {
            template: "Encontré un problema técnico. Por favor, intenta de nuevo o reformula tu pregunta.",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "I apologize, but I encountered a technical issue while processing your request.\n\n**What you can do:**\n- Try again in a moment\n- Rephrase your question\n- Contact support if the issue persists\n\n**Error details have been logged** for our technical team to investigate.",
            placeholders: []
          },
          pt: {
            template: "Peço desculpas, mas encontrei um problema técnico ao processar sua solicitação.\n\n**O que você pode fazer:**\n- Tente novamente em um momento\n- Reformule sua pergunta\n- Entre em contato com o suporte se o problema persistir\n\n**Os detalhes do erro foram registrados** para nossa equipe técnica investigar.",
            placeholders: []
          },
          es: {
            template: "Me disculpo, pero encontré un problema técnico al procesar tu solicitud.\n\n**Lo que puedes hacer:**\n- Intenta de nuevo en un momento\n- Reformula tu pregunta\n- Contacta con soporte si el problema persiste\n\n**Los detalles del error han sido registrados** para que nuestro equipo técnico investigue.",
            placeholders: []
          }
        }
      }
    ]
  },

  TIMEOUT: {
    key: 'TIMEOUT',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "Your request took too long. Try asking about fewer documents or a more specific topic.",
            placeholders: []
          },
          pt: {
            template: "Sua solicitação demorou muito. Tente perguntar sobre menos documentos ou um tópico mais específico.",
            placeholders: []
          },
          es: {
            template: "Tu solicitud tardó demasiado. Intenta preguntar sobre menos documentos o un tema más específico.",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 350,
        languages: {
          en: {
            template: "Your request took too long to process and timed out.\n\n**This can happen when:**\n- Searching through many large documents\n- The query is very broad\n\n**Try:**\n- Ask about specific documents instead of all files\n- Be more specific about what you're looking for\n- Break complex questions into smaller parts",
            placeholders: []
          },
          pt: {
            template: "Sua solicitação demorou muito para processar e expirou.\n\n**Isso pode acontecer quando:**\n- Pesquisando muitos documentos grandes\n- A consulta é muito ampla\n\n**Tente:**\n- Perguntar sobre documentos específicos em vez de todos os arquivos\n- Ser mais específico sobre o que você está procurando\n- Dividir perguntas complexas em partes menores",
            placeholders: []
          },
          es: {
            template: "Tu solicitud tardó demasiado en procesarse y se agotó el tiempo.\n\n**Esto puede suceder cuando:**\n- Se buscan muchos documentos grandes\n- La consulta es muy amplia\n\n**Intenta:**\n- Preguntar sobre documentos específicos en lugar de todos los archivos\n- Ser más específico sobre lo que estás buscando\n- Dividir preguntas complejas en partes más pequeñas",
            placeholders: []
          }
        }
      }
    ]
  },

  FILE_TYPE_NOT_SUPPORTED: {
    key: 'FILE_TYPE_NOT_SUPPORTED',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "**{{fileType}}** files aren't supported. Try PDF, Word, Excel, or PowerPoint instead.",
            placeholders: ['fileType']
          },
          pt: {
            template: "Arquivos **{{fileType}}** não são suportados. Tente PDF, Word, Excel ou PowerPoint.",
            placeholders: ['fileType']
          },
          es: {
            template: "Los archivos **{{fileType}}** no son compatibles. Intenta con PDF, Word, Excel o PowerPoint.",
            placeholders: ['fileType']
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "I can't process **{{fileType}}** files directly.\n\n**Supported formats:**\n- PDF (.pdf)\n- Microsoft Word (.doc, .docx)\n- PowerPoint (.ppt, .pptx)\n- Excel (.xls, .xlsx)\n- Plain text (.txt)\n\n**Try:**\n- Convert your file to a supported format\n- Export as PDF (works for most applications)",
            placeholders: ['fileType']
          },
          pt: {
            template: "Não posso processar arquivos **{{fileType}}** diretamente.\n\n**Formatos suportados:**\n- PDF (.pdf)\n- Microsoft Word (.doc, .docx)\n- PowerPoint (.ppt, .pptx)\n- Excel (.xls, .xlsx)\n- Texto simples (.txt)\n\n**Tente:**\n- Converter seu arquivo para um formato suportado\n- Exportar como PDF (funciona para a maioria dos aplicativos)",
            placeholders: ['fileType']
          },
          es: {
            template: "No puedo procesar archivos **{{fileType}}** directamente.\n\n**Formatos compatibles:**\n- PDF (.pdf)\n- Microsoft Word (.doc, .docx)\n- PowerPoint (.ppt, .pptx)\n- Excel (.xls, .xlsx)\n- Texto plano (.txt)\n\n**Intenta:**\n- Convertir tu archivo a un formato compatible\n- Exportar como PDF (funciona para la mayoría de las aplicaciones)",
            placeholders: ['fileType']
          }
        }
      }
    ]
  },

  CONTEXT_TOO_LARGE: {
    key: 'CONTEXT_TOO_LARGE',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "This document is too large. Try asking about specific sections or split it into smaller files.",
            placeholders: []
          },
          pt: {
            template: "Este documento é muito grande. Tente perguntar sobre seções específicas ou dividi-lo em arquivos menores.",
            placeholders: []
          },
          es: {
            template: "Este documento es demasiado grande. Intenta preguntar sobre secciones específicas o dividirlo en archivos más pequeños.",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "This document is quite large and exceeds processing limits.\n\n**Current limits:**\n- Maximum file size: 50 MB\n- Maximum pages: 500 pages\n\n**Solutions:**\n- Split the document into smaller sections\n- Ask about specific sections or pages\n- Upload only the parts you need to analyze",
            placeholders: []
          },
          pt: {
            template: "Este documento é bastante grande e excede os limites de processamento.\n\n**Limites atuais:**\n- Tamanho máximo do arquivo: 50 MB\n- Páginas máximas: 500 páginas\n\n**Soluções:**\n- Dividir o documento em seções menores\n- Perguntar sobre seções ou páginas específicas\n- Enviar apenas as partes que você precisa analisar",
            placeholders: []
          },
          es: {
            template: "Este documento es bastante grande y excede los límites de procesamiento.\n\n**Límites actuales:**\n- Tamaño máximo de archivo: 50 MB\n- Páginas máximas: 500 páginas\n\n**Soluciones:**\n- Dividir el documento en secciones más pequeñas\n- Preguntar sobre secciones o páginas específicas\n- Subir solo las partes que necesitas analizar",
            placeholders: []
          }
        }
      }
    ]
  },

  SAFETY_BLOCKED: {
    key: 'SAFETY_BLOCKED',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "I can't process this request as it may violate content policies. Please rephrase or ask something else.",
            placeholders: []
          },
          pt: {
            template: "Não posso processar esta solicitação pois pode violar políticas de conteúdo. Por favor, reformule ou pergunte outra coisa.",
            placeholders: []
          },
          es: {
            template: "No puedo procesar esta solicitud ya que puede violar las políticas de contenido. Por favor, reformula o pregunta otra cosa.",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 300,
        languages: {
          en: {
            template: "I can't process this request as it may violate content policies.\n\n**This can happen when:**\n- Content contains sensitive or inappropriate material\n- The request involves prohibited use cases\n\n**Please:**\n- Rephrase your question\n- Ask about different content\n- Contact support if you believe this is an error",
            placeholders: []
          },
          pt: {
            template: "Não posso processar esta solicitação pois pode violar políticas de conteúdo.\n\n**Isso pode acontecer quando:**\n- O conteúdo contém material sensível ou inadequado\n- A solicitação envolve casos de uso proibidos\n\n**Por favor:**\n- Reformule sua pergunta\n- Pergunte sobre conteúdo diferente\n- Entre em contato com o suporte se acreditar que isso é um erro",
            placeholders: []
          },
          es: {
            template: "No puedo procesar esta solicitud ya que puede violar las políticas de contenido.\n\n**Esto puede suceder cuando:**\n- El contenido contiene material sensible o inapropiado\n- La solicitud involucra casos de uso prohibidos\n\n**Por favor:**\n- Reformula tu pregunta\n- Pregunta sobre contenido diferente\n- Contacta con soporte si crees que esto es un error",
            placeholders: []
          }
        }
      }
    ]
  },

  RATE_LIMIT_EXCEEDED: {
    key: 'RATE_LIMIT_EXCEEDED',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "You've sent many requests quickly. Please wait 30-60 seconds before trying again.",
            placeholders: []
          },
          pt: {
            template: "Você enviou muitas solicitações rapidamente. Por favor, aguarde 30-60 segundos antes de tentar novamente.",
            placeholders: []
          },
          es: {
            template: "Has enviado muchas solicitudes rápidamente. Por favor, espera 30-60 segundos antes de intentar de nuevo.",
            placeholders: []
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 300,
        languages: {
          en: {
            template: "You've sent quite a few requests in a short time! To ensure quality service for everyone, there's a brief cooldown period.\n\n**Please wait 30-60 seconds** before trying again.\n\nIn the meantime, you might want to refine your question for better results.",
            placeholders: []
          },
          pt: {
            template: "Você enviou muitas solicitações em pouco tempo! Para garantir um serviço de qualidade para todos, há um breve período de espera.\n\n**Por favor, aguarde 30-60 segundos** antes de tentar novamente.\n\nEnquanto isso, você pode refinar sua pergunta para melhores resultados.",
            placeholders: []
          },
          es: {
            template: "¡Has enviado bastantes solicitudes en poco tiempo! Para garantizar un servicio de calidad para todos, hay un breve período de enfriamiento.\n\n**Por favor, espera 30-60 segundos** antes de intentar de nuevo.\n\nMientras tanto, podrías refinar tu pregunta para mejores resultados.",
            placeholders: []
          }
        }
      }
    ]
  },

  EMPTY_DOCUMENT: {
    key: 'EMPTY_DOCUMENT',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "**{{documentName}}** appears to be empty or I couldn't extract text from it. Try re-uploading or converting to PDF.",
            placeholders: ['documentName']
          },
          pt: {
            template: "**{{documentName}}** parece estar vazio ou não consegui extrair texto dele. Tente enviar novamente ou converter para PDF.",
            placeholders: ['documentName']
          },
          es: {
            template: "**{{documentName}}** parece estar vacío o no pude extraer texto de él. Intenta volver a subirlo o convertirlo a PDF.",
            placeholders: ['documentName']
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 400,
        languages: {
          en: {
            template: "I received **{{documentName}}**, but I couldn't extract any text content from it.\n\n**This usually happens when:**\n- The document contains only images (scanned PDFs)\n- The file is corrupted or encrypted\n- The document is actually blank\n\n**Try:**\n- Use OCR software if it's a scanned document\n- Re-save the file from the original application\n- Convert to PDF or DOCX",
            placeholders: ['documentName']
          },
          pt: {
            template: "Recebi **{{documentName}}**, mas não consegui extrair nenhum conteúdo de texto dele.\n\n**Isso geralmente acontece quando:**\n- O documento contém apenas imagens (PDFs digitalizados)\n- O arquivo está corrompido ou criptografado\n- O documento está realmente em branco\n\n**Tente:**\n- Usar software OCR se for um documento digitalizado\n- Salvar novamente o arquivo do aplicativo original\n- Converter para PDF ou DOCX",
            placeholders: ['documentName']
          },
          es: {
            template: "Recibí **{{documentName}}**, pero no pude extraer ningún contenido de texto de él.\n\n**Esto suele suceder cuando:**\n- El documento contiene solo imágenes (PDFs escaneados)\n- El archivo está corrupto o encriptado\n- El documento está realmente en blanco\n\n**Intenta:**\n- Usar software OCR si es un documento escaneado\n- Volver a guardar el archivo desde la aplicación original\n- Convertir a PDF o DOCX",
            placeholders: ['documentName']
          }
        }
      }
    ]
  },

  MULTIPLE_DOCUMENTS_FOUND: {
    key: 'MULTIPLE_DOCUMENTS_FOUND',
    defaultStyleId: 'short_guidance',
    styles: [
      {
        id: 'one_liner',
        maxLength: 140,
        languages: {
          en: {
            template: "I found {{count}} documents matching **{{query}}**. Which one would you like me to search?",
            placeholders: ['count', 'query']
          },
          pt: {
            template: "Encontrei {{count}} documentos correspondentes a **{{query}}**. Qual você gostaria que eu pesquisasse?",
            placeholders: ['count', 'query']
          },
          es: {
            template: "Encontré {{count}} documentos que coinciden con **{{query}}**. ¿Cuál te gustaría que busque?",
            placeholders: ['count', 'query']
          }
        }
      },
      {
        id: 'short_guidance',
        maxLength: 500,
        languages: {
          en: {
            template: "I found multiple documents that might match your query:\n\n{{documentList}}\n\n**Please specify:**\n- Which specific document you're interested in\n- Or if you'd like me to search across all of them\n\n**For example:**\n*\"Search in document #1\"* or *\"Compare all three documents\"*",
            placeholders: ['documentList']
          },
          pt: {
            template: "Encontrei vários documentos que podem corresponder à sua consulta:\n\n{{documentList}}\n\n**Por favor especifique:**\n- Qual documento específico lhe interessa\n- Ou se gostaria que eu pesquisasse em todos eles\n\n**Por exemplo:**\n*\"Pesquisar no documento #1\"* ou *\"Comparar todos os três documentos\"*",
            placeholders: ['documentList']
          },
          es: {
            template: "Encontré varios documentos que podrían coincidir con tu consulta:\n\n{{documentList}}\n\n**Por favor especifica:**\n- Qué documento específico te interesa\n- O si te gustaría que busque en todos ellos\n\n**Por ejemplo:**\n*\"Buscar en el documento #1\"* o *\"Comparar los tres documentos\"*",
            placeholders: ['documentList']
          }
        }
      }
    ]
  }
};

// ============================================================================
// MAIN FALLBACK FUNCTION
// ============================================================================

/**
 * Get fallback text for a given fallback key, language, and style
 *
 * @param options - Fallback options
 * @returns Formatted fallback text
 */
export function getFallbackText(options: FallbackOptions): string {
  const { fallbackKey, language, style, context = {} } = options;

  // Get fallback definition
  const definition = FALLBACK_TEMPLATES[fallbackKey];
  if (!definition) {
    console.warn(`[FallbackEngine] Unknown fallback key: ${fallbackKey}`);
    return "I'm having trouble processing your request. Please try again.";
  }

  // Get style (use provided style or default)
  const selectedStyleId = style || definition.defaultStyleId;
  const styleDefinition = definition.styles.find(s => s.id === selectedStyleId);

  if (!styleDefinition) {
    console.warn(`[FallbackEngine] Style not found: ${selectedStyleId}, using first available`);
    const fallbackStyle = definition.styles[0];
    if (!fallbackStyle) {
      return "I'm having trouble processing your request. Please try again.";
    }
  }

  const finalStyle = styleDefinition || definition.styles[0];

  // Get language-specific template (fallback to English)
  const langKey = (language?.toLowerCase()?.substring(0, 2) || 'en') as 'en' | 'pt' | 'es';
  const langTemplate = finalStyle.languages[langKey] || finalStyle.languages.en;

  // Replace placeholders
  const result = replacePlaceholders(langTemplate.template, context);

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Replace placeholders in template string
 * Replaces {{key}} with context[key]
 */
function replacePlaceholders(template: string, context: FallbackContext): string {
  let result = template;

  // Replace all {{key}} with context[key]
  const placeholderPattern = /\{\{(\w+)\}\}/g;
  result = result.replace(placeholderPattern, (match, key) => {
    const value = context[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    // Return empty string if placeholder not found (don't show raw placeholder)
    return '';
  });

  return result;
}

/**
 * Validate fallback key
 */
export function isValidFallbackKey(key: string): key is FallbackKey {
  return key in FALLBACK_TEMPLATES;
}

/**
 * Get all available fallback keys
 */
export function getAvailableFallbackKeys(): FallbackKey[] {
  return Object.keys(FALLBACK_TEMPLATES) as FallbackKey[];
}

/**
 * Get available styles for a fallback key
 */
export function getAvailableStyles(fallbackKey: FallbackKey): FallbackStyle[] {
  const definition = FALLBACK_TEMPLATES[fallbackKey];
  if (!definition) return [];
  return definition.styles.map(s => s.id);
}

/**
 * Get supported languages for a fallback key
 */
export function getSupportedLanguages(fallbackKey: FallbackKey): string[] {
  const definition = FALLBACK_TEMPLATES[fallbackKey];
  if (!definition || !definition.styles[0]) return [];
  return Object.keys(definition.styles[0].languages);
}

/**
 * Get default style for a fallback key
 */
export function getDefaultStyle(fallbackKey: FallbackKey): FallbackStyle | null {
  const definition = FALLBACK_TEMPLATES[fallbackKey];
  if (!definition) return null;
  return definition.defaultStyleId;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getFallbackText,
  isValidFallbackKey,
  getAvailableFallbackKeys,
  getAvailableStyles,
  getSupportedLanguages,
  getDefaultStyle
};
