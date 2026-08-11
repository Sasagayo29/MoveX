import subprocess
import json

class PrintEngine:
    @staticmethod
    def listar_impressoras(servidor, filtro="PTU-PRN-LABEL-MOVEL"):
        """
        Consulta o servidor especificado filtrando exclusivamente pela impressora PTU-PRN-LABEL-MOVEL.
        """
        # O filtro agora está fixado na impressora alvo.
        script_block = (
            f"Get-Printer -Name '{filtro}' -ErrorAction SilentlyContinue | ForEach-Object {{ "
            "[PSCustomObject]@{ "
            "Name=[string]$_.Name; "
            "PrinterStatus=[string]$_.PrinterStatus; "
            "JobCount=[int]$_.JobCount; "
            "PortName=[string]$_.PortName; "
            "Location=[string]$_.Location; "
            "Comment=[string]$_.Comment; "
            "DriverName=[string]$_.DriverName "
            "} }"
        )
        cmd = f"Invoke-Command -ComputerName '{servidor}' -ScriptBlock {{ {script_block} | ConvertTo-Json -Compress -Depth 5 }}"
        return PrintEngine._rodar_ps(cmd, servidor, "Listar (WinRM)")

    @staticmethod
    def buscar_recursos_impressora(servidor, fila):
        script_block = (
            f"Get-PrintConfiguration -PrinterName '{fila}' -ErrorAction SilentlyContinue | ForEach-Object {{ "
            "[PSCustomObject]@{ "
            "Color=[string]$_.Color; "
            "DuplexingMode=[string]$_.DuplexingMode "
            "} }}"
        )
        cmd = f"Invoke-Command -ComputerName '{servidor}' -ScriptBlock {{ {script_block} }} | ConvertTo-Json -Compress"
        return PrintEngine._rodar_ps(cmd, servidor, f"Recursos: {fila}")

    @staticmethod
    def buscar_detalhes_impressora(servidor, fila):
        script_block = (
            f"$p = Get-Printer -Name '{fila}' -ErrorAction SilentlyContinue; "
            f"if (-not $p) {{ return @{{}} | ConvertTo-Json -Compress }}; "
            
            f"$c = Get-PrintConfiguration -PrinterName '{fila}' -ErrorAction SilentlyContinue; "
            f"$pn = $p.PortName; "
            
            f"$w = Get-CimInstance -ClassName Win32_TCPIPPrinterPort -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -eq $pn }}; "
            f"$t = Get-PrinterPort -Name $pn -ErrorAction SilentlyContinue; "
            
            f"$ip = ''; "
            f"if ($w -and $w.HostAddress) {{ $ip = $w.HostAddress }} "
            f"elseif ($t -and $t.PrinterHostAddress) {{ $ip = $t.PrinterHostAddress }} "
            f"elseif ($pn -match '\\b\\d{{1,3}}\\.\\d{{1,3}}\\.\\d{{1,3}}\\.\\d{{1,3}}\\b') {{ $ip = $Matches[0] }} "
            f"else {{ $ip = $pn }}; "
            
            f"$res = [PSCustomObject]@{{ "
            f"Color = [string]$c.Color; "
            f"Duplex = [string]$c.DuplexingMode; "
            f"IP = [string]$ip; "
            f"Proto = if($w){{[string]$w.Protocol}}else{{''}}; "
            f"Port = if($w){{[string]$w.PortNumber}}else{{''}}; "
            f"Queue = if($w){{[string]$w.Queue}}else{{''}}; "
            f"ByteCount = if($w){{[string]$w.ByteCount}}else{{''}}; "
            f"SNMP = if($w){{[string]$w.SNMPEnabled}}else{{''}}; "
            f"Community = if($w){{[string]$w.SNMPCommunity}}else{{''}}; "
            f"Index = if($w){{[string]$w.SNMPDevIndex}}else{{''}}; "
            f"Monitor = [string]$t.PortMonitor "
            f"}}; "
            
            f"$res | ConvertTo-Json -Compress"
        )
        
        cmd = f"Invoke-Command -ComputerName '{servidor}' -ScriptBlock {{ {script_block} }}"
        return PrintEngine._rodar_ps(cmd, servidor, f"Detalhes Impressora: {fila}")

    @staticmethod
    def limpar_fila(servidor, nome_impressora):
        cmd = f"Invoke-Command -ComputerName '{servidor}' -ScriptBlock {{ Get-PrintJob -PrinterName '{nome_impressora}' -ErrorAction SilentlyContinue | Remove-PrintJob }}"
        return PrintEngine._rodar_ps(cmd, servidor, f"Limpar Fila: {nome_impressora}")

    @staticmethod
    def reiniciar_spooler(servidor):
        cmd = f"Invoke-Command -ComputerName '{servidor}' -ScriptBlock {{ Restart-Service Spooler -Force }}"
        return PrintEngine._rodar_ps(cmd, servidor, "Reiniciar Spooler")

    @staticmethod
    def _rodar_ps(cmd, servidor, acao):
        comando_completo = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", cmd]
        try:
            resultado = subprocess.run(
                comando_completo, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE, 
                text=True, 
                encoding='utf-8', 
                errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            
            stdout_str = resultado.stdout if resultado.stdout else ""
            stderr_str = resultado.stderr if resultado.stderr else ""
            saida_limpa = stdout_str.strip()
            
            if resultado.returncode == 0:
                if not saida_limpa:
                    return {"sucesso": True, "dados": [], "msg": "Comando executado com sucesso."}
                
                try: 
                    dados = json.loads(saida_limpa)
                    if isinstance(dados, dict): dados = [dados]
                    return {"sucesso": True, "dados": dados, "msg": "Comando executado."}
                except Exception as json_err:
                    return {
                        "sucesso": False, 
                        "dados": [], 
                        "msg": "Falha na leitura dos dados (JSON inválido).",
                        "stderr": f"Erro do interpretador: {str(json_err)}\n\nRETORNO BRUTO DO SERVIDOR:\n{saida_limpa}"
                    }
            else:
                erro_txt = stderr_str.strip() or saida_limpa
                return {"sucesso": False, "dados": [], "msg": "Erro remoto no servidor.", "stderr": erro_txt}
                
        except Exception as e:
            return {"sucesso": False, "dados": [], "msg": str(e), "stderr": "Falha crítica de subprocesso."}