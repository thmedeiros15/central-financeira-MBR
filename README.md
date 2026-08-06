# MBR TRACKER - Tecnologia Que Protege 🚀

Sistema completo e inteligente de gestão financeira pessoal e empresarial, desenvolvido com **React 19**, **TypeScript**, **Vite** e **Tailwind CSS**, integrado ao **Google Gemini AI** para análises financeiras avançadas.

---

## 🌟 Funcionalidades Principais

- 💼 **Gestão Empresarial**:
  - Cadastro e controle financeiro individual por empresa (Filiais/CNPJs).
  - Lançamento de Receitas, Despesas, Recorrentes/Fixas e Parcelamentos.
  - Pro-Labore automatizado integrado à gestão pessoal.

- 👤 **Gestão Pessoal**:
  - Controle completo do orçamento pessoal.
  - Separação clara entre rendimentos pessoais e fluxo empresarial.

- 📊 **Visão Consolidada (Home)**:
  - Balanço líquido consolidado sem duplicidade de Pro-Labore.
  - Gráficos interativos com **Recharts** (Entradas vs Saídas, Distribuição por Categoria e Tendência Mensal).
  - Tabela completa com filtros por módulo, período e busca rápida.

- 🤖 **Consultor MBR Intelligence (IA Gemini)**:
  - Análise estratégica de saúde financeira em tempo real.
  - Identificação de padrões de gastos e recomendações personalizadas.
  - Simulação de cenários financeiros com projeções inteligentes.

- 🛡️ **Painel Administrativo**:
  - Gestão completa de usuários (Administrador vs Usuário padrão).
  - Consulta de senhas salvas diretamente no perfil do usuário para facilidade de suporte.
  - Redefinição rápida de senhas e bloqueio/desbloqueio de acesso.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS.
- **Ícones**: Lucide React.
- **Gráficos**: Recharts.
- **Inteligência Artificial**: SDK Oficial `@google/genai` (Google Gemini 2.5 Flash / 3 Flash).

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn

### Passo a Passo

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/SEU_USUARIO/mbr-tracker.git
   cd mbr-tracker
   ```

2. **Instalar as Dependências**:
   ```bash
   npm install
   ```

3. **Configurar as Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Adicione sua chave de API do Gemini no arquivo `.env`:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```

4. **Iniciar o Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse no navegador: `http://localhost:3000` (ou a porta indicada no terminal).

5. **Gerar a Build de Produção**:
   ```bash
   npm run build
   ```

---

## 🔐 Credenciais Padrão para Testes

| Perfil | E-mail | Senha |
|---|---|---|
| **Administrador** | `admin@mbrtracker.com.br` | `admin123` |
| **Usuário Demonstração** | `usuario@mbrtracker.com.br` | `user123` |

---

## 📄 Licença

Este projeto foi desenvolvido exclusivamente para a **MBR TRACKER - Tecnologia Que Protege**.
