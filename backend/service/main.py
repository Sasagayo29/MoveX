import os
import re
import socket
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# BLINDAGEM DE DIRETÓRIO: Sempre procura na mesma pasta onde este script está salvo!
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE = os.path.join(BASE_DIR, "KBM72_-_Bar_Code_by_Invoice.xlsx")
IMPRESSORAS_FILE = os.path.join(BASE_DIR, "printer-config.xlsx")
IMPRESSORA_PORTA = 9100

class ImprimirRequest(BaseModel):
    impressora_ip: str 
    codigo_item: str
    nota: str
    quantidade: int
    zpl_formula: str
    tipo: str

def carregar_dados():
    if not os.path.exists(EXCEL_FILE):
        return None
    try:
        return pd.read_excel(EXCEL_FILE).fillna("") 
    except Exception:
        return None

def carregar_impressoras():
    if not os.path.exists(IMPRESSORAS_FILE):
        return None
    try:
        return pd.read_excel(IMPRESSORAS_FILE).fillna("")
    except Exception:
        return None

@app.get("/api/impressora/{impressora_id}")
def buscar_impressora(impressora_id: str):
    impressora_limpa = impressora_id.strip().upper()
    
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", impressora_limpa):
        return {"id": f"PRN-{impressora_limpa}", "ip": impressora_limpa, "status": "IP Direto"}

    df_imp = carregar_impressoras()
    if df_imp is not None and not df_imp.empty:
        match = df_imp[df_imp['Nome'].astype(str).str.strip().str.upper() == impressora_limpa]
        if not match.empty:
            ip_cadastrado = str(match.iloc[0]['IP']).strip()
            return {"id": impressora_limpa, "ip": ip_cadastrado, "status": "Base Excel"}

    try:
        ip_resolvido = socket.gethostbyname(impressora_limpa)
        return {"id": impressora_limpa, "ip": ip_resolvido, "status": "DNS"}
    except socket.gaierror:
        pass 

    raise HTTPException(status_code=404, detail="Impressora não encontrada. Cadastre na planilha ou bipe o IP.")

@app.get("/api/busca/{termo}")
def buscar_geral(termo: str):
    df = carregar_dados()
    if df is None:
        raise HTTPException(status_code=500, detail="Planilha de Notas não encontrada.")
    
    termo_limpo = termo.strip().upper()
    df.columns = df.columns.str.strip()
    
    match_nota = df[df.iloc[:, 0].astype(str).str.strip().str.upper() == termo_limpo]
    match_pn = df[df.iloc[:, 4].astype(str).str.strip().str.upper() == termo_limpo]
    
    match_short = pd.DataFrame()
    if 'Short Item No' in df.columns:
        match_short = df[df['Short Item No'].astype(str).str.strip().str.upper() == termo_limpo]

    df_resultado = pd.concat([match_nota, match_pn, match_short]).drop_duplicates()
    
    if df_resultado.empty:
        raise HTTPException(status_code=404, detail="Nenhuma Nota ou P/N encontrado no Excel.")
    
    tipo_busca = "NOTA" if not match_nota.empty else "ITEM"
    
    resultado = []
    for _, row in df_resultado.iterrows():
        endereco_fisico = "N/A"
        if 'Description Line 2' in df.columns and pd.notna(row['Description Line 2']):
            endereco_fisico = str(row['Description Line 2']).strip()
        else:
            for col in df.columns:
                if 'LINE 2' in str(col).upper() and pd.notna(row[col]):
                    endereco_fisico = str(row[col]).strip()
                    break

        part_number_col_e = str(row.iloc[4]).strip()
        codigo_principal = str(row['Short Item No']).strip() if 'Short Item No' in df.columns else part_number_col_e
        
        descricao = str(row['Description']).strip() if 'Description' in df.columns and pd.notna(row['Description']) else "Sem Descrição"
            
        qtd = 1
        if 'Quantity Received' in df.columns and pd.notna(row['Quantity Received']):
            val = str(row['Quantity Received']).strip()
            if val:
                try:
                    qtd = int(float(val))
                except ValueError:
                    qtd = 1
            
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
    zpl_original = req.zpl_formula.replace('¨', '') 
    qtd_print = req.quantidade if req.tipo == 'individual' else 1
    
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
    except Exception:
        raise HTTPException(
            status_code=500, 
            detail=f"Falha ao enviar dados para {req.impressora_ip}."
        )

@app.get("/api/sync")
def sincronizar_banco_offline():
    try:
        df_dados = carregar_dados()
        if df_dados is None:
            # Em vez de 500 generico, envia erro 404 claro com o caminho exigido
            raise HTTPException(status_code=404, detail=f"ERRO: Planilha ausente em {EXCEL_FILE}")

        df_dados.columns = df_dados.columns.str.strip()
        lista_itens = []
        
        for _, row in df_dados.iterrows():
            try:
                nota_origem = str(row.iloc[0]).strip() if len(df_dados.columns) > 0 else ""
                part_number = str(row.iloc[4]).strip() if len(df_dados.columns) > 4 else ""
                codigo = str(row['Short Item No']).strip() if 'Short Item No' in df_dados.columns else part_number
                
                descricao = str(row['Description']).strip() if 'Description' in df_dados.columns and pd.notna(row['Description']) else "Sem Descrição"
                
                endereco_fisico = "N/A"
                if 'Description Line 2' in df_dados.columns and pd.notna(row['Description Line 2']):
                    endereco_fisico = str(row['Description Line 2']).strip()
                    
                qtd = 1
                if 'Quantity Received' in df_dados.columns:
                    val = str(row['Quantity Received']).strip()
                    if val:
                        try:
                            qtd = int(float(val))
                        except ValueError:
                            pass
                
                zpl = str(row['Formula']).strip() if 'Formula' in df_dados.columns and pd.notna(row['Formula']) else ""
                
                lista_itens.append({
                    "codigo": codigo,
                    "part_number": part_number,
                    "descricao": descricao,
                    "qtdOriginal": qtd,
                    "volume": endereco_fisico,
                    "zpl": zpl,
                    "nota_origem": nota_origem,
                    "busca_global": f"{nota_origem} {part_number} {codigo}".upper() 
                })
            except Exception as row_err:
                continue

        df_imp = carregar_impressoras()
        lista_impressoras = []
        if df_imp is not None and not df_imp.empty:
            for _, row in df_imp.iterrows():
                mac = str(row['MAC']).strip() if 'MAC' in df_imp.columns and pd.notna(row['MAC']) else ""
                ip = str(row['IP']).strip() if 'IP' in df_imp.columns and pd.notna(row['IP']) else ""
                nome = str(row['Nome']).strip() if 'Nome' in df_imp.columns and pd.notna(row['Nome']) else ""
                
                lista_impressoras.append({
                    "id": nome.upper(),
                    "ip": ip,
                    "mac": mac,
                    "busca_global": f"{nome} {ip} {mac}".upper()
                })

        return {"status": "sucesso", "impressoras": lista_impressoras, "itens": lista_itens}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro Crítico de Leitura no Servidor: {str(e)}")