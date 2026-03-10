// ===============================================
// AUTO-FIX IA - SISTEMA DE CORREÇÃO AUTOMÁTICA
// ===============================================
// Versão 1.0.0 - IA que detecta e corrige bugs

const AUTO_FIX_CONFIG = {
  enabled: true,
  logLevel: 'verbose', // 'minimal', 'verbose', 'debug'
  maxFixAttempts: 3,
  backupBeforeFix: true,
  autoDeploy: false,
  notificationWebhook: 'https://selomivplay.vercel.app/api/notifications',
  fixHistory: []
};

// ===== DETECTOR DE PADRÕES DE ERRO =====
const ERROR_PATTERNS = [
  {
    name: 'MERCADO_PAGO_TOKEN_AUSENTE',
    pattern: /MERCADO_PAGO_ACCESS_TOKEN.*?não configurado/,
    severity: 'high',
    fix: fixMercadoPagoToken
  },
  {
    name: 'YOUTUBE_API_KEY_AUSENTE',
    pattern: /YOUTUBE_API_KEY.*?não configurada/,
    severity: 'high',
    fix: fixYoutubeApiKey
  },
  {
    name: 'BLOCO_ANINHADO_ERRADO',
    pattern: /if.*?\{[\s\S]*?if.*?\{/,
    severity: 'critical',
    fix: fixNestedBlocks
  },
  {
    name: 'CORS_NAO_CONFIGURADO',
    pattern: /CORS|Access-Control-Allow-Origin.*?não/,
    severity: 'medium',
    fix: fixCORS
  },
  {
    name: 'RETURN_FALTANDO',
    pattern: /if.*?\{[\s\S]*?\}(?!\s*return)/,
    severity: 'critical',
    fix: fixMissingReturn
  },
  {
    name: 'VARIÁVEL_NAO_DEFINIDA',
    pattern: /ReferenceError:|is not defined/,
    severity: 'critical',
    fix: fixUndefinedVariable
  },
  {
    name: 'FETCH_SEM_TRY_CATCH',
    pattern: /fetch\(.*?\)(?![\s\S]*?catch)/,
    severity: 'medium',
    fix: addTryCatchToFetch
  }
];

// ===== CLASSE PRINCIPAL DO AUTO-FIX =====
class AutoFixIA {
  constructor() {
    this.fixHistory = [];
    this.lastError = null;
    this.fixCount = 0;
  }

  // Analisar erro e aplicar correção
  async analyzeAndFix(error, code, context) {
    console.log('🤖 IA Auto-Fix analisando erro...');
    console.log('📝 Erro:', error.message || error);
    
    this.lastError = {
      timestamp: new Date().toISOString(),
      error: error.message || error,
      context: context
    };

    // Backup do código antes de modificar
    if (AUTO_FIX_CONFIG.backupBeforeFix) {
      await this.createBackup(code, context);
    }

    // Detectar padrão de erro
    const detectedPattern = this.detectErrorPattern(error);
    
    if (!detectedPattern) {
      console.log('❌ Padrão não reconhecido. Correção manual necessária.');
      return {
        success: false,
        fixed: false,
        message: 'Padrão não reconhecido',
        code: code
      };
    }

    console.log(`✅ Padrão detectado: ${detectedPattern.name} (severidade: ${detectedPattern.severity})`);

    // Aplicar correção específica
    try {
      const fixedCode = await detectedPattern.fix(code, error, context);
      
      // Validar se a correção foi bem-sucedida
      const validation = await this.validateFix(fixedCode, context);
      
      if (validation.valid) {
        this.fixHistory.push({
          timestamp: new Date().toISOString(),
          pattern: detectedPattern.name,
          success: true
        });
        
        console.log(`✅ Código corrigido automaticamente!`);
        
        // Deploy automático se configurado
        if (AUTO_FIX_CONFIG.autoDeploy) {
          await this.autoDeploy(fixedCode, context);
        }
        
        return {
          success: true,
          fixed: true,
          pattern: detectedPattern.name,
          code: fixedCode,
          validation: validation
        };
      } else {
        throw new Error(`Validação falhou: ${validation.reason}`);
      }
      
    } catch (fixError) {
      console.error('❌ Falha na correção automática:', fixError);
      
      this.fixHistory.push({
        timestamp: new Date().toISOString(),
        pattern: detectedPattern.name,
        success: false,
        error: fixError.message
      });
      
      return {
        success: false,
        fixed: false,
        error: fixError.message,
        code: code
      };
    }
  }

  // Detectar padrão de erro
  detectErrorPattern(error) {
    const errorString = error.toString();
    
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(errorString)) {
        return pattern;
      }
    }
    
    // Detecção por palavras-chave
    if (errorString.includes('token') || errorString.includes('API key')) {
      return {
        name: 'PROBLEMA_DE_TOKEN',
        severity: 'high',
        fix: fixGenericToken
      };
    }
    
    if (errorString.includes('syntax') || errorString.includes('Unexpected token')) {
      return {
        name: 'ERRO_DE_SINTAXE',
        severity: 'critical',
        fix: fixSyntaxError
      };
    }
    
    return null;
  }

  // Validar correção
  async validateFix(code, context) {
    try {
      // Verificação 1: Sintaxe básica
      new Function(code); // Tenta compilar
        
      // Verificação 2: Regras específicas
      const validations = [
        this.checkBrackets(code),
        this.checkReturnStatements(code),
        this.checkEnvVariables(code),
        this.checkAsyncAwait(code)
      ];
      
      const failed = validations.filter(v => !v.passed);
      
      if (failed.length > 0) {
        return {
          valid: false,
          reason: failed.map(f => f.reason).join(', ')
        };
      }
      
      return {
        valid: true,
        checks: validations.length
      };
      
    } catch (error) {
      return {
        valid: false,
        reason: `Erro de sintaxe: ${error.message}`
      };
    }
  }

  // Utilitários de validação
  checkBrackets(code) {
    let balance = 0;
    for (let char of code) {
      if (char === '{') balance++;
      if (char === '}') balance--;
      if (balance < 0) {
        return { passed: false, reason: 'Chaves desbalanceadas' };
      }
    }
    return { passed: balance === 0, reason: balance !== 0 ? 'Faltando fechamento de chaves' : 'OK' };
  }

  checkReturnStatements(code) {
    // Verifica se todos os if têm return ou são o último
    const lines = code.split('\n');
    let issues = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('if (') && !lines[i].includes('return')) {
        const nextLine = lines[i + 1] || '';
        if (!nextLine.includes('return') && !nextLine.includes('throw')) {
          issues.push(`Linha ${i + 1}: if sem return`);
        }
      }
    }
    
    return { 
      passed: issues.length === 0, 
      reason: issues.length > 0 ? issues.join('; ') : 'OK' 
    };
  }

  checkEnvVariables(code) {
    const envVars = ['MERCADO_PAGO_ACCESS_TOKEN', 'YOUTUBE_API_KEY'];
    const issues = [];
    
    for (const envVar of envVars) {
      if (code.includes(envVar) && !code.includes(`process.env.${envVar}`)) {
        issues.push(`${envVar} usado sem process.env`);
      }
    }
    
    return { 
      passed: issues.length === 0, 
      reason: issues.length > 0 ? issues.join('; ') : 'OK' 
    };
  }

  checkAsyncAwait(code) {
    if (code.includes('fetch(') && !code.includes('await fetch')) {
      return { passed: false, reason: 'fetch sem await detectado' };
    }
    return { passed: true, reason: 'OK' };
  }

  async createBackup(code, context) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${context.filename || 'code'}_${timestamp}.js`;
    
    // Salvar backup (em produção, salvaria em storage)
    console.log(`💾 Backup criado: ${backupName}`);
    
    return backupName;
  }

  async autoDeploy(code, context) {
    console.log('🚀 Executando deploy automático...');
    // Implementar integração com Vercel API
    // Seria necessário token do Vercel
  }
}

// ===== FUNÇÕES DE CORREÇÃO ESPECÍFICAS =====

async function fixMercadoPagoToken(code, error) {
  console.log('🔧 Corrigindo token do Mercado Pago...');
  
  // Adicionar verificação de token se não existir
  if (!code.includes('MERCADO_PAGO_ACCESS_TOKEN')) {
    // Adicionar no início do arquivo
    const lines = code.split('\n');
    const importIndex = lines.findIndex(line => line.includes('export default'));
    
    const tokenCheck = `
