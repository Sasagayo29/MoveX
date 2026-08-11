# 📦 KINROSS MOVIMEX (MoveX)

**MoveX** é uma aplicação web industrial desenvolvida para uso em coletores de dados e dispositivos móveis, com foco na operação com impressoras **Zebra ZQ521** e **Zebra ZQ511**.

O sistema permite consultar **Notas Fiscais**, **Códigos de Peças (Part Numbers)** e informações de materiais diretamente a partir de uma base de dados em Excel. Também permite realizar a impressão de etiquetas utilizando **ZPL**, através de comunicação TCP/IP direta com as impressoras Zebra.

---

## ✨ Principais Funcionalidades

### 🖨️ Conexão Dinâmica de Impressoras

Permite conectar o coletor a qualquer impressora disponível na operação através de:

* Leitura do IP da impressora via código de barras.
* Nome da impressora na rede (DNS).
* Consulta à base de impressoras cadastradas.
* Comunicação TCP/IP direta com a impressora.

A comunicação de impressão utiliza a **porta TCP 9100**.

---

### 🔍 Busca Cega — Fast Track

O operador pode bipar diretamente um **Part Number (P/N)** na tela inicial.

Quando existe apenas uma correspondência para o código informado, o sistema:

1. Identifica automaticamente o material.
2. Ignora a tela de listagem.
3. Direciona o operador diretamente para a tela de impressão.

Isso reduz a quantidade de interações necessárias durante a operação.

---

### 📄 Leitura de Base em Excel

O backend realiza a leitura nativa de arquivos **`.xlsx`**, permitindo que a operação utilize planilhas Excel como fonte de dados.

Essa abordagem elimina a necessidade de migrações complexas para bancos de dados relacionais para a rotina operacional.

As principais bibliotecas utilizadas são:

* **Pandas**
* **OpenPyXL**

---

### 💉 Injeção Dinâmica de ZPL

O sistema utiliza a fórmula **ZPL** armazenada na base Excel.

Antes do envio para a impressora, o backend realiza a injeção dinâmica da quantidade de etiquetas solicitada pelo operador através do comando:

```zpl
^PQ
```

Exemplo:

```zpl
^PQ10
```

Nesse caso, a impressora será instruída a produzir **10 etiquetas**.

---

### 📱 Interface Industrial

A interface foi desenvolvida pensando nas condições de uso de um ambiente industrial.

Características:

* React + Vite.
* Tailwind CSS.
* Layout responsivo.
* Áreas de toque grandes.
* Interface adequada para operação com luvas.
* Elementos visuais de fácil identificação.
* Minimização de rolagem.
* Layout otimizado para telas de coletores.
* Fluxo operacional simplificado.

---

# 🛠️ Tecnologias Utilizadas

## Frontend

| Tecnologia   | Utilização                          |
| ------------ | ----------------------------------- |
| React        | Desenvolvimento da interface        |
| Vite         | Build e ambiente de desenvolvimento |
| Tailwind CSS | Estilização e layout responsivo     |

---

## Backend

| Tecnologia | Utilização                                |
| ---------- | ----------------------------------------- |
| Python 3.x | Linguagem principal                       |
| FastAPI    | API REST                                  |
| Pandas     | Manipulação dos dados Excel               |
| OpenPyXL   | Leitura e manipulação de arquivos `.xlsx` |
| Sockets    | Comunicação TCP/IP com impressoras        |

---

# 📁 Estrutura de Dados

O sistema depende de duas planilhas Excel localizadas na pasta:

```text
backend/service/
```

## 1. Base de Itens e Notas Fiscais

Arquivo:

```text
KBM72_-_Bar_Code_by_Invoice.xlsx
```

A planilha deve conter as seguintes colunas:

| Coluna                       | Descrição                            |
| ---------------------------- | ------------------------------------ |
| `Número do Documento Fiscal` | Número da Nota Fiscal                |
| `Short Item No`              | Part Number / código do item         |
| `Description `               | Descrição do material                |
| `Description Line 2`         | Informações adicionais do material   |
| `Quantity Received`          | Quantidade recebida                  |
| `Formula`                    | Fórmula ZPL utilizada para impressão |

> **Observação:** Os nomes das colunas devem ser mantidos exatamente conforme definidos na planilha utilizada pela aplicação.

