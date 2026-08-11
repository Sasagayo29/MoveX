import socket

def imprimir_etiqueta(ip_impressora: str, dados_item: dict, tipo: str):
    # Layout ZPL básico (ajuste conforme o tamanho da etiqueta)
    zpl = f"""
    ^XA
    ^FO50,50^A0N,40,40^FD{dados_item['descricao']}^FS
    ^FO50,110^A0N,30,30^FDQtd: {dados_item['quantidade']} | Vol: {dados_item['volume']}^FS
    ^FO50,160^BCN,80,Y,N,N^FD{dados_item['codigo']}^FS
    ^XZ
    """
    
    # Conexão TCP padrão de impressoras Zebra
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3)
            s.connect((ip_impressora, 9100))
            s.sendall(zpl.encode('utf-8'))
        return True
    except Exception as e:
        print(f"Erro na impressão: {e}")
        return False