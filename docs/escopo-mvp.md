# Escopo do MVP expandido - CadernoAtlas

## 1. Objetivo

Evoluir o CadernoAtlas de uma ferramenta de organização de concursos
e editais para uma plataforma de organização e planejamento acadêmico
adaptativo.

O sistema deve ajudar o estudante a centralizar suas obrigações,
dividir atividades complexas em etapas executáveis e acompanhar
o que precisa ser feito.

O planejamento deve considerar as limitações reais do estudante,
sem presumir disponibilidade ilimitada ou culpabilizar o usuário
quando os planos precisarem mudar.

## 2. Funcionalidades existentes

- Cadastro e gerenciamento de concursos.
- Cadastro e gerenciamento de cadernos de estudo.
- Cadastro e gerenciamento de disciplinas vinculadas a concursos.
- Cadastro e gerenciamento de tópicos e subtópicos de edital.
- Acompanhamento do status de estudo dos tópicos.

Essas funcionalidades devem ser preservadas.

## 3. Primeira entrega: demandas acadêmicas

O sistema permitirá cadastrar, consultar e atualizar demandas
acadêmicas, como provas, trabalhos, atividades de APG e tarefas de TCC.

Cada demanda terá:

- Identificador.
- Título.
- Descrição opcional.
- Tipo.
- Prazo opcional.
- Importância.
- Esforço estimado opcional, em minutos.
- Situação.
- Data de criação.

Tipos iniciais: Prova, Trabalho, APG, TCC e Outro.

Importâncias iniciais: Baixa, Média e Alta.

Situações iniciais: Pendente, EmAndamento, Concluida e Cancelada.

## 4. Tarefas de uma demanda

Uma demanda poderá conter várias tarefas. Cada tarefa pertencerá
a uma única demanda.

Cada tarefa terá:

- Identificador.
- Identificador da demanda.
- Título.
- Descrição opcional.
- Ordem.
- Situação.

Situações iniciais das tarefas: Pendente, EmAndamento e Concluida.

As tarefas servirão para transformar uma obrigação ampla em
ações menores e concretas.

## 5. Regras iniciais

- Uma demanda não exige vínculo com concurso ou caderno.
- O esforço estimado será armazenado em minutos.
- Valores desconhecidos de prazo ou esforço poderão ficar vazios.
- O esforço estimado, quando informado, não poderá ser negativo.
- Cada tarefa deverá referenciar uma demanda existente.
- A ordem das tarefas deverá ser um número não negativo.
- A exclusão de uma demanda deverá excluir suas tarefas vinculadas.
- Uma demanda com tarefas pendentes ou em andamento não poderá
  ser marcada como concluída.
- Os status não deverão ser atualizados automaticamente nesta
  primeira versão.
- Os valores das situações e dos tipos deverão ser validados
  pela API.

## 6. Fora do escopo desta primeira entrega

- Algoritmo automático de priorização.
- Planejamento semanal e replanejamento adaptativo.
- Atividades recorrentes e geração automática de ocorrências.
- Inteligência artificial.
- Autenticação e contas de usuários.
- Dashboard e interface visual do módulo.

Esses recursos poderão ser desenvolvidos posteriormente,
depois da validação do fluxo básico.

## 7. Critérios de conclusão da primeira entrega

- Criar e consultar demandas.
- Atualizar uma demanda existente.
- Criar tarefas vinculadas a uma demanda.
- Consultar e atualizar tarefas.
- Retornar NotFound para recursos inexistentes.
- Validar entradas inválidas.
- Garantir consistência entre demandas e tarefas.
- Criar uma migration revisada do Entity Framework Core.
- Executar o build e os testes automatizados.
- Verificar as alterações no Git sem descartar trabalho existente.
