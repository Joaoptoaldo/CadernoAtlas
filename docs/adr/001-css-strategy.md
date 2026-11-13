# ADR 001: Estratégia de CSS - Convivência Bootstrap + Legado

## Contexto

O projeto CadernoAtlas iniciou com um CSS customizado ("legado") baseado em classes utilitárias próprias (`.button`, `.panel`, `.form-field`, `.eyebrow`, `.content-grid`, etc.). Com a evolução da interface, adotamos o **Bootstrap 5.3** como base visual para novos componentes (Dashboard, ConfirmActionModal), aproveitando seu sistema de design (grid, utilitários, componentes prontos) e capacidade de theming via CSS Variables.

A migração total do CSS legado para Bootstrap seria de alto custo e risco (regressão visual, reteste de todos os componentes). Portanto, optamos por uma **convivência controlada** das duas abordagens.

## Decisão

1. **Novos componentes** devem usar **classes Bootstrap** (`.btn`, `.card`, `.row`, `.col-*`, `.table`, `.modal`, `.progress`, `.badge`, `.form-control`, `.form-select`, etc.) e o **tema unificado** definido em `src/index.css` via variáveis CSS `--bs-*`.

2. **Componentes legados** permanecem com suas classes atuais (`.button`, `.panel`, `.form-field`, `.study-session-card`, `.panel-heading`, `.eyebrow`, etc.). A migração ocorrerá **sob demanda** (quando o componente for alterado por outro motivo).

3. **Tema unificado** (`src/index.css`):
   - Define `--bs-primary`, `--bs-danger`, `--bs-secondary`, `--bs-success`, `--bs-info`, `--bs-warning` com a paleta do CadernoAtlas (verde `#2d776d`, terracota `#b46051`, etc.).
   - Sobrescreve componentes Bootstrap via **class-based CSS variables** (`.btn-primary { --bs-btn-bg: ... }`, `.progress-bar { --bs-progress-bar-bg: ... }`, `.form-control { --bs-form-control-border-color: ... }`), conforme documentação Bootstrap 5.3+.
   - **Zero cores hardcoded** (`#0d6efd`, `red`, etc.) no código.

4. **Bootstrap CSS** é importado oficialmente via `import 'bootstrap/dist/css/bootstrap.min.css'` em `main.tsx` (antes do `index.css`). O `index.css` define o **tema unificado** sobrescrevendo variáveis CSS `--bs-*` e usando class-based CSS variables para personalizar componentes Bootstrap. **Não** importar `bootstrap.min.js` — usamos componentes React nativos para modais, dropdowns, etc.

5. **Migração futura** (sob demanda):
   - Ao alterar um componente legado, avaliar se vale migrar para Bootstrap na mesma PR.
   - Critério: se o componente toca >50% do seu CSS, migrar; senão, manter legado.
   - Objetivo de longo prazo: unificar 100% em Bootstrap, mas sem prazo fixo.

## Consequências

### Positivas
- **Velocidade:** Novos componentes (Dashboard, ConfirmActionModal) entregues rápido com Bootstrap.
- **Consistência visual:** Tema unificado garante que cores, bordas, sombras, espaçamentos sejam iguais entre Bootstrap e legado.
- **Baixo risco:** Não há "big bang" de migração; regressões visuais contidas.
- **Bundle size controlado:** CSS do Bootstrap embutido no `index.css` (~261 kB min / 38 kB gzip) — aceitável para MVP.

### Negativas
- **Duas linguagens CSS:** Devs precisam conhecer ambas (Bootstrap + legado).
- **Manutenção dual:** Correções de bug podem precisar tocar dois "mundos".
- **Bundle CSS maior:** Bootstrap completo incluído mesmo onde não usado (tree-shaking de CSS não trivial no Vite).

## Alternativas Consideradas

| Alternativa | Por que não |
|---|---|
| Migração total "big bang" | Alto risco, alto custo, sem valor de negócio imediato. |
| Tailwind CSS / UnoCSS | Mudança de paradigma grande; equipe já conhece Bootstrap. |
| CSS Modules / Styled Components | Adiciona complexidade de build; Bootstrap já resolve design system. |
| Remover Bootstrap e usar só legado | Perde componentes prontos (modal, grid responsivo, progress, table). |

## Implementação

- `main.tsx`: Importa `bootstrap/dist/css/bootstrap.min.css` antes do `index.css`.
- `src/index.css`: Variáveis `--bs-*` (cores, bordas, corpo) + sobrescritas class-based (`.btn-primary`, `.btn-danger`, `.btn-secondary`, `.btn-outline-secondary`, `.progress-bar`, `.form-control`, `.form-select`, `a`, `.alert-danger`, `.alert-warning`).
- Novos componentes (`Dashboard.tsx`, `ConfirmActionModal.tsx`, `SessionConfirmModal.tsx`, `StatusMessage.tsx`) usam classes Bootstrap (`.alert`, `.card`, `.row`, `.col-*`, `.table`, `.progress`, `.badge`, `.form-control`, `.form-select`, `.btn`, `.modal`).
- Componentes legados (`StudySessionsPanel.tsx`, `StudySessionDetail.tsx`, `ManageDemandsPanel.tsx`, etc.) mantêm classes legadas.
- `StatusMessage.tsx` adaptado para usar `.alert`, `.alert-danger`, `.alert-warning` com tema unificado; CSS customizado apenas para composição (ícones, espaçamento, variante compacta).

## Revisão

Este ADR deve ser revisado quando:
- A cobertura Bootstrap > 80% dos componentes.
- Surgir necessidade de tree-shaking CSS sério (ex.: bundle > 150 kB gzip).
- Decisão de adotar outro design system (ex.: shadcn/ui, Radix + Tailwind).
