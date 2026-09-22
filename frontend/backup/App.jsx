import React, { useState, useRef, useEffect } from 'react';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { CapacitorHttp } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { salvarSincronizacao, buscarOffline } from './db'; 
import { Html5Qrcode } from 'html5-qrcode';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';

const API_BASE_URL = 'http://10.205.200.39:8080/api';

const limparCodigoLido = (textoLido) => {
  if (!textoLido) return '';
  const texto = String(textoLido).trim();
  
  // O Leitor Zebra pode distorcer o "|" dependendo do layout do teclado (ex: }, ], \, /)
  // Esta Regex engloba todas as falhas físicas de leitura do leitor.
  if (/[|\]}\/\\]/.test(texto) && texto.length > 20) {
    const partes = texto.split(/[|\]}\/\\]/);
    if (partes.length >= 3) {
      const valorImportante = partes[2];
      const codigoLimpo = valorImportante.split('.')[0].trim();
      if (codigoLimpo.length >= 5) {
        return codigoLimpo;
      }
    }
  }
  return texto;
};

function App() {
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
  const handleAtualizarApp = async () => {
    try {
      setMensagem('Baixando nova versão do servidor...');
      setSincronizando(true); // Usa seu estado de loading para travar a tela

      // 1. Faz o download do APK e salva no cache do celular
      const download = await Filesystem.downloadFile({
        url: `${API_BASE_URL}/update/download`,
        path: 'movimex-update.apk',
        directory: Directory.Cache,
      });

      setMensagem('Download concluído. Abrindo instalador...');

      // 2. Dispara a tela nativa do Android para instalar o APK
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

  // ---> A CORREÇÃO: AS VARIÁVEIS DO F41 DEVEM FICAR AQUI NO TOPO! <---
  const [itensF41, setItensF41] = useState([]);
  const [termoF41, setTermoF41] = useState('');
  
  const inputRef = useRef(null);
  const heartbeatInterval = useRef(null);

  // --- FOCO E CAPTURA GLOBAL DE LASER (COMPATÍVEL COM INTUNE MAM) ---
  useEffect(() => {
    if ((telaAtual === 'busca_impressora' || telaAtual === 'busca_nota' || telaAtual === 'busca_f41') && !cameraAtiva) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [telaAtual, cameraAtiva]);

  // --- INTERCEPTADOR DO BOTÃO FÍSICO DO ANDROID ---
  useEffect(() => {
    const handleHardwareBack = () => {
      // Se estiver na tela inicial, permite que o Android feche o app
      if (telaAtual === 'busca_impressora') {
        CapApp.exitApp();
      } else {
        // Senão, simula um toque na nossa seta de voltar
        handleVoltar();
      }
    };

    let backListener = null;
    CapApp.addListener('backButton', handleHardwareBack).then(listener => {
      backListener = listener;
    });

    return () => {
      if (backListener) backListener.remove();
    };
  }, [telaAtual, impressoraAtual, itensDaNota, termoF41]);

  useEffect(() => {
    let bufferLaser = '';
    let timerLaser = null;

    const handleGlobalKeyDown = (e) => {
      // Adicionada a tela busca_f41 na permissão do laser!
      if (cameraAtiva || (telaAtual !== 'busca_impressora' && telaAtual !== 'busca_nota' && telaAtual !== 'busca_f41')) return;
      if (document.activeElement === inputRef.current) return;

      if (e.key === 'Enter') {
        if (bufferLaser.trim().length > 0) {
          const termoInjetado = bufferLaser.trim();
          bufferLaser = '';
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
        bufferLaser += e.key;
        clearTimeout(timerLaser);
        timerLaser = setTimeout(() => { bufferLaser = ''; }, 200);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [telaAtual, cameraAtiva, impressoraID, notaAtual, termoF41]);

  // --- MOTOR OFFLINE COM DEBUG PRECISO ---
  const handleSincronizar = async () => {
  setSincronizando(true);
  setMensagem('Baixando dados nativamente...');
  try {
    const timestamp = new Date().getTime();

    // USO DO PLUGIN NATIVO DO CAPACITOR EM VEZ DO FETCH
    const response = await CapacitorHttp.request({
      method: 'GET',
      url: `${API_BASE_URL}/sync?t=${timestamp}`,
    });

    if (response.status !== 200) {
       throw new Error(`Erro do Servidor: ${response.status}`);
    }

    const data = response.data;
    await salvarSincronizacao('impressoras', data.impressoras);
    await salvarSincronizacao('itens', data.itens);
    if (data.itens_f41) await salvarSincronizacao('itens_f41', data.itens_f41);

    const qtdItens = data.itens ? data.itens.length : 0;
    const qtdImp = data.impressoras ? data.impressoras.length : 0;
    const qtdF41 = data.itens_f41 ? data.itens_f41.length : 0;
    
    // MENSAGEM UNIFICADA:
    setMensagem(`OK: ${qtdItens} KBM | ${qtdF41} F41 | ${qtdImp} PRT`);
  } catch (error) {
    setMensagem('Falha: ' + error.message); 
  } finally {
    setSincronizando(false);
  }
};

  // --- BLUETOOTH À PROVA DE TRAVAMENTO ---
  const conectarBluetoothDirecionado = async (idAmigavelPlanilha) => {
    try {
      setMensagem(`Iniciando Bluetooth...`);
      
      // Acorda o rádio Bluetooth do celular
      await BleClient.initialize();
      
      // Pede ao Android para mostrar TODOS os dispositivos Bluetooth próximos
      const device = await BleClient.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['38eb4a80-c570-11e3-9507-0002a5d5c51b']
      });

      setMensagem('Pareando...');
      
      // Conecta fisicamente ao MAC do dispositivo escolhido
      await BleClient.connect(device.deviceId, (deviceId) => {
        setMensagem('Alerta: Conexão BT perdida.');
      });

      // Salva o ID físico (MAC da placa) para mandar a impressão depois
      setImpressoraAtual({
        id: idAmigavelPlanilha || device.name || 'Zebra BT',
        tipo: 'BLUETOOTH',
        deviceId: device.deviceId
      });

      setMensagem(`Conectado à: ${device.name || 'Zebra BT'}.`);
      setTelaAtual('busca_nota');

    } catch (error) {
      console.error(error);
      setMensagem('Seleção cancelada pelo operador.');
      setImpressoraID('');
    }
  };

  // --- O CÉREBRO DA CONEXÃO HÍBRIDA ---
  const buscarImpressoraHibrida = async (termoDeBusca) => {
    // 1. Limpa o código e atualiza a caixa de texto
    const buscaLimpa = limparCodigoLido(termoDeBusca).toUpperCase();
    setImpressoraID(buscaLimpa);

    if (!buscaLimpa) {
        setMensagem('ERRO: Bipe a impressora primeiro.');
        return;
    }

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
      
      // NOVO: Se bipou o MAC ou se não tiver IP, vai pro Bluetooth
      if (buscaLimpa === imp.mac || (!imp.ip || !imp.ip.includes('.'))) {
        setMensagem('Bluetooth Identificado. Selecione-o na lista.');
        conectarBluetoothDirecionado(imp.id);
      } else {
        // Se bipou o Nome ou IP, tenta Wi-Fi
        setImpressoraAtual({ ...imp, tipo: 'WIFI' });
        setMensagem(`Impressora ${imp.id} pronta (Wi-Fi).`);
        setTelaAtual('busca_nota');
      }
    } else {
      conectarBluetoothDirecionado(buscaLimpa);
    }
  };

  // --- MOTOR DE AUTO-SYNC EM BACKGROUND ---
  useEffect(() => {
    const syncSilencioso = async () => {
      // Não faz nada se não houver internet ou se já estiver baixando manual
      if (!navigator.onLine || sincronizando) return;
      
      try {
        const timestamp = new Date().getTime();
        const response = await CapacitorHttp.request({
          method: 'GET',
          url: `${API_BASE_URL}/sync?t=${timestamp}`,
        });

        if (response.status === 200) {
          const data = response.data;
          await salvarSincronizacao('impressoras', data.impressoras);
          await salvarSincronizacao('itens', data.itens);
          if (data.itens_f41) await salvarSincronizacao('itens_f41', data.itens_f41);
          console.log('🔄 MoviMeX Auto-Sync concluído silenciosamente.');
        }
      } catch (error) {
        console.log('⚠️ MoviMeX Auto-Sync ignorado (Servidor indisponível ou fora da rede).');
      }
    };

    // Aciona a cada 5 minutos (300.000 milissegundos)
    const interval = setInterval(syncSilencioso, 5 * 60 * 1000);
    
    // Aciona imediatamente quando o aparelho reconectar ao Wi-Fi
    window.addEventListener('online', syncSilencioso);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', syncSilencioso);
    };
  }, []);

  const buscarF41Action = async (termo) => {
    const buscaLimpa = limparCodigoLido(termo).toUpperCase(); 
    if (!buscaLimpa) return;

    setMensagem('Consultando F41 offline...');
    const resultados = await buscarOffline('itens_f41', buscaLimpa);
      
    if (resultados.length > 0) {
      // 1. Agrupa os resultados pelo Short Item No (codigo)
      const agrupados = {};
      resultados.forEach(r => {
        const cod = r.codigo;
        const qtd = parseFloat(r.qtd_estoque) || 0;
        
        if (!agrupados[cod]) {
          agrupados[cod] = {
            ...r,
            isF41: true, // Flag para mudar o visual da tela
            qtdOriginal: 0,
            part_number: r.tipo, // Reaproveitado para listar "Estoque"
            volume: "", 
            locais: []
          };
        }
        agrupados[cod].qtdOriginal += qtd;
        agrupados[cod].locais.push({ location: r.location, qtd: qtd });
      });

      // 2. Formata a visualização total
      const formatados = Object.values(agrupados).map(item => {
        // Arredonda para remover dízimas (ex: 1.00 vira 1)
        item.qtdOriginal = Math.round(item.qtdOriginal * 100) / 100; 
        
        if (item.locais.length === 1) {
          item.volume = item.locais[0].location || "SEM LOCAÇÃO";
        } else {
          item.volume = `${item.locais.length} LOCAIS DISTINTOS`;
        }
        return item;
      });

      setItensDaNota(formatados); 
      setTermoF41('');
      
      if (formatados.length === 1) {
        setItemSelecionado(formatados[0]);
        setQuantidadeEditada('1'); // <--- AQUI: Força quantidade inicial 1
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
    // 1. Limpa o código e atualiza a caixa de texto
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
    // AQUI: Se for F41, coloca 1. Se for KBM de recebimento, puxa a quantidade real
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
    let zplPronto = '';

    // --- LÓGICA UNIFICADA: ZPL VEM DIRETO DO BACKEND ---
    const rawZpl = itemSelecionado.zpl ? itemSelecionado.zpl : "";
    
    if (!rawZpl) {
        setMensagem('ERRO: Este item não possui etiqueta ZPL.');
        return; 
    }
    
    const zplOriginal = rawZpl.replaceAll('¨', '');
    zplPronto = /\^PQ\d+/.test(zplOriginal) 
        ? zplOriginal.replace(/\^PQ\d+/, `^PQ${qtdPrint}`) 
        : zplOriginal.replace('^XZ', `^PQ${qtdPrint}^XZ`);
    // ----------------------------------------------------

    if (impressoraAtual.tipo === 'BLUETOOTH') {
      try {
        setMensagem('Transmitindo ZPL...');
        
        const encoder = new TextEncoder();
        const data = encoder.encode(zplPronto);
        const chunkSize = 256; 
        
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
          
          await BleClient.write(
            impressoraAtual.deviceId,
            '38eb4a80-c570-11e3-9507-0002a5d5c51b', 
            '38eb4a82-c570-11e3-9507-0002a5d5c51b', 
            dataView
          );
        }

        setMensagem('Sucesso! Etiqueta impressa (BT).');
        setTelaAtual('busca_nota');
        setNotaAtual('');
        setItemSelecionado(null);
      } catch (error) {
        console.error(error);
        setMensagem('ERRO: Falha ao enviar para Zebra BT.');
      }
    }
    else {
      try {
        const response = await CapacitorHttp.request({
          method: 'POST',
          url: `${API_BASE_URL}/imprimir`,
          headers: { 'Content-Type': 'application/json' },
          data: {
            impressora_ip: impressoraAtual.ip, 
            codigo_item: itemSelecionado.codigo,
            nota: notaAtual.toUpperCase(),
            quantidade: parseInt(quantidadeEditada, 10),
            zpl_formula: zplPronto, // Enviamos o ZPL já limpo e gerado
            tipo: tipo
          }
        });

        if (response.status === 200) {
          setMensagem('Sucesso! Etiqueta gerada (Rede).');
          setTelaAtual('busca_nota');
          setNotaAtual('');
          setItemSelecionado(null);
        } else {
          setMensagem('ERRO: Impressora offline.');
        }
      } catch (error) {
        setMensagem('ERRO DE REDE AO IMPRIMIR.');
      }
    }
  };

  const handleVoltar = () => {
    // Memória de Rota: O app verifica de qual módulo os itens da memória vieram
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
        // Retorna para a tela de bipar correta
        setTelaAtual(isContextoF41 ? 'busca_f41' : 'busca_nota');
        setItensDaNota([]);
        setItemSelecionado(null);
        setTermoF41('');
        setNotaAtual('');
        setMensagem('Pesquisa cancelada.');
      } else {
        // Retorna para a lista mantendo a memória
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

      // Inicia automaticamente na câmera traseira (environment)
      html5QrCode.start(
        { facingMode: "environment" }, 
        {
          fps: 15, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (textoLido) => {
          // --- SUCESSO NA LEITURA ---
          html5QrCode.stop().then(() => {
            setCameraAtiva(false);
            
            // 1. Limpa o código imediatamente ao ler da câmera
            const codigoLimpo = limparCodigoLido(textoLido).toUpperCase();
            
            // 2. Apenas preenche o campo na tela para o usuário verificar (Sem Auto-Submit)
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
        (errorMessage) => {
          // Ignora os frames vazios
        }
      ).catch((err) => {
        console.error("Erro de permissão ou hardware:", err);
        setMensagem('ERRO: Câmera não autorizada ou indisponível.');
        setCameraAtiva(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.log("Câmera já parada"));
      }
    };
  }, [cameraAtiva, alvoCamera]);

  const abrirCamera = (alvo) => {
    setAlvoCamera(alvo);
    setCameraAtiva(true);
  };

  const itensFiltrados = itensDaNota.filter(item => 
    item.busca_global.includes(buscaPN.trim().toUpperCase())
  );

  return (
    <div className="h-screen w-screen bg-slate-950 font-sans flex flex-col text-slate-100 overflow-hidden relative">
      
      <header className="bg-slate-900 border-b-2 border-amber-400/30 p-2 flex items-center justify-between h-14 shrink-0 shadow-lg relative">
        {telaAtual !== 'busca_impressora' ? (
           <button onClick={handleVoltar} className="p-2 flex items-center text-amber-400 active:bg-slate-800 rounded">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
             </svg>
           </button>
        ) : <div className="w-10"></div>}
        
        <div className="text-center flex-1">
          <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">
            <span className="text-amber-400">KINROSS</span> MOVIMEX
          </h1>
          {impressoraAtual && (
             <p className="text-[9px] text-slate-400 tracking-widest uppercase leading-tight truncate px-2">
               PRT: {impressoraAtual.id}
             </p>
          )}
        </div>

        <div className="flex gap-2">
          {/* BOTÃO NOVO DE ATUALIZAÇÃO OTA */}
          <button 
            onClick={handleAtualizarApp} 
            disabled={sincronizando}
            className={`p-2 rounded flex flex-col items-center justify-center w-12 transition-colors ${sincronizando ? 'text-slate-500' : 'text-emerald-400 active:bg-slate-800'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-[7px] uppercase font-bold tracking-wider">Update</span>
          </button>

          {/* BOTÃO DE SYNC */}
          <button 
            onClick={handleSincronizar} 
            disabled={sincronizando}
            className={`p-2 rounded flex flex-col items-center justify-center w-12 transition-colors ${sincronizando ? 'animate-pulse text-slate-500' : 'text-blue-400 active:bg-slate-800'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-[7px] uppercase font-bold tracking-wider">Sync</span>
          </button>
        </div>
      </header>

      <div className="h-8 flex items-center justify-center border-l-4 border-amber-500 bg-slate-900 px-2 shrink-0">
        <p className="font-bold text-amber-400 text-center uppercase text-[10px] tracking-widest truncate">
          {mensagem}
        </p>
      </div>

      {cameraAtiva && (
        <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col">
          {/* Header Flutuante Transparente */}
          <div className="absolute top-0 w-full z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent pt-6">
            <h2 className="text-amber-400 font-extrabold uppercase tracking-wider text-sm drop-shadow-md">
              Escaneando...
            </h2>
            <button 
              onClick={() => setCameraAtiva(false)} 
              className="bg-red-600 text-white px-5 py-2 font-bold uppercase text-xs rounded-full shadow-lg active:bg-red-700 backdrop-blur-sm transition-all border border-red-500"
            >
              Cancelar
            </button>
          </div>

          {/* Container do Vídeo */}
          <div id="reader" className="w-full h-full flex-1 bg-black overflow-hidden flex items-center justify-center"></div>
          
          {/* Dica Flutuante no Rodapé */}
          <div className="absolute bottom-12 w-full text-center z-10 pointer-events-none">
            <p className="text-white text-[10px] font-bold uppercase tracking-widest bg-black/60 inline-block px-4 py-2 rounded-full border border-slate-700 backdrop-blur-sm">
              Aponte para o Código de Barras
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 p-3 md:p-6 flex flex-col overflow-y-auto relative">
        
        {/* TELA DE MENU PRINCIPAL */}
        {telaAtual === 'menu_principal' && (
          <div className="flex-1 flex flex-col justify-center items-center max-w-sm md:max-w-lg mx-auto w-full gap-4 md:gap-8">
            <button 
              onClick={() => setTelaAtual('busca_nota')} 
              className="w-full bg-slate-800 border-2 border-blue-500 text-blue-400 p-6 md:p-10 font-bold uppercase rounded-lg active:bg-slate-700 flex flex-col items-center gap-2 md:gap-4 transition-all md:text-xl hover:bg-slate-800/80"
            >
              <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
              1. Recebimento (KBM)
            </button>
            
            <button 
              onClick={() => setTelaAtual('busca_f41')} 
              className="w-full bg-slate-800 border-2 border-emerald-500 text-emerald-400 p-6 md:p-10 font-bold uppercase rounded-lg active:bg-slate-700 flex flex-col items-center gap-2 md:gap-4 transition-all md:text-xl hover:bg-slate-800/80"
            >
              <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              2. Consulta de Item (F41)
            </button>
          </div>
        )}

        {/* TELA DE BUSCA F41 */}
        {telaAtual === 'busca_f41' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full">
            <label className="text-emerald-400 font-bold uppercase tracking-wider mb-2 text-xs md:text-sm text-center">
              Consultar Item / Locação
            </label>
            <div className="relative">
              <input 
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={termoF41}
                onChange={(e) => setTermoF41(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); buscarF41Action(termoF41); }
                }}
                placeholder="CÓDIGO, NOME OU LOCAÇÃO"
                className="w-full p-4 md:p-6 pr-12 text-lg md:text-2xl text-center bg-slate-800 border-2 border-emerald-400 rounded-lg shadow-inner focus:outline-none text-white uppercase transition-all"
              />
              <button type="button" onClick={() => abrirCamera('f41')} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 md:p-4 hover:text-emerald-400">
                <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
            <button onClick={() => buscarF41Action(termoF41)} className="mt-4 md:mt-6 bg-slate-800 border border-emerald-400/50 text-emerald-400 p-3 md:p-5 font-bold uppercase active:bg-slate-700 rounded transition-all md:text-lg">
              Buscar no F41
            </button>
          </div>
        )}

        {telaAtual === 'busca_impressora' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full gap-5 md:gap-8">
            
            <div className="text-center mb-2">
              <label className="text-amber-400 font-bold uppercase tracking-wider text-xs md:text-sm">
                Vincular Impressora
              </label>
              <p className="text-[10px] md:text-xs text-slate-500 mt-2 md:mt-4 uppercase tracking-wide leading-relaxed px-4">
                Bipe o MAC ou IP para conectar no <strong className="text-slate-300">Wi-Fi</strong>. 
                Se não achar, o <strong className="text-blue-400">Bluetooth</strong> abrirá pedindo a Zebra.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 md:p-6 rounded-lg shadow-inner">
              <div className="relative mb-4 md:mb-6">
                <input 
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  value={impressoraID}
                  onChange={(e) => setImpressoraID(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); buscarImpressoraHibrida(impressoraID); }
                  }}
                  onBlur={() => {
                    if (telaAtual === 'busca_impressora' && !cameraAtiva) {
                      setTimeout(() => inputRef.current?.focus(), 10);
                    }
                  }}
                  placeholder="IP, MAC OU NOME"
                  className="w-full p-4 md:p-6 pr-12 text-lg md:text-2xl text-center bg-slate-950 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-amber-400 text-white placeholder:text-slate-600 transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => abrirCamera('impressora')}
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 md:p-4 active:text-amber-400 hover:text-amber-400"
                >
                  <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              </div>
              
              <button 
                onClick={() => buscarImpressoraHibrida(impressoraID)} 
                className="w-full bg-amber-500 text-slate-950 border border-amber-600 p-4 md:p-6 font-extrabold uppercase active:bg-amber-600 md:text-lg tracking-wider rounded-lg shadow-md flex items-center justify-center gap-2 transition-all hover:bg-amber-400"
              >
                Conectar Dispositivo
              </button>
            </div>
          </div>
        )}

        {telaAtual === 'busca_nota' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full">
            <label className="text-amber-400 font-bold uppercase tracking-wider mb-2 text-xs md:text-sm text-center">
              Bipar NFE ou Part Number
            </label>
            <div className="relative">
              <input 
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={notaAtual}
                onChange={(e) => setNotaAtual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); buscarNotaItemAction(notaAtual); }
                }}
                onBlur={() => {
                  if (telaAtual === 'busca_nota' && !cameraAtiva) {
                    setTimeout(() => inputRef.current?.focus(), 10);
                  }
                }}
                placeholder="EX: 158602"
                className="w-full p-4 md:p-6 pr-12 text-xl md:text-3xl text-center bg-slate-800 border-2 border-amber-400 rounded-lg shadow-inner focus:outline-none text-white uppercase transition-all"
              />
              <button 
                type="button" 
                onClick={() => abrirCamera('nota')}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 md:p-4 hover:text-amber-400"
              >
                <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
            <button onClick={() => buscarNotaItemAction(notaAtual)} className="mt-4 md:mt-6 bg-slate-800 border border-amber-400/50 text-amber-400 p-3 md:p-5 font-bold uppercase active:bg-slate-700 rounded transition-all md:text-lg">
              Consultar Memória Local
            </button>
          </div>
        )}

        {telaAtual === 'lista_itens' && (
          <div className="flex-1 flex flex-col h-full max-w-sm md:max-w-2xl mx-auto w-full">
            <div className="mb-2 md:mb-4 shrink-0">
              <input 
                type="text"
                value={buscaPN}
                onChange={(e) => setBuscaPN(e.target.value)}
                placeholder="PESQUISAR NESTA LISTA..."
                className="w-full p-2 md:p-4 text-sm md:text-base bg-slate-800 border border-slate-600 focus:border-amber-400 text-white uppercase focus:outline-none rounded transition-all"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 pb-2 custom-scrollbar">
              {itensFiltrados.length > 0 ? (
                itensFiltrados.map((item, index) => (
                  <button
                    key={`${item.codigo}-${index}`} 
                    onClick={() => selecionarItem(item)}
                    className="w-full text-left bg-slate-900 p-3 md:p-5 border border-slate-700 active:bg-slate-800 hover:bg-slate-800 focus:outline-none rounded transition-all"
                  >
                    <div className="flex justify-between items-center mb-1 md:mb-2">
                      <div className="flex flex-col">
                         <span className="font-mono font-bold text-amber-400 text-sm md:text-lg leading-none">{item.codigo}</span>
                         {item.part_number && item.part_number !== item.codigo && (
                           <span className="text-slate-400 text-[9px] md:text-xs font-mono mt-1">P/N: {item.part_number}</span>
                         )}
                      </div>
                      <span className="bg-slate-800 text-slate-300 text-[10px] md:text-xs px-2 md:px-3 py-1 font-bold border border-slate-700 rounded">
                        QTD: {item.qtdOriginal}
                      </span>
                    </div>
                    <p className="font-bold text-xs md:text-base text-white line-clamp-2 leading-tight mt-1">{item.descricao}</p>
                    <p className="text-[9px] md:text-xs text-slate-500 mt-2 uppercase tracking-wider font-semibold">
                      END: {item.volume}
                      {item.ultima_nota && item.ultima_nota !== "N/A" && (
                        <span className="text-amber-500/80 ml-2">| ÚLT: {item.ultima_nota}</span>
                      )}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-center text-slate-500 text-xs md:text-sm mt-4 uppercase font-bold">Nenhum registro correspondente.</p>
              )}
            </div>
          </div>
        )}

        {telaAtual === 'detalhes_item' && itemSelecionado && (
          <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full">
            
            <div className="bg-slate-900 p-3 md:p-6 border border-slate-700 mb-3 md:mb-6 relative shrink-0 rounded shadow-md">
              <p className="font-mono font-bold text-lg md:text-3xl text-amber-400 leading-none mb-1 md:mb-3">{itemSelecionado.codigo}</p>
              
              {/* RENDERIZAÇÃO CONDICIONAL: F41 (Análise) vs KBM (Recebimento) */}
              {itemSelecionado.isF41 ? (
                <>
                  <p className="text-slate-400 text-[10px] md:text-sm font-mono leading-none mb-2 md:mb-4">TIPO: {itemSelecionado.tipo}</p>
                  <p className="font-bold text-xs md:text-xl text-white leading-tight mb-1 md:mb-2">{itemSelecionado.descricao}</p>
                  {itemSelecionado.linha2 && (
                    <p className="text-slate-300 text-[10px] md:text-sm leading-tight mb-2 md:mb-4">{itemSelecionado.linha2}</p>
                  )}
                  
                  {itemSelecionado.ultima_nota && itemSelecionado.ultima_nota !== "N/A" && (
                    <div className="mt-2 md:mt-4 mb-1 md:mb-3 flex items-center gap-2">
                      <span className="text-[9px] md:text-xs text-slate-500 uppercase font-bold">ÚLTIMA NFE:</span>
                      <span className="text-[10px] md:text-sm text-amber-500 font-black bg-amber-500/10 px-2 md:px-3 py-0.5 md:py-1 rounded shadow-sm">{itemSelecionado.ultima_nota}</span>
                    </div>
                  )}

                  {/* CAIXA DE DISTRIBUIÇÃO DE ESTOQUE COM TOTAL */}
                  <div className="mt-3 md:mt-5 pt-2 md:pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-end mb-1 md:mb-2">
                      <p className="text-[10px] md:text-sm text-emerald-400 uppercase font-bold">Distribuição Física:</p>
                      <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase">
                        Total: <span className="text-emerald-400 font-black ml-1 md:ml-2 bg-emerald-400/10 px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm">{itemSelecionado.qtdOriginal} un</span>
                      </p>
                    </div>
                    <div className="max-h-28 md:max-h-48 overflow-y-auto space-y-1 md:space-y-2 pr-1 custom-scrollbar">
                      {itemSelecionado.locais?.map((loc, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs md:text-base bg-slate-800 p-1.5 md:p-3 rounded border border-slate-700/50 hover:bg-slate-700 transition-colors">
                          <span className="text-slate-300 font-mono tracking-wider">{loc.location || 'Sem Locação'}</span>
                          <span className="text-amber-400 font-bold bg-slate-900 px-2 md:px-3 py-0.5 md:py-1 rounded shadow-inner">{loc.qtd} un</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {itemSelecionado.part_number && itemSelecionado.part_number !== itemSelecionado.codigo && (
                    <p className="text-slate-400 text-[10px] md:text-sm font-mono leading-none mb-2 md:mb-4">P/N: {itemSelecionado.part_number}</p>
                  )}
                  <p className="font-bold text-xs md:text-xl text-white leading-tight mb-2 md:mb-4">{itemSelecionado.descricao}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] md:text-sm text-slate-400 uppercase font-bold">END: <span className="text-slate-200">{itemSelecionado.volume}</span></p>
                    <div className="text-right flex flex-col items-end">
                      {itemSelecionado.nota_origem && (
                        <p className="text-[9px] md:text-xs text-slate-500 uppercase font-bold">NFE ATUAL: {itemSelecionado.nota_origem}</p>
                      )}
                      {itemSelecionado.ultima_nota && itemSelecionado.ultima_nota !== "N/A" && (
                        <p className="text-[10px] md:text-sm text-amber-500 uppercase font-black mt-1 md:mt-2 bg-amber-500/10 px-1 md:px-2 py-0.5 md:py-1 rounded">
                          ÚLT. NFE: {itemSelecionado.ultima_nota}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mb-4 md:mb-8 shrink-0">
              <div className="flex items-center justify-center gap-2 md:gap-4">
                <button 
                  type="button"
                  onClick={() => handleAlterarQuantidade(-1)}
                  className="bg-slate-800 border border-slate-600 text-amber-400 w-12 h-12 md:w-20 md:h-16 text-xl md:text-3xl font-black active:bg-slate-700 hover:bg-slate-700 rounded transition-colors"
                >
                  -
                </button>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={quantidadeEditada}
                  onChange={handleDigitarQtd}
                  className="w-20 h-12 md:w-32 md:h-16 text-xl md:text-3xl text-center bg-slate-950 border-2 border-amber-400 text-white font-bold focus:outline-none rounded transition-all"
                />
                <button 
                  type="button"
                  onClick={() => handleAlterarQuantidade(1)}
                  className="bg-slate-800 border border-slate-600 text-amber-400 w-12 h-12 md:w-20 md:h-16 text-xl md:text-3xl font-black active:bg-slate-700 hover:bg-slate-700 rounded transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:gap-4 shrink-0">
              {itemSelecionado.isF41 ? (
                <div className="flex gap-2 md:gap-4">
                  <button 
                    type="button"
                    onClick={() => handleImprimir('individual')}
                    className="flex-1 bg-slate-900 text-slate-500 border border-slate-700/50 py-2 md:py-4 font-semibold active:bg-slate-800 text-[10px] md:text-sm uppercase rounded flex items-center justify-center gap-2 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  >
                    Imprimir (1x)
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleImprimir('montante')}
                    className="flex-1 bg-slate-900 text-slate-500 border border-slate-700/50 py-2 md:py-4 font-semibold active:bg-slate-800 text-[10px] md:text-sm uppercase rounded flex items-center justify-center gap-2 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  >
                    Imprimir (Lote)
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => handleImprimir('individual')}
                    className="bg-[#24527a] text-white py-3 md:py-5 font-extrabold active:bg-[#1a3d5c] text-xs md:text-base uppercase shadow-md flex items-center justify-center gap-2 rounded transition-colors hover:bg-[#1a3d5c]"
                  >
                    Imprimir Bluetooth (Individual)
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleImprimir('montante')}
                    className="bg-slate-800 text-blue-400 border border-blue-400/50 py-3 md:py-5 font-extrabold active:bg-slate-700 text-xs md:text-base uppercase flex items-center justify-center gap-2 rounded transition-colors hover:bg-slate-700"
                  >
                    Imprimir Bluetooth (Montante)
                  </button>
                </>
              )}
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}

export default App;