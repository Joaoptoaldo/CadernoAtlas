# Fluxo de trabalho para agentes de IA

Este documento descreve o fluxo recomendado para agentes de IA trabalhando no CadernoAtlas, garantindo mudanças mínimas, verificáveis e alinhadas com os padrões do projeto.

## 1. Preparação

Antes de qualquer alteração:

```bash
# Confirmar localização e estado
git rev-parse --show-toplevel
git status --short
```

**Checklist:**
- [ ] Repositório confirmado
- [ ] Alterações preexistentes identificadas e documentadas
- [ ] `AGENTS.md` lido e compreendido
- [ ] Arquivos relevantes revisados

## 2. Análise do escopo

**Para cada tarefa:**

1. Identifique os arquivos envolvidos
2. Leia os arquivos existentes relacionados
3. Identifique os padrões de código já usados
4. Liste os testes existentes relacionados

**Perguntas norteadoras:**
- Esta funcionalidade já existe parcialmente?
- Quais padrões o projeto já usa para casos similares?
- Que testes cobrem funcionalidades relacionadas?
- A mudança afeta contratos públicos, banco de dados ou dependências?

## 3. Planejamento

**Para mudanças simples (< 3 arquivos, sem impacto arquitetural):**
- Proceda diretamente à implementação

**Para mudanças amplas ou estruturais:**
- Liste os arquivos afetados
- Descreva o motivo da mudança
- Identifique os impactos esperados
- Aguarde revisão antes de executar

**Sinais de que um plano é necessário:**
- Alteração de esquema do banco (migrations)
- Inclusão ou remoção de dependências
- Mudança em contratos de API públicos
- Refatoração que afeta múltiplos componentes
- Introdução de novos padrões arquiteturais

## 4. Implementação

**Princípios:**
- **Mudanças mínimas:** resolva apenas o problema solicitado
- **Coerência:** siga os padrões já existentes no código
- **Clareza:** prefira código direto a abstrações prematuras
- **Preservação:** não altere arquivos fora do escopo

**Durante a implementação:**
1. Faça uma mudança por vez
2. Mantenha o foco no requisito específico
3. Evite refatorações oportunistas
4. Não introduza padrões novos sem necessidade

## 5. Testes

### Estratégia de testes

**Para cada alteração de comportamento:**
1. Identifique os testes existentes relacionados
2. Execute-os antes de alterar o código (baseline)
3. Implemente a mudança
4. Adicione testes para o novo comportamento
5. Execute todos os testes relacionados

**Cobertura mínima:**
- Caminho feliz (caso de sucesso)
- Casos de validação (entrada inválida)
- Casos limite (boundary conditions)
- Integração com funcionalidades relacionadas

### Execução de testes

**Build:**
```bash
dotnet build .\CadernoAtlas.slnx
```

**Testes completos:**
```bash
dotnet test .\CadernoAtlas.slnx
```

**Testes filtrados:**
```bash
dotnet test .\CadernoAtlas.slnx --filter "FullyQualifiedName~NomeDoTeste"
```

**Verificações adicionais (quando aplicável):**
- Linters configurados no projeto
- Análise estática de código
- Verificação de migrations (sem aplicá-las)

### Interpretação de resultados

**Build bem-sucedido:**
- 0 erros
- 0 avisos (idealmente)
- Tempo de compilação registrado

**Testes bem-sucedidos:**
- 0 falharam
- 0 ignorados (investigar se houver)
- N aprovados (registrar quantidade)
- Duração registrada

**Em caso de falha:**
1. Leia a mensagem de erro completa
2. Identifique a causa raiz
3. Corrija o problema
4. Re-execute os testes
5. Não mascare erros nem ignore avisos

## 6. Validação final

Antes de concluir:

```bash
# Revisar mudanças
git diff --stat
git diff

# Confirmar escopo
git status --short
```

**Checklist de validação:**
- [ ] Build executado com sucesso
- [ ] Todos os testes passaram
- [ ] Diff revisado (sem alterações não relacionadas)
- [ ] Alterações preexistentes preservadas
- [ ] Nenhum arquivo fora do escopo modificado
- [ ] Nenhum segredo exposto