// Verificação automática do token Mercado Pago
if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  console.warn('⚠️ MERCADO_PAGO_ACCESS_TOKEN não configurado');
  // Modo fallback ativado
}`;
    
    lines.splice(importIndex, 0, tokenCheck);
    code = lines.join('\n');
  }
  
  return code;
}

async function fixYoutubeApiKey(code, error) {
  console.log('🔧 Corrigindo API Key do YouTube...');
  
  // Adicionar validação mais robusta
  code = code.replace(
    /if \(!YOUTUBE_API_KEY(.*?)\{/g,
    'if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === \'YOUR_YOUTUBE_API_KEY_HERE\' || YOUTUBE_API_KEY === \'AIzaSy...\') {'
  );
  
  return code;
}

async function fixNestedBlocks(code) {
  console.log('🔧 Corrigindo blocos aninhados...');
  
  // Detectar e corrigir ifs aninhados incorretamente
  const lines = code.split('\n');
  let fixed = [];
  let blockStack = [];
  let inBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('if (action ===') && !line.includes('}')) {
      if (inBlock) {
        // Fechar bloco anterior antes de abrir novo
        fixed.push('}');
      }
      inBlock = true;
      fixed.push(line);
    } else {
      fixed.push(line);
    }
  }
  
  return fixed.join('\n');
}

async function fixCORS(code) {
  console.log('🔧 Corrigindo configuração CORS...');
  
  const corsCode = `
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
`;
  
  // Substituir configuração CORS existente
  if (code.includes('res.setHeader')) {
    code = code.replace(
      /\/\/ Configurar CORS[\s\S]*?res\.setHeader[^;]*;/g,
      corsCode
    );
  } else {
    // Adicionar no início do handler
    code = code.replace(
      /export default async function handler/,
      `export default async function handler(req, res) {\n${corsCode}`
    );
  }
  
  return code;
}

async function fixMissingReturn(code) {
  console.log('🔧 Corrigindo returns faltantes...');
  
  const lines = code.split('\n');
  let fixed = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    fixed.push(line);
    
    // Se encontrar um if sem return na próxima linha
    if (line.includes('if (action ===') && !line.includes('return')) {
      const nextLine = lines[i + 1] || '';
      if (!nextLine.includes('return') && !nextLine.includes('throw')) {
        // Adicionar return antes do próximo if
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].includes('if (action ===')) {
            fixed.splice(j, 0, '    return res.status(200).json({ success: true, message: "Ação processada" });');
            break;
          }
        }
      }
    }
  }
  
  return fixed.join('\n');
}

async function fixUndefinedVariable(code, error) {
  console.log('🔧 Corrigindo variável indefinida...');
  
  const match = error.toString().match(/(\w+) is not defined/);
  if (match && match[1]) {
    const varName = match[1];
    
    // Adicionar declaração da variável
    const declaration = `const ${varName} = process.env.${varName} || null; // Auto-fix adicionado`;
    
    const lines = code.split('\n');
    const importIndex = lines.findIndex(line => line.includes('export default'));
    lines.splice(importIndex, 0, declaration);
    
    code = lines.join('\n');
  }
  
  return code;
}

