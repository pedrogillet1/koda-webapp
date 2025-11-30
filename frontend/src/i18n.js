import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      nav: {
        chat: 'Chat',
        documents: 'Documents',
        upload: 'Upload',
        settings: 'Settings',
        dashboard: 'Dashboard',
        logout: 'Logout'
      },
      // Common actions
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        search: 'Search',
        upload: 'Upload',
        download: 'Download',
        rename: 'Rename',
        move: 'Move',
        copy: 'Copy',
        select: 'Select',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        loading: 'Loading...',
        noResults: 'No results found',
        confirm: 'Confirm',
        close: 'Close',
        retry: 'Retry',
        files: 'Files',
        file: 'File',
        folder: 'Folder',
        folders: 'Folders',
        total: 'Total'
      },
      // Chat interface
      chat: {
        placeholder: 'Ask anything about your documents...',
        send: 'Send',
        newChat: 'New Chat',
        regenerate: 'Regenerate',
        copyResponse: 'Copy Response',
        researchMode: 'Research Mode',
        greeting: 'Hello',
        welcomeMessage: 'How can I help you today?'
      },
      // Documents
      documents: {
        title: 'Documents',
        allDocuments: 'All Documents',
        recentDocuments: 'Recent Documents',
        uploadDocuments: 'Upload Documents',
        noDocuments: 'No documents yet',
        dragDrop: 'Drag and drop files here',
        orBrowse: 'or browse files',
        fileTypes: 'All file types supported',
        maxSize: 'Max file size: 15MB',
        sortBy: 'Sort by',
        name: 'Name',
        date: 'Date',
        size: 'Size',
        type: 'Type',
        category: 'Category',
        categories: 'Categories',
        uncategorized: 'Uncategorized'
      },
      // Upload
      upload: {
        title: 'Upload Documents',
        uploading: 'Uploading...',
        uploadComplete: 'Upload complete',
        uploadFailed: 'Upload failed',
        dragDropHere: 'Upload Documents or Drag-n-drop',
        selectFiles: 'Select Files',
        progress: 'Progress',
        success: '{{count}} document{{plural}} been uploaded.',
        error: 'Upload failed. Please try again.'
      },
      // Settings
      settings: {
        title: 'Settings',
        account: 'Account',
        profile: 'Profile',
        security: 'Security',
        notifications: 'Notifications',
        language: 'Language',
        theme: 'Theme',
        storage: 'Storage',
        storageUsed: 'Storage Used',
        plan: 'Plan',
        upgrade: 'Upgrade',
        changePassword: 'Change Password',
        deleteAccount: 'Delete Account',
        languageRegion: 'Language & Region',
        interfaceLanguage: 'Interface Language',
        answerLanguage: 'Answer Language'
      },
      // Notifications
      notifications: {
        title: 'Notifications',
        noNotifications: 'No notifications',
        markAllRead: 'Mark all as read',
        uploadSuccess: 'Document uploaded successfully',
        uploadError: 'Failed to upload document',
        deleteSuccess: 'Document deleted',
        moveSuccess: 'Document moved'
      },
      // Errors
      errors: {
        generic: 'Something went wrong',
        network: 'Network error. Please check your connection.',
        unauthorized: 'Please log in to continue',
        notFound: 'Not found',
        fileTooLarge: 'File is too large',
        invalidFileType: 'Invalid file type'
      },
      // Auth
      auth: {
        login: 'Log In',
        signup: 'Sign Up',
        logout: 'Log Out',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        forgotPassword: 'Forgot Password?',
        createAccount: 'Create Account',
        alreadyHaveAccount: 'Already have an account?',
        dontHaveAccount: "Don't have an account?"
      },
      // File breakdown
      fileBreakdown: {
        title: 'File Breakdown',
        video: 'Video',
        document: 'Document',
        spreadsheet: 'Spreadsheet',
        image: 'Image',
        other: 'Other'
      },
      // Welcome popup
      welcome: {
        title: "Join Koda's Universe",
        description: 'Sign up to unlock the full power of intelligent document management',
        cta: 'Sign Up Now'
      }
    }
  },
  'pt-BR': {
    translation: {
      // Navigation
      nav: {
        chat: 'Chat',
        documents: 'Documentos',
        upload: 'Enviar',
        settings: 'Configurações',
        dashboard: 'Painel',
        logout: 'Sair'
      },
      // Common actions
      common: {
        save: 'Salvar',
        cancel: 'Cancelar',
        delete: 'Excluir',
        edit: 'Editar',
        search: 'Pesquisar',
        upload: 'Enviar',
        download: 'Baixar',
        rename: 'Renomear',
        move: 'Mover',
        copy: 'Copiar',
        select: 'Selecionar',
        selectAll: 'Selecionar Tudo',
        deselectAll: 'Desmarcar Tudo',
        loading: 'Carregando...',
        noResults: 'Nenhum resultado encontrado',
        confirm: 'Confirmar',
        close: 'Fechar',
        retry: 'Tentar Novamente',
        files: 'Arquivos',
        file: 'Arquivo',
        folder: 'Pasta',
        folders: 'Pastas',
        total: 'Total'
      },
      // Chat interface
      chat: {
        placeholder: 'Pergunte qualquer coisa sobre seus documentos...',
        send: 'Enviar',
        newChat: 'Novo Chat',
        regenerate: 'Regenerar',
        copyResponse: 'Copiar Resposta',
        researchMode: 'Modo Pesquisa',
        greeting: 'Olá',
        welcomeMessage: 'Como posso ajudá-lo hoje?'
      },
      // Documents
      documents: {
        title: 'Documentos',
        allDocuments: 'Todos os Documentos',
        recentDocuments: 'Documentos Recentes',
        uploadDocuments: 'Enviar Documentos',
        noDocuments: 'Nenhum documento ainda',
        dragDrop: 'Arraste e solte arquivos aqui',
        orBrowse: 'ou navegue nos arquivos',
        fileTypes: 'Todos os tipos de arquivo suportados',
        maxSize: 'Tamanho máximo: 15MB',
        sortBy: 'Ordenar por',
        name: 'Nome',
        date: 'Data',
        size: 'Tamanho',
        type: 'Tipo',
        category: 'Categoria',
        categories: 'Categorias',
        uncategorized: 'Sem categoria'
      },
      // Upload
      upload: {
        title: 'Enviar Documentos',
        uploading: 'Enviando...',
        uploadComplete: 'Envio concluído',
        uploadFailed: 'Falha no envio',
        dragDropHere: 'Envie Documentos ou Arraste e Solte',
        selectFiles: 'Selecionar Arquivos',
        progress: 'Progresso',
        success: '{{count}} documento{{plural}} enviado{{plural}}.',
        error: 'Falha no envio. Por favor, tente novamente.'
      },
      // Settings
      settings: {
        title: 'Configurações',
        account: 'Conta',
        profile: 'Perfil',
        security: 'Segurança',
        notifications: 'Notificações',
        language: 'Idioma',
        theme: 'Tema',
        storage: 'Armazenamento',
        storageUsed: 'Armazenamento Usado',
        plan: 'Plano',
        upgrade: 'Atualizar',
        changePassword: 'Alterar Senha',
        deleteAccount: 'Excluir Conta',
        languageRegion: 'Idioma e Região',
        interfaceLanguage: 'Idioma da Interface',
        answerLanguage: 'Idioma das Respostas'
      },
      // Notifications
      notifications: {
        title: 'Notificações',
        noNotifications: 'Sem notificações',
        markAllRead: 'Marcar tudo como lido',
        uploadSuccess: 'Documento enviado com sucesso',
        uploadError: 'Falha ao enviar documento',
        deleteSuccess: 'Documento excluído',
        moveSuccess: 'Documento movido'
      },
      // Errors
      errors: {
        generic: 'Algo deu errado',
        network: 'Erro de rede. Verifique sua conexão.',
        unauthorized: 'Por favor, faça login para continuar',
        notFound: 'Não encontrado',
        fileTooLarge: 'Arquivo muito grande',
        invalidFileType: 'Tipo de arquivo inválido'
      },
      // Auth
      auth: {
        login: 'Entrar',
        signup: 'Cadastrar',
        logout: 'Sair',
        email: 'E-mail',
        password: 'Senha',
        confirmPassword: 'Confirmar Senha',
        forgotPassword: 'Esqueceu a senha?',
        createAccount: 'Criar Conta',
        alreadyHaveAccount: 'Já tem uma conta?',
        dontHaveAccount: 'Não tem uma conta?'
      },
      // File breakdown
      fileBreakdown: {
        title: 'Análise de Arquivos',
        video: 'Vídeo',
        document: 'Documento',
        spreadsheet: 'Planilha',
        image: 'Imagem',
        other: 'Outro'
      },
      // Welcome popup
      welcome: {
        title: 'Junte-se ao Universo Koda',
        description: 'Cadastre-se para desbloquear todo o poder do gerenciamento inteligente de documentos',
        cta: 'Cadastre-se Agora'
      }
    }
  },
  'es-ES': {
    translation: {
      // Navigation
      nav: {
        chat: 'Chat',
        documents: 'Documentos',
        upload: 'Subir',
        settings: 'Configuración',
        dashboard: 'Panel',
        logout: 'Cerrar Sesión'
      },
      // Common actions
      common: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        edit: 'Editar',
        search: 'Buscar',
        upload: 'Subir',
        download: 'Descargar',
        rename: 'Renombrar',
        move: 'Mover',
        copy: 'Copiar',
        select: 'Seleccionar',
        selectAll: 'Seleccionar Todo',
        deselectAll: 'Deseleccionar Todo',
        loading: 'Cargando...',
        noResults: 'No se encontraron resultados',
        confirm: 'Confirmar',
        close: 'Cerrar',
        retry: 'Reintentar',
        files: 'Archivos',
        file: 'Archivo',
        folder: 'Carpeta',
        folders: 'Carpetas',
        total: 'Total'
      },
      // Chat interface
      chat: {
        placeholder: 'Pregunta cualquier cosa sobre tus documentos...',
        send: 'Enviar',
        newChat: 'Nuevo Chat',
        regenerate: 'Regenerar',
        copyResponse: 'Copiar Respuesta',
        researchMode: 'Modo Investigación',
        greeting: 'Hola',
        welcomeMessage: '¿Cómo puedo ayudarte hoy?'
      },
      // Documents
      documents: {
        title: 'Documentos',
        allDocuments: 'Todos los Documentos',
        recentDocuments: 'Documentos Recientes',
        uploadDocuments: 'Subir Documentos',
        noDocuments: 'Aún no hay documentos',
        dragDrop: 'Arrastra y suelta archivos aquí',
        orBrowse: 'o navega por archivos',
        fileTypes: 'Todos los tipos de archivo soportados',
        maxSize: 'Tamaño máximo: 15MB',
        sortBy: 'Ordenar por',
        name: 'Nombre',
        date: 'Fecha',
        size: 'Tamaño',
        type: 'Tipo',
        category: 'Categoría',
        categories: 'Categorías',
        uncategorized: 'Sin categoría'
      },
      // Upload
      upload: {
        title: 'Subir Documentos',
        uploading: 'Subiendo...',
        uploadComplete: 'Subida completa',
        uploadFailed: 'Falló la subida',
        dragDropHere: 'Sube Documentos o Arrastra y Suelta',
        selectFiles: 'Seleccionar Archivos',
        progress: 'Progreso',
        success: '{{count}} documento{{plural}} subido{{plural}}.',
        error: 'Falló la subida. Por favor, inténtalo de nuevo.'
      },
      // Settings
      settings: {
        title: 'Configuración',
        account: 'Cuenta',
        profile: 'Perfil',
        security: 'Seguridad',
        notifications: 'Notificaciones',
        language: 'Idioma',
        theme: 'Tema',
        storage: 'Almacenamiento',
        storageUsed: 'Almacenamiento Usado',
        plan: 'Plan',
        upgrade: 'Mejorar',
        changePassword: 'Cambiar Contraseña',
        deleteAccount: 'Eliminar Cuenta',
        languageRegion: 'Idioma y Región',
        interfaceLanguage: 'Idioma de Interfaz',
        answerLanguage: 'Idioma de Respuestas'
      },
      // Notifications
      notifications: {
        title: 'Notificaciones',
        noNotifications: 'Sin notificaciones',
        markAllRead: 'Marcar todo como leído',
        uploadSuccess: 'Documento subido exitosamente',
        uploadError: 'Error al subir documento',
        deleteSuccess: 'Documento eliminado',
        moveSuccess: 'Documento movido'
      },
      // Errors
      errors: {
        generic: 'Algo salió mal',
        network: 'Error de red. Verifica tu conexión.',
        unauthorized: 'Por favor, inicia sesión para continuar',
        notFound: 'No encontrado',
        fileTooLarge: 'Archivo demasiado grande',
        invalidFileType: 'Tipo de archivo inválido'
      },
      // Auth
      auth: {
        login: 'Iniciar Sesión',
        signup: 'Registrarse',
        logout: 'Cerrar Sesión',
        email: 'Correo Electrónico',
        password: 'Contraseña',
        confirmPassword: 'Confirmar Contraseña',
        forgotPassword: '¿Olvidaste tu contraseña?',
        createAccount: 'Crear Cuenta',
        alreadyHaveAccount: '¿Ya tienes una cuenta?',
        dontHaveAccount: '¿No tienes una cuenta?'
      },
      // File breakdown
      fileBreakdown: {
        title: 'Desglose de Archivos',
        video: 'Video',
        document: 'Documento',
        spreadsheet: 'Hoja de Cálculo',
        image: 'Imagen',
        other: 'Otro'
      },
      // Welcome popup
      welcome: {
        title: 'Únete al Universo de Koda',
        description: 'Regístrate para desbloquear todo el poder de la gestión inteligente de documentos',
        cta: 'Regístrate Ahora'
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    }
  });

export default i18n;
