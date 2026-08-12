from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import socket
import re
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminhos dos arquivos de base de dados atualizados
EXCEL_FILE = "KBM72_-_Bar_Code_by_Invoice.xlsx"
IMPRESSORAS_FILE = "printer-config.xlsx"
IMPRESSORA_PORTA = 9100

class ImprimirRequest(BaseModel):
    impressora_ip: str 
    codigo_item: str
    nota: str
    quantidade: int
    zpl_formula: str
    tipo: str

def carregar_dados():
    """Carrega os dados das Notas Fiscais"""
    if not os.path.exists(EXCEL_FILE):
        return None
    try:
        df = pd.read_excel(EXCEL_FILE)
        return df.fillna("") 
    except Exception as e:
        print(f"Erro na leitura da nota: {e}")
        return None

def carregar_impressoras():
    """Carrega o cadastro de IPs das impressoras"""
    if not os.path.exists(IMPRESSORAS_FILE):
        return None
    try:
        df = pd.read_excel(IMPRESSORAS_FILE)
        return df.fillna("")
    except Exception as e:
        print(f"Erro ao ler planilha de impressoras: {e}")
        return None

@app.get("/api/impressora/{impressora_id}")
def buscar_impressora(impressora_id: str):
    impressora_limpa = impressora_id.strip().upper()
    
    # ESTRATÉGIA 1: O operador bipou diretamente o IP
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", impressora_limpa):
        return {"id": f"PRN-{impressora_limpa}", "ip": impressora_limpa, "status": "IP Direto"}

    # ESTRATÉGIA 2: Busca na planilha 'printer-config.xlsx'
    df_imp = carregar_impressoras()
    if df_imp is not None and not df_imp.empty:
        # Filtra a planilha procurando o Nome exato (ignorando espaços e minúsculas/maiúsculas)
        match = df_imp[df_imp['Nome'].astype(str).str.strip().str.upper() == impressora_limpa]
        if not match.empty:
            ip_cadastrado = str(match.iloc[0]['IP']).strip()
            return {"id": impressora_limpa, "ip": ip_cadastrado, "status": "Base Excel"}

    # ESTRATÉGIA 3: Fallback de rede (DNS corporativo)
    try:
        ip_resolvido = socket.gethostbyname(impressora_limpa)
        return {"id": impressora_limpa, "ip": ip_resolvido, "status": "DNS"}
    except socket.gaierror:
        pass 

    raise HTTPException(
        status_code=404, 
        detail="Impressora não encontrada. Cadastre na planilha 'printer-config.xlsx' ou bipe o IP diretamente."
    )

@app.get("/api/busca/{termo}")
def buscar_geral(termo: str):
    df = carregar_dados()
    if df is None:
        raise HTTPException(status_code=500, detail="Planilha de Notas não encontrada.")
    
    termo_limpo = termo.strip().upper()
    
    # BLINDAGEM 1: Remove espaços em branco invisíveis de todos os cabeçalhos do Excel
    df.columns = df.columns.str.strip()
    
    # BLINDAGEM 2: Busca garantida pela posição das colunas
    # Coluna A (Índice 0) = Número da Nota | Coluna E (Índice 4) = Novo Part Number
    match_nota = df[df.iloc[:, 0].astype(str).str.strip().str.upper() == termo_limpo]
    match_pn = df[df.iloc[:, 4].astype(str).str.strip().str.upper() == termo_limpo]
    
    # Mantém a busca no Short Item No caso ele ainda seja usado
    match_short = pd.DataFrame()
    if 'Short Item No' in df.columns:
        match_short = df[df['Short Item No'].astype(str).str.strip().str.upper() == termo_limpo]

    # Une tudo que encontrou
    df_resultado = pd.concat([match_nota, match_pn, match_short]).drop_duplicates()
    
    if df_resultado.empty:
        raise HTTPException(status_code=404, detail="Nenhuma Nota ou P/N encontrado no Excel.")
    
    tipo_busca = "NOTA" if not match_nota.empty else "ITEM"
    
    resultado = []
    for _, row in df_resultado.iterrows():
        
        # --- ALOCAÇÃO FÍSICA (Description Line 2) ---
        endereco_fisico = "N/A"
        if 'Description Line 2' in df.columns and pd.notna(row['Description Line 2']):
            endereco_fisico = str(row['Description Line 2']).strip()
        else:
            # Fallback caso tenham mudado o nome levemente no Excel
            for col in df.columns:
                if 'LINE 2' in str(col).upper() and pd.notna(row[col]):
                    endereco_fisico = str(row[col]).strip()
                    break

        # --- PART NUMBER (Coluna E - Índice 4) ---
        part_number_col_e = str(row.iloc[4]).strip()
        
        # --- CÓDIGO PRINCIPAL ---
        codigo_principal = str(row['Short Item No']).strip() if 'Short Item No' in df.columns else part_number_col_e
        
        # --- DESCRIÇÃO ---
        descricao = "Sem Descrição"
        if 'Description' in df.columns and pd.notna(row['Description']):
            descricao = str(row['Description']).strip()
            
        # --- QUANTIDADE ---
        qtd = 1
        if 'Quantity Received' in df.columns and pd.notna(row['Quantity Received']):
            qtd = int(row['Quantity Received'])
            
        # --- ZPL (Fórmula de Impressão) ---
        zpl = str(row['Formula']).strip() if 'Formula' in df.columns and pd.notna(row['Formula']) else ""
            
        resultado.append({
            "codigo": codigo_principal,
            "part_number": part_number_col_e,
            "descricao": descricao,
            "qtdOriginal": qtd,
            "volume": endereco_fisico,
            "zpl": zpl,
            "nota_origem": str(row.iloc[0]).strip() 
        })
        
    return {"termo": termo_limpo, "tipo": tipo_busca, "itens": resultado}

@app.post("/api/imprimir")
def imprimir_etiqueta(req: ImprimirRequest):
    # Remove caracteres fantasmas importados do Excel (como os '¨' da base original)
    zpl_original = req.zpl_formula.replace('¨', '') 
    
    # Determina quantas etiquetas físicas sairão da máquina
    if req.tipo == 'individual':
        qtd_print = req.quantidade
    else:
        qtd_print = 1 # Na impressão montante, sai apenas 1 etiqueta com tudo dentro
    
    # SUBSTITUIÇÃO INTELIGENTE DO MOLDE (ZPL)
    if re.search(r'\^PQ\d+', zpl_original):
        zpl_pronto = re.sub(r'\^PQ\d+', f'^PQ{qtd_print}', zpl_original)
    else:
        zpl_pronto = zpl_original.replace('^XZ', f'^PQ{qtd_print}^XZ')
    
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3)
            s.connect((req.impressora_ip, IMPRESSORA_PORTA))
            s.sendall(zpl_pronto.encode('utf-8'))
        return {"status": "sucesso"}
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Falha ao enviar dados para a impressora (IP: {req.impressora_ip}). Ela pode estar offline."
        )