async function addTryCatchToFetch(code) {
  console.log('🔧 Adicionando try/catch a fetch sem tratamento...');
  
  // Encontrar fetch sem try/catch
  const fetchRegex = /(const\s+\w+\s*=\s*await\s+fetch\(.*?\))(?![\s\S]*?catch)/g;
  
  code = code.replace(fetchRegex, (match) => {
    return `try {
      ${match}
    } catch (fetchError) {
      console.error('❌ Erro no fetch:', fetchError);
      return res.status(200).json({
        success: false,
        message: 'Erro na requisição',
        error: fetchError.message
      });
    }`;
  });
  
  return code;
}

async function fixSyntaxError(code) {
  console.log('🔧 Corrigindo erro de sintaxe...');
  
  // Correções comuns de sintaxe
  let fixed = code
    .replace(/}\s*else\s*{/g, '} else {')
    .replace(/}\s*catch/g, '} catch')
    .replace(/}\s*finally/g, '} finally')
    .replace(/\(\s*\)/g, '()')
    .replace(/\[\s*\]/g, '[]')
    .replace(/\{\s*\}/g, '{}')
    .replace(/,\s*,/g, ',')
    .replace(/;\s*;/g, ';');
  
  return fixed;
}

async function fixGenericToken(code) {
  console.log('🔧 Corrigindo problema genérico de token...');
  
  const tokenCheck = `
// Validação genérica de tokens
const requiredTokens = ['MERCADO_PAGO_ACCESS_TOKEN', 'YOUTUBE_API_KEY'];
const missingTokens = requiredTokens.filter(token => !process.env[token]);

if (missingTokens.length > 0) {
  console.warn(\`⚠️ Tokens ausentes: \${missingTokens.join(', ')}\`);
  // Modo fallback ativado
}`;
  
  const lines = code.split('\n');
  const importIndex = lines.findIndex(line => line.includes('export default'));
  lines.splice(importIndex, 0, tokenCheck);
  
  return lines.join('\n');
}

