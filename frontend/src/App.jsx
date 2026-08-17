import React, { useState, useRef, useEffect } from 'react';
import { salvarSincronizacao, buscarOffline } from './db'; // Nosso banco offline
import { Html5QrcodeScanner } from 'html5-qrcode';

const API_BASE_URL = '/api';

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
  const [mensagem, setMensagem] = useState('Bipe a impressora ou faça a Sincronização.');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [alvoCamera, setAlvoCamera] = useState(''); // 'impressora' ou 'nota'
  
  const inputRef = useRef(null);

  useEffect(() => {
    if ((telaAtual === 'busca_impressora' || telaAtual === 'busca_nota') && !cameraAtiva) {
      inputRef.current?.focus();
    }
  }, [telaAtual, mensagem, cameraAtiva]);

  // --- MOTOR OFFLINE: SINCRONIZAÇÃO ---
  const handleSincronizar = async () => {
    setSincronizando(true);
    setMensagem('Baixando dados do servidor...');
    try {
      const response = await fetch(`${API_BASE_URL}/sync`);
      if (!response.ok) throw new Error('Falha na rede');
      
      const data = await response.json();
      await salvarSincronizacao('impressoras', data.impressoras);
      await salvarSincronizacao('itens', data.itens);
      
      setMensagem('Sincronização Offline Concluída!');
    } catch (error) {
      setMensagem('ERRO: Não foi possível sincronizar. Sem rede?');
    } finally {
      setSincronizando(false);
    }
  };

  // --- BUSCA OFFLINE: IMPRESSORA ---
  const buscarImpressoraAction = async (termoDeBusca) => {
    const buscaLimpa = termoDeBusca.trim().toUpperCase(); 
    if (!buscaLimpa) return;

    setMensagem('Buscando offline...');
    
    // Tenta buscar no banco local primeiro
    const resultados = await buscarOffline('impressoras', buscaLimpa);
    
    if (resultados.length > 0) {
      setImpressoraAtual(resultados[0]);
      setMensagem(`Impressora ${resultados[0].id} pronta.`);
      setTelaAtual('busca_nota');
    } else {
      // Fallback para IP direto caso não esteja no banco
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(buscaLimpa)) {
        setImpressoraAtual({ id: `PRN-${buscaLimpa}`, ip: buscaLimpa });
        setMensagem('IP de Impressora configurado manualmente.');
        setTelaAtual('busca_nota');
      } else {
        setMensagem('IMPRESSORA NÃO ENCONTRADA. Sincronize o app.');
        setImpressoraID('');
      }
    }
  };

  // --- BUSCA OFFLINE: NOTA / ITEM ---
  const buscarNotaItemAction = async (termoDeBusca) => {
    const buscaLimpa = termoDeBusca.trim().toUpperCase(); 
    if (!buscaLimpa) return;

    setMensagem('Buscando na memória do Pocket...');
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

  // --- CONTROLES DE INTERFACE ---
  const selecionarItem = (item) => {
    setItemSelecionado(item);
    setQuantidadeEditada(item.qtdOriginal.toString()); 
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

  // --- IMPRESSÃO BLUETOOTH NATIVA (SEM SERVIDOR) ---
  const handleImprimirBluetooth = async (tipo) => {
    if (!quantidadeEditada || quantidadeEditada === '0') {
      setMensagem('ERRO: Quantidade inválida.');
      return;
    }
    
    setMensagem(`Aguardando conexão com a Zebra...`);
    
    try {
      // Formatação ZPL
      const zplOriginal = itemSelecionado.zpl.replace('¨', '');
      const qtdPrint = tipo === 'individual' ? 1 : parseInt(quantidadeEditada, 10);
      const zplPronto = /\^PQ\d+/.test(zplOriginal) 
          ? zplOriginal.replace(/\^PQ\d+/, `^PQ${qtdPrint}`) 
          : zplOriginal.replace('^XZ', `^PQ${qtdPrint}^XZ`);

      // API Nativa do Navegador (Web Bluetooth)
      // O UUID genérico da Zebra é '38eb4a80-c570-11e3-9507-0002a5d5c51b'
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['38eb4a80-c570-11e3-9507-0002a5d5c51b']
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('38eb4a80-c570-11e3-9507-0002a5d5c51b');
      const characteristic = await service.getCharacteristic('38eb4a82-c570-11e3-9507-0002a5d5c51b');

      // Transformar o texto ZPL em Bytes e enviar em pedaços (Chunking obrigatório para BLE)
      const encoder = new TextEncoder();
      const data = encoder.encode(zplPronto);
      const chunkSize = 512; // ZQ521 aguenta blocos de 512 bytes

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await characteristic.writeValue(chunk);
      }

      setMensagem('Sucesso! Etiqueta enviada via Bluetooth.');
      
      // Desconecta para economizar bateria do coletor
      device.gatt.disconnect();
      
      setTelaAtual('busca_nota');
      setNotaAtual('');
      setItemSelecionado(null);
      
    } catch (error) {
      console.error(error);
      setMensagem(`ERRO BT: Cancele e tente novamente.`);
    }
  };

  // --- NAVEGAÇÃO ---
  const handleVoltar = () => {
    if (telaAtual === 'busca_nota') {
      setTelaAtual('busca_impressora');
      setImpressoraAtual(null);
      setImpressoraID('');
      setMensagem('Bipe a impressora ou faça Sincronização.');
    }
    else if (telaAtual === 'lista_itens') {
      setTelaAtual('busca_nota');
      setNotaAtual('');
      setItensDaNota([]);
      setBuscaPN('');
      setMensagem(`Impressora ${impressoraAtual?.id} pronta.`);
    }
    else if (telaAtual === 'detalhes_item') {
      if (itensDaNota.length === 1) {
        setTelaAtual('busca_nota');
        setNotaAtual('');
        setItensDaNota([]);
        setBuscaPN('');
        setItemSelecionado(null);
        setMensagem(`Impressora ${impressoraAtual?.id} pronta.`);
      } else {
        setTelaAtual('lista_itens');
        setItemSelecionado(null);
        setBuscaPN('');
        setMensagem(`Selecione um item.`);
      }
    }
  };

  // --- CÂMERA SCANNER ---
  useEffect(() => {
    if (cameraAtiva) {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [0] // Prioriza a câmera traseira
      });
      
      scanner.render((textoLido) => {
        scanner.clear();
        setCameraAtiva(false);
        if (alvoCamera === 'impressora') {
          setImpressoraID(textoLido);
          buscarImpressoraAction(textoLido);
        } else {
          setNotaAtual(textoLido);
          buscarNotaItemAction(textoLido);
        }
      }, (error) => {
        // Ignora erros de frame vazio
      });

      return () => {
        scanner.clear().catch(e => console.log(e));
      };
    }
  }, [cameraAtiva]);

  const abrirCamera = (alvo) => {
    setAlvoCamera(alvo);
    setCameraAtiva(true);
  };

  const itensFiltrados = itensDaNota.filter(item => 
    item.busca_global.includes(buscaPN.trim().toUpperCase())
  );

  return (
    <div className="h-screen w-screen bg-slate-950 font-sans flex flex-col text-slate-100 overflow-hidden relative">
      
      {/* HEADER COMPACTO COM BOTÃO DE SINCRONIZAÇÃO */}
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
             <p className="text-[9px] text-slate-400 tracking-widest uppercase leading-tight">
               PRT: {impressoraAtual.id}
             </p>
          )}
        </div>

        {/* BOTÃO DE SINCRONIZAÇÃO OFFLINE */}
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
      </header>

      {/* BARRA DE STATUS */}
      <div className="h-8 flex items-center justify-center border-l-4 border-amber-500 bg-slate-900 px-2 shrink-0">
        <p className="font-bold text-amber-400 text-center uppercase text-[10px] tracking-widest truncate">
          {mensagem}
        </p>
      </div>

      {/* MODAL DA CÂMERA */}
      {cameraAtiva && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col pt-10">
          <div className="flex justify-between items-center px-4 mb-4">
            <h2 className="text-amber-400 font-bold uppercase">Leitor de Câmera</h2>
            <button onClick={() => setCameraAtiva(false)} className="bg-red-600 text-white px-4 py-2 font-bold rounded">
              Fechar
            </button>
          </div>
          <div id="reader" className="w-full bg-black flex-1"></div>
        </div>
      )}

      {/* ÁREA CENTRAL FLEXÍVEL */}
      <main className="flex-1 p-2 flex flex-col overflow-y-auto relative">
        
        {telaAtual === 'busca_impressora' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <label className="text-amber-400 font-bold uppercase tracking-wider mb-2 text-xs text-center">
              Vincular Impressora
            </label>
            <div className="relative">
              <input 
                ref={inputRef}
                type="text"
                value={impressoraID}
                onChange={(e) => setImpressoraID(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); buscarImpressoraAction(impressoraID); }
                }}
                placeholder="NOME, IP OU BIPE"
                className="w-full p-4 pr-12 text-xl text-center bg-slate-800 border-2 border-amber-400 rounded-none focus:outline-none text-white uppercase"
              />
              <button 
                type="button" 
                onClick={() => abrirCamera('impressora')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
            <button onClick={() => buscarImpressoraAction(impressoraID)} className="mt-4 bg-slate-800 border border-amber-400/50 text-amber-400 p-3 font-bold uppercase active:bg-slate-700">
              Conectar
            </button>
          </div>
        )}

        {telaAtual === 'busca_nota' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <label className="text-amber-400 font-bold uppercase tracking-wider mb-2 text-xs text-center">
              Bipar NFE ou Part Number
            </label>
            <div className="relative">
              <input 
                ref={inputRef}
                type="text"
                value={notaAtual}
                onChange={(e) => setNotaAtual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); buscarNotaItemAction(notaAtual); }
                }}
                placeholder="EX: 158602"
                className="w-full p-4 pr-12 text-xl text-center bg-slate-800 border-2 border-amber-400 rounded-none focus:outline-none text-white uppercase"
              />
              <button 
                type="button" 
                onClick={() => abrirCamera('nota')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
            <button onClick={() => buscarNotaItemAction(notaAtual)} className="mt-4 bg-slate-800 border border-amber-400/50 text-amber-400 p-3 font-bold uppercase active:bg-slate-700">
              Consultar Offline
            </button>
          </div>
        )}

        {telaAtual === 'lista_itens' && (
          <div className="flex-1 flex flex-col h-full">
            <div className="mb-2 shrink-0">
              <input 
                type="text"
                value={buscaPN}
                onChange={(e) => setBuscaPN(e.target.value)}
                placeholder="PESQUISAR NESTA LISTA..."
                className="w-full p-2 text-sm bg-slate-800 border border-slate-600 focus:border-amber-400 text-white uppercase focus:outline-none"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pb-2">
              {itensFiltrados.length > 0 ? (
                itensFiltrados.map((item, index) => (
                  <button
                    key={`${item.codigo}-${index}`} 
                    onClick={() => selecionarItem(item)}
                    className="w-full text-left bg-slate-900 p-3 border border-slate-700 active:bg-slate-800 focus:outline-none"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex flex-col">
                         <span className="font-mono font-bold text-amber-400 text-sm leading-none">{item.codigo}</span>
                         {item.part_number && item.part_number !== item.codigo && (
                           <span className="text-slate-400 text-[9px] font-mono mt-1">P/N: {item.part_number}</span>
                         )}
                      </div>
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 font-bold border border-slate-700">
                        QTD: {item.qtdOriginal}
                      </span>
                    </div>
                    <p className="font-bold text-xs text-white line-clamp-2 leading-tight mt-1">{item.descricao}</p>
                    <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">END: {item.volume}</p>
                  </button>
                ))
              ) : (
                <p className="text-center text-slate-500 text-xs mt-4 uppercase font-bold">Nenhum registro correspondente.</p>
              )}
            </div>
          </div>
        )}

        {telaAtual === 'detalhes_item' && itemSelecionado && (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            
            {/* Card de Detalhes Super Compacto */}
            <div className="bg-slate-900 p-3 border border-slate-700 mb-3 relative shrink-0">
              <p className="font-mono font-bold text-lg text-amber-400 leading-none mb-1">{itemSelecionado.codigo}</p>
              {itemSelecionado.part_number && itemSelecionado.part_number !== itemSelecionado.codigo && (
                <p className="text-slate-400 text-[10px] font-mono leading-none mb-2">P/N: {itemSelecionado.part_number}</p>
              )}
              <p className="font-bold text-xs text-white leading-tight mb-2">{itemSelecionado.descricao}</p>
              <div className="flex justify-between items-end">
                 <p className="text-[10px] text-slate-400 uppercase font-bold">END: <span className="text-slate-200">{itemSelecionado.volume}</span></p>
                 {itemSelecionado.nota_origem && (
                   <p className="text-[9px] text-slate-500 uppercase font-bold">NFE: {itemSelecionado.nota_origem}</p>
                 )}
              </div>
            </div>

            {/* Controle numérico compacto */}
            <div className="mb-4 shrink-0">
              <div className="flex items-center justify-center gap-2">
                <button 
                  type="button"
                  onClick={() => handleAlterarQuantidade(-1)}
                  className="bg-slate-800 border border-slate-600 text-amber-400 w-12 h-12 text-xl font-black active:bg-slate-700"
                >
                  -
                </button>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={quantidadeEditada}
                  onChange={handleDigitarQtd}
                  className="w-20 h-12 text-xl text-center bg-slate-950 border-2 border-amber-400 text-white font-bold focus:outline-none"
                />
                <button 
                  type="button"
                  onClick={() => handleAlterarQuantidade(1)}
                  className="bg-slate-800 border border-slate-600 text-amber-400 w-12 h-12 text-xl font-black active:bg-slate-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Botões de Impressão Bluetooth */}
            <div className="flex flex-col gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => handleImprimirBluetooth('individual')}
                className="bg-[#24527a] text-white py-3 font-extrabold active:bg-[#1a3d5c] text-xs uppercase shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Imprimir Bluetooth (Individual)
              </button>
              <button 
                type="button"
                onClick={() => handleImprimirBluetooth('montante')}
                className="bg-slate-800 text-blue-400 border border-blue-400/50 py-3 font-extrabold active:bg-slate-700 text-xs uppercase flex items-center justify-center gap-2"
              >
                Imprimir Bluetooth (Montante)
              </button>
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}

export default App;