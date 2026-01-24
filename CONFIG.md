# 🔧 CONFIGURAÇÃO SELO MIV BETA

## 🌐 URLs DO SISTEMA

### GitHub Repository
https://github.com/ISRCselomivbeta/royalties-demo

### Google Drive (Sua Estrutura)
- 📁 **Pasta Principal**: https://drive.google.com/drive/folders/1Y4HvXb5wYKshurLePoAqvx0D4H4-mykU
- 📁 **SELO_MIV_ARQUIVOS**: https://drive.google.com/drive/folders/1AF9orQNikaWt5DqEGMGTFkTB0xhMWdtZ
- 📁 **Contratos-Gerados**: https://drive.google.com/drive/folders/1BvnWMaAK-g1ywVm0qZfdTy_xq4MZIAJZ

### Planilha Principal
📊 https://docs.google.com/spreadsheets/d/1NOc5RHVoWdfdMDur55C5R25FAsAcqQtk5PHVmFlViV0/edit

### Google Apps Script
🔧 https://script.google.com/d/1LGS5YyMeuzqhmdHR2YfEwGFGgqGIanLYrh02O-7tsxiymyozCdjQbAk6/edit

## 🚀 COMO CONFIGURAR PASSO A PASSO

### 1️⃣ Configurar Google Apps Script
1. Acesse seu Google Apps Script (link acima)
2. APAGUE todo o código existente
3. Cole o código do arquivo `backend/apps-script/code.gs`
4. Salve (Ctrl+S)
5. Clique em "Publicar" > "Implantar como aplicativo web"
6. Configure:
   - Executar como: **Eu mesmo**
   - Acesso: **Qualquer pessoa, mesmo anônimo**
7. Clique em "Implantar" e **COPIE A URL**

### 2️⃣ Atualizar o Site
1. No arquivo `index.html`, linha ~928, localize:
   ```javascript
   const API_URL = "https://script.google.com/macros/s/AKfycbx8fyJVNilDqnRF0mMJOHsthPzaMene_sRdxI3nmTctgb5PbQiHSO3QgKWChsrLBtan/exec";