---

## 2. Base de Impressoras

Arquivo:

```text
printer-config.xlsx
```

A planilha deve conter:

| Coluna | Descrição                 | Exemplo                  |
| ------ | ------------------------- | ------------------------ |
| `Nome` | Nome da impressora        | `PTU-PRN-LABEL-MOVEL-03` |
| `IP`   | Endereço IP da impressora | `10.205.X.X`             |

Exemplo:

| Nome                   | IP         |
| ---------------------- | ---------- |
| PTU-PRN-LABEL-MOVEL-01 | 10.205.X.X |
| PTU-PRN-LABEL-MOVEL-02 | 10.205.X.X |
| PTU-PRN-LABEL-MOVEL-03 | 10.205.X.X |

---

# 📂 Estrutura do Projeto

Uma estrutura esperada para o projeto é:

```text
KINROSS-MOVIMEX/
│
├── backend/
│   └── service/
│       ├── main.py
│       ├── requirements.txt
│       ├── KBM72_-_Bar_Code_by_Invoice.xlsx
│       └── printer-config.xlsx
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── ...
│
└── README.md
```

---

# 🚀 Instalação e Execução

## Pré-requisitos

Antes de executar o projeto, certifique-se de possuir:

* Python 3.x
* Node.js
* npm
* Acesso à rede das impressoras Zebra
* Impressoras Zebra ZQ511 ou ZQ521
* Arquivos Excel necessários para a operação

---

# 🐍 Backend

Entre na pasta do backend:

```bash
cd backend/service
```

Instale as dependências:

```bash
pip install -r requirements.txt
```

Inicie o servidor FastAPI:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

O backend estará disponível na porta:

```text
8001
```

O parâmetro:

```text
--host 0.0.0.0
```

permite que o serviço seja acessado por outros dispositivos da rede.

---

# ⚛️ Frontend

Abra outro terminal e entre na pasta do frontend:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

O Vite irá disponibilizar a aplicação no endereço apresentado no terminal.

---

# 📖 Fluxo de Operação

## 1. 🖨️ Vinculação da Impressora

Na tela inicial, o operador deve bipar o identificador da impressora Zebra que será utilizada.

O sistema pode trabalhar com:

* IP da impressora;
* Nome DNS;
* Impressora cadastrada na base `printer-config.xlsx`.

Após identificar a impressora, o sistema realiza a validação da comunicação.

---

## 2. 🔎 Consulta do Material

O operador pode realizar a consulta de duas formas.

### Consulta por Nota Fiscal

Bipe o número da **Nota Fiscal**.

O sistema irá localizar os materiais associados à nota e apresentar a lista de itens disponíveis.

### Consulta por Part Number

Bipe diretamente o **Part Number (P/N)**.

Caso exista somente uma correspondência, o sistema utiliza o fluxo **Fast Track** e direciona o operador diretamente para a impressão.

---

## 3. 📋 Seleção do Material

Quando houver mais de uma correspondência, o operador deverá selecionar o material desejado.

As informações apresentadas podem incluir:

* Part Number;
* Descrição;
* Descrição complementar;
* Quantidade recebida;
* Número da Nota Fiscal.

---

## 4. 🏷️ Impressão

Após selecionar o material, o sistema apresenta a tela de impressão.

O operador deverá:

1. Confirmar o endereço físico.
2. Informar a quantidade desejada.
3. Ajustar o volume utilizando os controles de incremento/decremento.
4. Selecionar o tipo de impressão.
5. Confirmar a impressão.

---

## 🖨️ Tipos de Impressão

O sistema suporta diferentes modos de impressão, incluindo:

### Individual

Realiza a impressão das etiquetas individualmente conforme a quantidade solicitada.

### Montante

Utiliza o fluxo de impressão em montante conforme a regra operacional definida para o material.

---

# 🌐 Comunicação com a Impressora

A comunicação com as impressoras Zebra é realizada diretamente através de **TCP/IP**.

A porta padrão utilizada é:

```text
9100
```

Fluxo simplificado:

```text
┌───────────────┐
│   Coletor     │
│   / Browser   │
└───────┬───────┘
        │
        │ HTTP
        ▼
┌───────────────┐
│   FastAPI     │
│    Backend    │
└───────┬───────┘
        │
        │ TCP/IP :9100
        ▼
┌───────────────┐
│ Zebra ZQ511   │
│ Zebra ZQ521   │
└───────────────┘
```

