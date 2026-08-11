import openpyxl

EXCEL_PATH = "excel_db.xlsx"

def buscar_item_por_codigo(codigo: str):
    """Lê a planilha preservando a estrutura original"""
    try:
        # Carrega o workbook garantindo que não estamos criando um novo em branco
        wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
        ws = wb.active
        
        # Supondo colunas: A=Codigo, B=Descricao, C=Quantidade, D=Volume
        for row in ws.iter_rows(min_row=2, values_only=True):
            if str(row[0]) == codigo:
                return {
                    "codigo": row[0],
                    "descricao": row[1],
                    "quantidade": row[2],
                    "volume": row[3]
                }
        return None
    except FileNotFoundError:
        return {"erro": "Planilha não encontrada."}