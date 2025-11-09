Documento Mestre e Diário de Bordo do Projeto H-Quant (v1.0)

Preâmbulo: A Fonte Canônica da Verdade
Este documento, contexto.md, é a ata definitiva e a fonte única da verdade para o projeto H-Quant. Ele foi criado para garantir que todo o contexto, decisões de arquitetura e o histórico de desenvolvimento sejam preservados com 100% de fidelidade.

1. Regras de Engajamento (Seu "Sistema Operacional")
Esta seção define as regras obrigatórias de nossa colaboração. Você, como IA, deve seguir estas diretivas em todas as sessões.

1.1. Diretiva Primordial: Ler e Atualizar
No início de cada sessão, sua primeira ação será sempre ler este arquivo na íntegra para se situar. Ao final de cada tarefa executada com sucesso, sua última ação será sempre me fornecer o bloco de texto para atualizar o "Diário de Bordo" (Seção 4).

1.2. Nossas Personas
Mat (Dono do Produto & Desenvolvedor Executor): Define a visão, os requisitos, valida as entregas e executa os comandos de código, commit e deploy.
IA (Parceiro Sênior & Arquiteto de Software): Analisa os requisitos, projeta a arquitetura, fornece o conteúdo completo e final dos arquivos, gera as mensagens de commit e mantém este Diário de Bordo atualizado.

1.3. Nosso Ciclo de Trabalho Obrigatório
Todo o nosso trabalho seguirá este ciclo:
Início de Sessão: Eu te instruirei a ler este arquivo contexto.md.
Definição da Tarefa: Eu definirei o objetivo (ex: "Corrija o bug X").
Execução da Tarefa: Você realiza as modificações de código necessárias.
Relatório e Atualização do Diário: Imediatamente após a execução, você me entrega duas coisas:
Um breve relatório da ação (o que foi feito, se deu certo).
O bloco de texto formatado em Markdown para a nova entrada do "Diário de Bordo".
A tarefa só é considerada concluída após a geração da entrada do Diário.

2. Visão e Arquitetura do H-Quant (Estado Inicial)
2.1. A Visão do Produto
O H-Quant é um aplicativo web standalone (ComposiçõesLib) para ser a ferramenta definitiva de gerenciamento de uma biblioteca de composições de engenharia de custos. Suas funcionalidades principais são importação inteligente via IA, verificação de similaridade, busca semântica ("Ask H-Quant"), gerenciamento e exportação.

2.2. Arquitetura e Stack de Tecnologia
Frontend: React com TypeScript.
Estilização: TailwindCSS.
Framework de Build: Next.js (conforme detectado pela Vercel).
Inteligência Artificial: Google Gemini API (gemini-1.5-flash-latest).
Infraestrutura de Deploy:
Código-fonte: GitHub (Matbsilva/H-QUANT).
Hospedagem: Vercel.
Banco de Dados (Futuro): Supabase (atualmente usando mockData.ts).

3. Roadmap de Desenvolvimento (Fases)
FASE 0: Configuração e Deploy (ESTADO ATUAL)
Configurar o projeto localmente (VS Code).
Conectar ao GitHub.
Realizar o primeiro deploy no Vercel.
Corrigir bugs de build para estabelecer uma base funcional.

FASE 1: Integração com Banco de Dados
Configurar o projeto no Supabase.
Criar a tabela composicoes.
Refatorar o código para substituir mockData.ts por chamadas à API do Supabase.

FASE 2: Otimização da IA (Long-Term)
Implementar a arquitetura de Embeddings e Vector Search para a busca semântica, a fim de evitar limites de cota da API.

4. Diário de Bordo (Registro de Alterações)
4.1. Padrão de Entrada para o Diário de Bordo
Toda nova alteração no código-fonte será registrada usando o seguinte formato:
```
[Data] - FASE X, TAREFA Y: [Título da Tarefa]
Objetivo: [Descrição clara e concisa do que foi solicitado.]
Análise e Arquitetura da Solução: [Explicação do raciocínio técnico por trás da implementação. Por que essa abordagem foi escolhida?]
Modificações Realizadas:
arquivo_modificado_1.js: [Resumo da principal alteração neste arquivo.]
arquivo_modificado_2.css: [Resumo da principal alteração neste arquivo.]
Commit Associado: `tipo(escopo): mensagem do commit`
```

4.2. Entradas do Diário
[Data Atual] - FASE 0, TAREFA 0: Criação do Documento Mestre de Contexto
Objetivo: Criar e estabelecer o arquivo contexto.md como a fonte canônica da verdade para o projeto H-Quant.
Análise e Arquitetura da Solução: Foi definido um documento mestre que contém as regras de colaboração, a visão do produto, a arquitetura e um diário de bordo para registrar todas as alterações. Este arquivo servirá como a "memória" persistente do projeto e a principal diretiva para a colaboração com a IA.
Modificações Realizadas:
contexto.md: Criação do arquivo com a estrutura inicial do projeto e o registro desta primeira ação.
Commit Associado: `docs(context): create initial project context and log file`
[Data Atual] - FASE 0, TAREFA 1: Deploy Inicial no Vercel e Correção de Bug de Build
Objetivo: Realizar o primeiro deploy do projeto H-Quant no Vercel e corrigir o erro de build que impede a compilação.
Análise e Arquitetura da Solução: (ESTADO ATUAL) O primeiro deploy no Vercel falhou com um "Syntax Error" no arquivo services/geminiService.ts. A causa raiz é um caractere de escape inválido (\f) dentro de uma string de prompt. A próxima ação é corrigir cirurgicamente este erro para desbloquear o deploy.
Modificações a Serem Realizadas:
services/geminiService.ts: Corrigir o erro de sintaxe dentro de uma string de prompt.
Commit a ser Gerado: `fix(build): correct syntax error in geminiService prompt string`
[sábado, 8 de novembro de 2025] - FASE 0, TAREFA 2: Correção de Erro de Compilação no Vercel (Regex Flag)
Objetivo: Corrigir o erro de compilação no arquivo components/Workspace.tsx causado pelo uso da flag 's' em uma expressão regular, que não é compatível com o ambiente de build do Vercel.
Análise e Arquitetura da Solução: O erro "This regular expression flag is only available when targeting 'es2018' or later" indica que a flag 's' (dotAll) na expressão regular não é suportada pelo ambiente de compilação padrão. A solução é substituir o atalho '.' por '[\s\S]' para que ele corresponda a qualquer caractere, incluindo quebras de linha, e remover a flag 's', garantindo compatibilidade sem alterar as configurações de build do projeto.
Modificações Realizadas:
components/Workspace.tsx: A expressão regular `const match = text.match(/^\*\*(.*?)\*\*(.*)/s);` foi alterada para `const match = text.match(/^\*\*(.*?)\*\*([\s\S]*)/);`.
Commit Associado: `fix(build): correct regex flag in Workspace.tsx for Vercel build`