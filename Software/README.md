# Execute e faça deploy do seu app AI Studio

Este guia contém tudo o que você precisa para rodar seu app localmente.

## Executar localmente

**Pré-requisitos:** Node.js

Antes de instalar as dependências, navegue até a raiz do projeto na pasta `Software`:

```bash
cd Software
```

1. Instale as dependências:
   ```bash
   npm install
   npm install --save-dev @types/react @types/react-dom
   npm install vite --save-dev
   npm install jspdf
   ```

2. Defina a variável `GEMINI_API_KEY` no arquivo [.env.local](.env.local) com sua chave da API Gemini.

3. Execute o app:
   ```bash
   npm run dev
   ```