## 7. Relato

Ao concluir, informe:

1. **Mudanças realizadas:**
   - O que foi alterado
   - Por que foi alterado
   - Arquivos afetados

2. **Validação executada:**
   - Comando de build e resultado
   - Comando de testes e resultado
   - Quantidade de testes (aprovados/falhados/ignorados)

3. **Limitações ou pendências:**
   - O que não foi verificado
   - Riscos identificados
   - Etapas que dependem de aprovação

4. **Estado do repositório:**
   - Alterações preexistentes preservadas
   - Confirmação de que não houve commit/push

## 8. Antipadrões a evitar

❌ **Não faça:**
- Presumir que algo existe sem verificar
- Alterar arquivos fora do escopo solicitado
- Refatorar código não relacionado à tarefa
- Introduzir abstrações ou padrões desnecessários
- Marcar testes como executados sem executá-los
- Esconder avisos ou falhas de compilação
- Fazer commit ou push sem solicitação explícita
- Sobrescrever alterações preexistentes do usuário
- Executar comandos destrutivos sem aprovação
- Expor segredos em logs, código ou documentação

✅ **Faça:**
- Verificar o estado atual antes de implementar
- Seguir os padrões já existentes no código
- Fazer mudanças mínimas e focadas
- Executar build e testes após cada mudança
- Revisar o diff antes de concluir
- Relatar honestamente o que foi e o que não foi verificado
- Preservar alterações preexistentes
- Pedir aprovação para mudanças destrutivas ou estruturais

## 9. Fluxo resumido

```
┌─────────────────┐
│   Preparação    │ ← git status, ler AGENTS.md, revisar arquivos
└────────┬────────┘
         ↓
┌─────────────────┐
│     Análise     │ ← identificar escopo, padrões, testes existentes
└────────┬────────┘
         ↓
┌─────────────────┐
│  Planejamento   │ ← simples: prosseguir / complexo: aguardar revisão
└────────┬────────┘
         ↓
┌─────────────────┐
│ Implementação   │ ← mudanças mínimas, seguir padrões
└────────┬────────┘
         ↓
┌─────────────────┐
│     Testes      │ ← adicionar testes, executar suíte completa
└────────┬────────┘
         ↓
┌─────────────────┐
│    Validação    │ ← build, testes, revisar diff
└────────┬────────┘
         ↓
┌─────────────────┐
│     Relato      │ ← mudanças, validação, limitações, estado
└─────────────────┘
```

## 10. Exemplo prático

**Tarefa:** adicionar filtro de prazo em endpoint de listagem

**1. Preparação:**
```bash
git status --short  # confirmar alterações preexistentes
```

**2. Análise:**
- Endpoint: `GET /api/demandas-academicas`
- Controller: `DemandasAcademicasController.cs`
- Testes: `DemandasAcademicasTests.cs`
- Padrão existente: filtros opcionais via query string

**3. Planejamento:**
Mudança simples, 2 arquivos (controller + testes), sem impacto arquitetural → prosseguir

**4. Implementação:**
- Adicionar parâmetro `prazoAte` no método `Listar`
- Validar formato de data
- Aplicar filtro condicionalmente

**5. Testes:**
- Adicionar teste: filtro por prazo (sucesso)
- Adicionar teste: filtro por prazo inclusivo
- Adicionar teste: data inválida (HTTP 400)

**6. Validação:**
```bash
dotnet build .\CadernoAtlas.slnx      # ✓ 0 erros
dotnet test .\CadernoAtlas.slnx       # ✓ 64 aprovados, 0 falhados
git diff --stat                        # 2 arquivos alterados
```

**7. Relato:**
- Filtro por prazo implementado em `DemandasAcademicasController`
- 3 testes adicionados em `DemandasAcademicasTests`
- Build: sucesso (0 erros, 0 avisos)
- Testes: 64 aprovados, 0 falhados
- Alterações preexistentes preservadas
- Nenhum commit realizado
