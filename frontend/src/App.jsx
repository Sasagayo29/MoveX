import React, { useState, useRef, useEffect } from 'react';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { CapacitorHttp } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Html5Qrcode } from 'html5-qrcode';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';

// Ferramentas e DB
import { salvarSincronizacao, buscarOffline } from './db'; 
import { limparCodigoLido } from './utils/formatters';

// Componentes Reutilizáveis
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { CameraOverlay } from './components/CameraOverlay';

// Views (Telas)
import { MenuPrincipal } from './views/MenuPrincipal';
import { TelaBuscaImpressora } from './views/TelaBuscaImpressora';
import { TelaBuscaF41 } from './views/TelaBuscaF41';
import { TelaBuscaNota } from './views/TelaBuscaNota';
import { TelaListaItens } from './views/TelaListaItens';
import { TelaDetalhesItem } from './views/TelaDetalhesItem';

const API_BASE_URL = 'http://10.205.200.39:8080/api';

// --- LIMITE DE ERROS (ERROR BOUNDARY) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900 text-white p-6 h-screen w-screen overflow-auto">
          <h1 className="text-2xl font-bold mb-4 text-amber-400">CRASH DO APP</h1>
          <p className="font-mono text-sm leading-relaxed">{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- APP PRINCIPAL ---
function MainApp() {
  const [telaAtual, setTelaAtual] = useState('busca_impressora');
  const [sincronizando, setSincronizando] = useState(false);
  const [impressoraID, setImpressoraID] = useState('');
  const [impressoraAtual, setImpressoraAtual] = useState(null); 
  const [notaAtual, setNotaAtual] = useState('');
  const [itensDaNota, setItensDaNota] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidadeEditada, setQuantidadeEditada] = useState('');
  const [buscaPN, setBuscaPN] = useState('');
  const [mensagem, setMensagem] = useState('Bipe o IP, MAC ou Nome da Impressora.');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [alvoCamera, setAlvoCamera] = useState('');
  const [termoF41, setTermoF41] = useState('');
  
  const inputRef = useRef(null);
  const bufferLaser = useRef('');
  const timerLaser = useRef(null);

  const handleAtualizarApp = async () => {
    try {
      setMensagem('Baixando nova versão do servidor...');
      setSincronizando(true);
      const download = await Filesystem.downloadFile({
        url: `${API_BASE_URL}/update/download`,
        path: 'movimex-update.apk',
        directory: Directory.Cache,
      });
      setMensagem('Download concluído. Abrindo instalador...');
      await FileOpener.openFile({
        path: download.path,
        mimeType: 'application/vnd.android.package-archive',
      });
      setSincronizando(false);
    } catch (error) {
      console.error(error);
      setMensagem('ERRO ao atualizar. Verifique o servidor.');
      setSincronizando(false);
    }
  }; 

  useEffect(() => {
    if ((telaAtual === 'busca_impressora' || telaAtual === 'busca_nota' || telaAtual === 'busca_f41') && !cameraAtiva) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [telaAtual, cameraAtiva]);

  useEffect(() => {
    const handleHardwareBack = () => {
      if (cameraAtiva) {
        setCameraAtiva(false);
      } else if (telaAtual === 'busca_impressora') {
        CapApp.exitApp();
      } else {
        handleVoltar();
      }
    };
    
    let backListener = null;
    CapApp.addListener('backButton', handleHardwareBack).then(listener => { backListener = listener; });
    return () => { if (backListener) backListener.remove(); };
  }, [telaAtual, impressoraAtual, itensDaNota, termoF41, cameraAtiva]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (cameraAtiva || (telaAtual !== 'busca_impressora' && telaAtual !== 'busca_nota' && telaAtual !== 'busca_f41')) return;
      if (document.activeElement === inputRef.current) return;

      if (e.key === 'Enter') {
        if (bufferLaser.current.trim().length > 0) {
          const termoInjetado = bufferLaser.current.trim();
          bufferLaser.current = '';
          
          if (telaAtual === 'busca_impressora') {
            setImpressoraID(termoInjetado);
            buscarImpressoraHibrida(termoInjetado);
          } else if (telaAtual === 'busca_nota') {
            setNotaAtual(termoInjetado);
            buscarNotaItemAction(termoInjetado);
          } else if (telaAtual === 'busca_f41') {
            setTermoF41(termoInjetado);
            buscarF41Action(termoInjetado);
          }
        }
      } else if (e.key.length === 1) {
        bufferLaser.current += e.key;
        clearTimeout(timerLaser.current);
        timerLaser.current = setTimeout(() => { bufferLaser.current = ''; }, 200);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [telaAtual, cameraAtiva]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setMensagem('Baixando dados nativamente...');
    try {
      const timestamp = new Date().getTime();
      const response = await CapacitorHttp.request({ method: 'GET', url: `${API_BASE_URL}/sync?t=${timestamp}` });
      if (response.status !== 200) throw new Error(`Erro do Servidor: ${response.status}`);
      
      const data = response.data;
      await salvarSincronizacao('impressoras', data.impressoras);
      await salvarSincronizacao('itens', data.itens);
      if (data.itens_f41) await salvarSincronizacao('itens_f41', data.itens_f41);
      
      const qtdItens = data.itens ? data.itens.length : 0;
      const qtdImp = data.impressoras ? data.impressoras.length : 0;
      const qtdF41 = data.itens_f41 ? data.itens_f41.length : 0;
      setMensagem(`OK: ${qtdItens} KBM | ${qtdF41} F41 | ${qtdImp} PRT`);
    } catch (error) {
      setMensagem('Falha: ' + error.message); 
    } finally {
      setSincronizando(false);
    }
  };

  const conectarBluetoothDirecionado = async (idAmigavelPlanilha) => {
    try {
      setMensagem(`Iniciando Bluetooth...`);
      await BleClient.initialize();
      const device = await BleClient.requestDevice({ acceptAllDevices: true, optionalServices: ['38eb4a80-c570-11e3-9507-0002a5d5c51b'] });
      setMensagem('Pareando...');
      await BleClient.connect(device.deviceId, (deviceId) => { setMensagem('Alerta: Conexão BT perdida.'); });
      
      setImpressoraAtual({ id: idAmigavelPlanilha || device.name || 'Zebra BT', tipo: 'BLUETOOTH', deviceId: device.deviceId });
      setMensagem(`Conectado à: ${device.name || 'Zebra BT'}.`);
      setTelaAtual('busca_nota');
    } catch (error) {
      setMensagem('Seleção cancelada pelo operador.');
      setImpressoraID('');
    }
  };

  const buscarImpressoraHibrida = async (termoDeBusca) => {
    const buscaLimpa = limparCodigoLido(termoDeBusca).toUpperCase();
    setImpressoraID(buscaLimpa);
    if (!buscaLimpa) { setMensagem('ERRO: Bipe a impressora primeiro.'); return; }
    
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(buscaLimpa)) {
      setImpressoraAtual({ id: `PRN-${buscaLimpa}`, ip: buscaLimpa, tipo: 'WIFI' });
      setMensagem('IP configurado manualmente (Rede).');
      setTelaAtual('menu_principal');
      return;
    }
    
    setMensagem('Consultando banco offline...');
    const resultados = await buscarOffline('impressoras', buscaLimpa.toUpperCase());
    
    if (resultados.length > 0) {
      const imp = resultados[0];
      if (buscaLimpa === imp.mac || (!imp.ip || !imp.ip.includes('.'))) {
        setMensagem('Bluetooth Identificado. Selecione-o na lista.');
        conectarBluetoothDirecionado(imp.id);
      } else {
        setImpressoraAtual({ ...imp, tipo: 'WIFI' });
        setMensagem(`Impressora ${imp.id} pronta (Wi-Fi).`);
        setTelaAtual('busca_nota');
      }
    } else {
      conectarBluetoothDirecionado(buscaLimpa);
    }
  };

  useEffect(() => {
    const syncSilencioso = async () => {
      if (!navigator.onLine || sincronizando) return;
      try {
        const timestamp = new Date().getTime();
        const response = await CapacitorHttp.request({ method: 'GET', url: `${API_BASE_URL}/sync?t=${timestamp}` });
        if (response.status === 200) {
          const data = response.data;
          await salvarSincronizacao('impressoras', data.impressoras);
          await salvarSincronizacao('itens', data.itens);
          if (data.itens_f41) await salvarSincronizacao('itens_f41', data.itens_f41);
        }
      } catch (error) {}
    };
    
    const interval = setInterval(syncSilencioso, 5 * 60 * 1000);
    window.addEventListener('online', syncSilencioso);
    return () => { clearInterval(interval); window.removeEventListener('online', syncSilencioso); };
  }, []);

  const buscarF41Action = async (termo) => {
    const buscaLimpa = limparCodigoLido(termo).toUpperCase(); 
    if (!buscaLimpa) return;
    setMensagem('Consultando F41 offline...');
    
    const resultados = await buscarOffline('itens_f41', buscaLimpa);
    if (resultados.length > 0) {
      const agrupados = {};
      resultados.forEach(r => {
        const cod = r.codigo;
        const qtd = parseFloat(r.qtd_estoque) || 0;
        if (!agrupados[cod]) {
          agrupados[cod] = { ...r, isF41: true, qtdOriginal: 0, part_number: r.tipo, volume: "", locais: [] };
        }
        agrupados[cod].qtdOriginal += qtd;
        agrupados[cod].locais.push({ location: r.location, qtd: qtd });
      });
      
      const formatados = Object.values(agrupados).map(item => {
        item.qtdOriginal = Math.round(item.qtdOriginal * 100) / 100; 
        if (item.locais.length === 1) item.volume = item.locais[0].location || "SEM LOCAÇÃO";
        else item.volume = `${item.locais.length} LOCAIS DISTINTOS`;
        return item;
      });
      
      setItensDaNota(formatados); 
      setTermoF41('');
      
      if (formatados.length === 1) {
        setItemSelecionado(formatados[0]);
        setQuantidadeEditada('1');
        setMensagem('Item F41 localizado.');
        setTelaAtual('detalhes_item'); 
      } else {
        setMensagem(`Encontrados ${formatados.length} itens distintos.`);
        setTelaAtual('lista_itens');
      }
    } else {
      setMensagem('ITEM NÃO ENCONTRADO NO F41.');
    }
  };

  const buscarNotaItemAction = async (termoDeBusca) => {
    const buscaLimpa = limparCodigoLido(termoDeBusca).toUpperCase(); 
    setNotaAtual(buscaLimpa);
    if (!buscaLimpa) return;
    setMensagem('Buscando na memória local...');
    
    const resultados = await buscarOffline('itens', buscaLimpa);
    if (resultados.length > 0) {
      setItensDaNota(resultados);
      setBuscaPN(''); 
      if (resultados.length === 1) {
        setItemSelecionado(resultados[0]);
        setQuantidadeEditada(resultados[0].qtdOriginal.toString());
        setMensagem('Pronto para imprimir.');
        setTelaAtual('detalhes_item');
      } else {
        setMensagem(`Localizados ${resultados.length} registro(s).`);
        setTelaAtual('lista_itens');
      }
    } else {
      setMensagem('NADA ENCONTRADO OFFLINE.');
      setNotaAtual('');
    }
  };

  const selecionarItem = (item) => {
    setItemSelecionado(item);
    setQuantidadeEditada(item.isF41 ? '1' : item.qtdOriginal.toString()); 
    setMensagem('Ajuste a qtd ou imprima.');
    setTelaAtual('detalhes_item');
  };

  const handleAlterarQuantidade = (delta) => {
    let novaQtd = (parseInt(quantidadeEditada, 10) || 0) + delta;
    if (novaQtd < 0) novaQtd = 0;
    setQuantidadeEditada(novaQtd.toString());
  };

  const handleDigitarQtd = (e) => {
    const valorSomenteNumeros = e.target.value.replace(/\D/g, '');
    setQuantidadeEditada(valorSomenteNumeros);
  };

  const handleImprimir = async (tipo) => {
    if (!quantidadeEditada || quantidadeEditada === '0') {
      setMensagem('ERRO: Quantidade inválida.');
      return;
    }
    
    setMensagem('Enviando impressão...');
    const qtdPrint = tipo === 'individual' ? 1 : parseInt(quantidadeEditada, 10);
    
    const rawZpl = itemSelecionado.zpl ? itemSelecionado.zpl : "";
    if (!rawZpl) { 
      setMensagem('ERRO: Este item não possui etiqueta ZPL.'); 
      return; 
    }
    
    const zplOriginal = rawZpl.replaceAll('¨', '');
    const zplPronto = /\^PQ\d+/.test(zplOriginal) 
        ? zplOriginal.replace(/\^PQ\d+/, `^PQ${qtdPrint}`) 
        : zplOriginal.replace('^XZ', `^PQ${qtdPrint}^XZ`);

    if (impressoraAtual.tipo === 'BLUETOOTH') {
      try {
        setMensagem('Transmitindo ZPL...');
        const encoder = new TextEncoder();
        const data = encoder.encode(zplPronto);
        const chunkSize = 256; 
        
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
          await BleClient.write(impressoraAtual.deviceId, '38eb4a80-c570-11e3-9507-0002a5d5c51b', '38eb4a82-c570-11e3-9507-0002a5d5c51b', dataView);
        }
        
        setMensagem('Sucesso! Etiqueta impressa (BT).');
        setTelaAtual('busca_nota');
        setNotaAtual('');
        setItemSelecionado(null);
      } catch (error) {
        setMensagem('ERRO: Falha ao enviar para Zebra BT.');
      }
    } else {
      try {
        const response = await CapacitorHttp.request({
          method: 'POST', url: `${API_BASE_URL}/imprimir`, headers: { 'Content-Type': 'application/json' },
          data: { impressora_ip: impressoraAtual.ip, codigo_item: itemSelecionado.codigo, nota: notaAtual.toUpperCase(), quantidade: parseInt(quantidadeEditada, 10), zpl_formula: zplPronto, tipo: tipo }
        });
        
        if (response.status === 200) {
          setMensagem('Sucesso! Etiqueta gerada (Rede).');
          setTelaAtual('busca_nota');
          setNotaAtual('');
          setItemSelecionado(null);
        } else {
          setMensagem('ERRO: Impressora offline.');
        }
      } catch (error) { setMensagem('ERRO DE REDE AO IMPRIMIR.'); }
    }
  };

  const handleVoltar = () => {
    const isContextoF41 = itensDaNota.length > 0 && itensDaNota[0].isF41;
    
    if (telaAtual === 'menu_principal') {
      if (impressoraAtual?.device?.gatt?.connected) impressoraAtual.device.gatt.disconnect();
      setTelaAtual('busca_impressora');
      setImpressoraAtual(null);
      setImpressoraID('');
      setMensagem('Bipe o IP, MAC ou Nome da Impressora.');
    }
    else if (telaAtual === 'busca_nota' || telaAtual === 'busca_f41') {
      setTelaAtual('menu_principal');
      setNotaAtual('');
      setTermoF41('');
      setMensagem('Selecione a operação desejada.');
    }
    else if (telaAtual === 'lista_itens') {
      setTelaAtual(isContextoF41 ? 'busca_f41' : 'busca_nota');
      setItensDaNota([]);
      setBuscaPN('');
      setTermoF41('');
      setNotaAtual('');
      setMensagem('Pesquisa cancelada.');
    }
    else if (telaAtual === 'detalhes_item') {
      if (itensDaNota.length <= 1) {
        setTelaAtual(isContextoF41 ? 'busca_f41' : 'busca_nota');
        setItensDaNota([]);
        setItemSelecionado(null);
        setTermoF41('');
        setNotaAtual('');
        setMensagem('Pesquisa cancelada.');
      } else {
        setTelaAtual('lista_itens');
        setItemSelecionado(null);
        setMensagem('Selecione um item.');
      }
    }
  };

  useEffect(() => {
    let html5QrCode;
    if (cameraAtiva) {
      html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (textoLido) => {
          html5QrCode.stop().then(() => {
            setCameraAtiva(false);
            const codigoLimpo = limparCodigoLido(textoLido).toUpperCase();
            if (alvoCamera === 'impressora') {
              setImpressoraID(codigoLimpo);
              setMensagem('Verifique o código e clique em Conectar.');
            } else if (alvoCamera === 'f41') {
              setTermoF41(codigoLimpo);
              setMensagem('Verifique o código e clique em Buscar.');
            } else {
              setNotaAtual(codigoLimpo);
              setMensagem('Verifique o código e clique em Consultar.');
            }
          }).catch(err => console.error("Erro ao parar câmera", err));
        },
        (errorMessage) => {}
      ).catch((err) => {
        setMensagem('ERRO: Câmera não autorizada ou indisponível.');
        setCameraAtiva(false);
      });
    }
    
    return () => { if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().catch(e => console.log("Câmera já parada")); } };
  }, [cameraAtiva, alvoCamera]);

  const abrirCamera = (alvo) => {
    setAlvoCamera(alvo);
    setCameraAtiva(true);
  };

  const itensFiltrados = itensDaNota.filter(item => item.busca_global.includes(buscaPN.trim().toUpperCase()));

  return (
    <div className="h-screen w-screen bg-slate-950 font-sans flex flex-col text-slate-100 overflow-hidden relative">
      <Header 
        telaAtual={telaAtual} handleVoltar={handleVoltar} impressoraAtual={impressoraAtual} 
        handleAtualizarApp={handleAtualizarApp} sincronizando={sincronizando} handleSincronizar={handleSincronizar} 
      />
      <StatusBar mensagem={mensagem} />
      
      {cameraAtiva && <CameraOverlay setCameraAtiva={setCameraAtiva} />}

      <main className="flex-1 p-3 md:p-6 flex flex-col overflow-y-auto relative">
        {telaAtual === 'menu_principal' && <MenuPrincipal setTelaAtual={setTelaAtual} />}
        {telaAtual === 'busca_impressora' && <TelaBuscaImpressora inputRef={inputRef} impressoraID={impressoraID} setImpressoraID={setImpressoraID} buscarImpressoraHibrida={buscarImpressoraHibrida} telaAtual={telaAtual} cameraAtiva={cameraAtiva} abrirCamera={abrirCamera} />}
        {telaAtual === 'busca_f41' && <TelaBuscaF41 inputRef={inputRef} termoF41={termoF41} setTermoF41={setTermoF41} buscarF41Action={buscarF41Action} abrirCamera={abrirCamera} />}
        {telaAtual === 'busca_nota' && <TelaBuscaNota inputRef={inputRef} notaAtual={notaAtual} setNotaAtual={setNotaAtual} buscarNotaItemAction={buscarNotaItemAction} telaAtual={telaAtual} cameraAtiva={cameraAtiva} abrirCamera={abrirCamera} />}
        {telaAtual === 'lista_itens' && <TelaListaItens buscaPN={buscaPN} setBuscaPN={setBuscaPN} itensFiltrados={itensFiltrados} selecionarItem={selecionarItem} />}
        {telaAtual === 'detalhes_item' && <TelaDetalhesItem itemSelecionado={itemSelecionado} quantidadeEditada={quantidadeEditada} handleDigitarQtd={handleDigitarQtd} handleAlterarQuantidade={handleAlterarQuantidade} handleImprimir={handleImprimir} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}