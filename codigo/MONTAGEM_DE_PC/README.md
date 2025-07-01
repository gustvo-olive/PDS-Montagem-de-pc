# Execute e faça deploy do seu app AI Studio

Este guia contém tudo o que você precisa para rodar seu app localmente.

## Executar localmente

**Pré-requisitos:** Node.js

Antes de instalar as dependências, navegue até a raiz do projeto na pasta. Abra o terminal e execute: cd codigo\MONTAGEM_DE_PC:



1. Instale as dependências:
   ```bash
   npm install
   npm install --save-dev @types/react @types/react-dom
   npm install vite --save-dev
   npm install jspdf
   ```
   # (Opcional) Corrija automaticamente vulnerabilidades encontradas nas dependências:
   npm audit fix --force
   ```

2. Defina a variável `GEMINI_API_KEY` no arquivo [.env.local](.env.local) com sua chave da API Gemini.

3. Execute o app:
   ```bash
   npm run dev
   ```