O backend recebe a solicitação de impressão, processa a fórmula ZPL e envia o conteúdo diretamente para a impressora.

---

# 🧾 Fluxo do ZPL

A fórmula ZPL é armazenada na coluna:

```text
Formula
```

da planilha:

```text
KBM72_-_Bar_Code_by_Invoice.xlsx
```

Durante a impressão, o backend pode alterar dinamicamente a quantidade através do comando:

```zpl
^PQ
```

Exemplo:

```zpl
^XA
...
^PQ5
^XZ
```

Nesse exemplo, a impressora deverá produzir cinco etiquetas.

---

# 🔄 Fluxo Geral da Aplicação

```text
                    ┌──────────────────┐
                    │      COLETOR     │
                    └────────┬─────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Identificar         │
                  │ Impressora          │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │ Consultar NF ou     │
                  │ Part Number         │
                  └──────────┬──────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              ┌───────────┐     ┌────────────┐
              │ Única     │     │ Múltiplas  │
              │ ocorrência│     │ ocorrências│
              └─────┬─────┘     └──────┬─────┘
                    │                  │
                    │                  ▼
                    │            ┌────────────┐
                    │            │ Selecionar │
                    │            │ material   │
                    │            └──────┬─────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌─────────────────────┐
                    │ Tela de impressão   │
                    │                     │
                    │ • Endereço físico   │
                    │ • Quantidade        │
                    │ • Tipo de impressão │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Gerar / ajustar ZPL │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ TCP/IP - Porta 9100 │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Impressora Zebra    │
                    │ ZQ511 / ZQ521       │
                    └─────────────────────┘
```

---

# 🧪 Teste de Comunicação

Para validar a conectividade com uma impressora, é necessário garantir que o dispositivo que executa o backend consiga alcançar o IP da Zebra na porta:

```text
9100
```

Exemplo conceitual:

```text
Coletor → Backend → IP da Zebra:9100
```

A comunicação depende da infraestrutura de rede e das regras de firewall existentes na operação.

---

# 🛡️ Licença e Governança

O **KINROSS MOVIMEX (MoveX)** foi desenvolvido para uso interno em operações logísticas da:

**Kinross Gold Corporation**

O sistema, seus códigos, configurações, bases de dados e componentes relacionados devem ser tratados de acordo com as políticas internas de segurança, governança e propriedade intelectual da organização.

---

# ⚠️ Considerações Operacionais

Para o funcionamento adequado do sistema:

* As planilhas Excel devem estar disponíveis no diretório esperado pelo backend.
* Os nomes das colunas devem permanecer compatíveis com o código da aplicação.
* As impressoras devem estar acessíveis pela rede.
* A porta TCP `9100` deve estar liberada entre o backend e as impressoras.
* Os endereços IP cadastrados devem estar atualizados.
* As fórmulas ZPL devem ser compatíveis com as impressoras utilizadas.
* O dispositivo deve possuir conectividade com o servidor onde o backend está sendo executado.

---

# 🔐 Segurança

Por se tratar de uma aplicação utilizada em ambiente industrial, recomenda-se considerar:

* Controle de acesso à aplicação.
* Restrição de acesso ao backend pela rede.
* Validação dos arquivos Excel.
* Logs das operações de impressão.
* Tratamento de erros de comunicação.
* Timeout para conexões TCP.
* Monitoramento da disponibilidade das impressoras.
* Controle de permissões no servidor.
* Backup das bases Excel.
* Proteção das informações operacionais.

---

# 📌 Resumo

O **KINROSS MOVIMEX (MoveX)** fornece um fluxo simplificado para consulta de materiais e impressão de etiquetas diretamente a partir de coletores industriais.

```text
Excel
  │
  ▼
FastAPI
  │
  ├── Consulta NF
  ├── Consulta Part Number
  ├── Fast Track
  ├── Processamento ZPL
  └── Comunicação TCP/IP
          │
          ▼
     Zebra ZQ511
     Zebra ZQ521
```

A solução combina **React, FastAPI, Python, Excel, ZPL e comunicação TCP/IP**, permitindo uma operação simples e rápida em ambientes logísticos industriais.