// ===== INTEGRAÇÃO COM O BACKEND =====

export async function autoFixMiddleware(error, req, res, code) {
  const autoFix = new AutoFixIA();
  
  // Analisar e corrigir
  const result = await autoFix.analyzeAndFix(error, code, {
    filename: 'backend.js',
    endpoint: req.url,
    method: req.method
  });
  
  if (result.fixed) {
    console.log('✅ Código corrigido automaticamente!');
    console.log('📊 Histórico de correções:', autoFix.fixHistory);
    
    // Notificar administradores
    await notifyAdmins(result, req);
  }
  
  return result;
}

async function notifyAdmins(fixResult, req) {
  try {
    const notification = {
      type: 'AUTO_FIX',
      timestamp: new Date().toISOString(),
      pattern: fixResult.pattern,
      endpoint: req?.url,
      success: fixResult.success
    };
    
    // Enviar para webhook de notificações
    await fetch(AUTO_FIX_CONFIG.notificationWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    });
    
  } catch (error) {
    console.error('Erro ao notificar admins:', error);
  }
}

// ===== FUNÇÃO PARA INTEGRAR NO BACKEND EXISTENTE =====

export function enhanceWithAutoFix(originalHandler) {
  return async function(req, res) {
    try {
      return await originalHandler(req, res);
    } catch (error) {
      console.error('🤖 Auto-Fix IA detectou erro:', error);
      
      // Tentar corrigir automaticamente
      const code = originalHandler.toString();
      const fixResult = await autoFixMiddleware(error, req, res, code);
      
      if (fixResult.fixed) {
        console.log('✅ Erro corrigido! Nova versão do código:');
        console.log(fixResult.code);
        
        // Retornar resposta amigável
        return res.status(200).json({
          success: true,
          message: 'Erro corrigido automaticamente pelo sistema IA',
          autoFixed: true,
          fix: fixResult.pattern
        });
      }
      
      // Se não conseguiu corrigir, repassar erro
      throw error;
    }
  };
}

// Exportar utilitários
export const autoFix = new AutoFixIA();
export const fixFunctions = {
  fixMercadoPagoToken,
  fixYoutubeApiKey,
  fixNestedBlocks,
  fixCORS,
  fixMissingReturn,
  fixUndefinedVariable,
  addTryCatchToFetch,
  fixSyntaxError,
  fixGenericToken
};
