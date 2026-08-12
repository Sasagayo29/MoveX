import React, { useState, useRef, useEffect } from 'react';

const API_BASE_URL = '/api';

function App() {
  const [telaAtual, setTelaAtual] = useState('busca_impressora');
  
  const [impressoraID, setImpressoraID] = useState('');
  const [impressoraAtual, setImpressoraAtual] = useState(null); 
  
  const [notaAtual, setNotaAtual] = useState('');
  const [itensDaNota, setItensDaNota] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidadeEditada, setQuantidadeEditada] = useState('');
  
  const [buscaPN, setBuscaPN] = useState('');
  const [mensagem, setMensagem] = useState('Bipe a impressora para iniciar.');
  
  const inputRef = useRef(null);

  useEffect(() => {
    if (telaAtual === 'busca_impressora' || telaAtual === 'busca_nota') {
      inputRef.current?.focus();
    }
  }, [telaAtual, mensagem]);

  // --- PASSO 0: BUSCAR IMPRESSORA ---
  const handleBuscaImpressora = async (e) => {
    e.preventDefault();
    const buscaLimpa = impressoraID.trim().toUpperCase(); 
    
    if (!buscaLimpa) return;

    setMensagem('Consultando servidor...');

    try {
      const response = await fetch(`${API_BASE_URL}/impressora/${buscaLimpa}`);
      
      if (!response.ok) {
        setMensagem('IMPRESSORA NÃO ENCONTRADA NA REDE.');
        setImpressoraID('');
        return;
      }

      const data = await response.json();
      setImpressoraAtual(data);
      setMensagem(`Impressora ${data.id} conectada (${data.ip}).`);
      setTelaAtual('busca_nota'); 
      
    } catch (error) {
      setMensagem('ERRO DE CONEXÃO COM O SERVIDOR.');
    }
  };

  // --- PASSO 1: BUSCA GERAL (NOTA OU ITEM) ---
  const handleBuscaGeral = async (e) => {
    e.preventDefault();
    const buscaLimpa = notaAtual.trim().toUpperCase(); 
    
    if (!buscaLimpa) return;

    setMensagem('Consultando base de dados...');

    try {
      const response = await fetch(`${API_BASE_URL}/busca/${buscaLimpa}`);
      
      if (!response.ok) {
        setMensagem('NENHUMA NOTA OU ITEM ENCONTRADO.');
        setNotaAtual('');
        return;
      }

      const data = await response.json();
      
      setItensDaNota(data.itens);
      setBuscaPN(''); 
      
      if (data.tipo === 'ITEM' && data.itens.length === 1) {
        setItemSelecionado(data.itens[0]);
        setQuantidadeEditada(data.itens[0].qtdOriginal.toString());
        setMensagem('Item localizado diretamente. Pronto para imprimir.');
        setTelaAtual('detalhes_item');
      } else {
        setMensagem(`${data.tipo === 'NOTA' ? 'Nota' : 'Item'} localizado com ${data.itens.length} registro(s).`);
        setTelaAtual('lista_itens');
      }
      
    } catch (error) {
      setMensagem('ERRO DE CONEXÃO COM O SERVIDOR.');
    }
  };

  const selecionarItem = (item) => {
    setItemSelecionado(item);
    setQuantidadeEditada(item.qtdOriginal.toString()); 
    setMensagem('Ajuste a quantidade ou imprima a etiqueta.');
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

  // --- PASSO FINAL: IMPRESSÃO ---
  const handleImprimir = async (tipo) => {
    if (!quantidadeEditada || quantidadeEditada === '0') {
      setMensagem('ERRO: Quantidade inválida.');
      return;
    }
    
    setMensagem(`Enviando impressão ${tipo.toUpperCase()}...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/imprimir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          impressora_ip: impressoraAtual.ip, 
          codigo_item: itemSelecionado.codigo,
          nota: notaAtual.toUpperCase(),
          quantidade: parseInt(quantidadeEditada, 10),
          zpl_formula: itemSelecionado.zpl,
          tipo: tipo
        })
      });

      if (response.ok) {
        setMensagem('Impressão enviada com sucesso para ZQ521/ZQ511.');
      } else {
        setMensagem('ERRO: Impressora offline ou inacessível.');
      }
    } catch (error) {
      setMensagem('ERRO DE REDE AO ENVIAR IMPRESSÃO.');
    }
  };

  // --- NAVEGAÇÃO UNIFICADA ---
  const handleVoltar = () => {
    if (telaAtual === 'busca_nota') {
      setTelaAtual('busca_impressora');
      setImpressoraAtual(null);
      setImpressoraID('');
      setMensagem('Bipe a impressora para iniciar.');
    }
    else if (telaAtual === 'lista_itens') {
      setTelaAtual('busca_nota');
      setNotaAtual('');
      setItensDaNota([]);
      setBuscaPN('');
      setMensagem(`Impressora ${impressoraAtual.id} pronta.`);
    }
    else if (telaAtual === 'detalhes_item') {
      // Se a nota tiver apenas 1 item, significa que fizemos a "Busca Cega" (P/N direto).
      // Então pulamos a lista de itens e voltamos direto para a tela de busca.
      if (itensDaNota.length === 1) {
        setTelaAtual('busca_nota');
        setNotaAtual('');
        setItensDaNota([]);
        setBuscaPN('');
        setItemSelecionado(null);
        setMensagem(`Impressora ${impressoraAtual.id} pronta.`);
      } else {
        setTelaAtual('lista_itens');
        setItemSelecionado(null);
        setBuscaPN('');
        setMensagem(`Nota ${notaAtual.toUpperCase()} - Selecione um item.`);
      }
    }
  };

  const itensFiltrados = itensDaNota.filter(item => 
    item.codigo.toUpperCase().includes(buscaPN.trim().toUpperCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 p-3 font-sans flex flex-col text-slate-100">
      
      {/* HEADER MELHORADO COM BOTÃO DE VOLTAR ROBUSTO */}
      <header className="bg-slate-900 border-b-2 border-amber-400/30 p-4 mb-4 text-center shadow-lg relative flex items-center justify-center min-h-[72px]">
        {telaAtual !== 'busca_impressora' && (
           <button 
             type="button" 
             onClick={handleVoltar} 
             className="absolute left-2 top-1/2 -translate-y-1/2 p-3 flex items-center gap-1 text-amber-400 active:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
           >
             <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
             </svg>
             <span className="font-extrabold text-sm tracking-widest uppercase hidden sm:inline">Voltar</span>
           </button>
        )}
        
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            <span className="text-amber-400">KINROSS</span> MOVIMEX
          </h1>
          <p className="text-[10px] text-slate-400 tracking-widest uppercase">
            {impressoraAtual ? `PRT: ${impressoraAtual.id}` : 'Módulo ZQ521 & ZQ511'}
          </p>
        </div>
      </header>

      <div className="h-10 flex items-center justify-center mb-4 border-l-4 border-amber-500 bg-slate-900 px-2 shadow-sm">
        <p className="font-bold text-amber-400 text-center uppercase text-xs tracking-widest truncate">
          {mensagem}
        </p>
      </div>

      {telaAtual === 'busca_impressora' && (
        <form onSubmit={handleBuscaImpressora} className="flex-1 flex flex-col justify-center mb-10">
          <label className="text-amber-400 font-bold uppercase tracking-wider mb-3 text-sm text-center">
            Vincular Impressora ZQ521 & ZQ511
          </label>
          <input 
            ref={inputRef}
            type="text"
            value={impressoraID}
            onChange={(e) => setImpressoraID(e.target.value)}
            placeholder="BIPAR ID DA IMPRESSORA"
            className="w-full p-5 text-2xl text-center bg-slate-800 border-2 border-amber-400 rounded-none shadow-[0_0_15px_rgba(251,191,36,0.15)] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-600 text-white uppercase"
            autoFocus
          />
          <button type="submit" className="mt-8 bg-slate-800 border border-amber-400/50 text-amber-400 p-4 font-bold tracking-widest uppercase active:bg-slate-700 shadow-md">
            Conectar Dispositivo
          </button>
        </form>
      )}

      {telaAtual === 'busca_nota' && (
        <form onSubmit={handleBuscaGeral} className="flex-1 flex flex-col justify-center mb-10">
          <label className="text-amber-400 font-bold uppercase tracking-wider mb-3 text-sm text-center">
            Bipar NFE ou Part Number (P/N)
          </label>
          <input 
            ref={inputRef}
            type="text"
            value={notaAtual}
            onChange={(e) => setNotaAtual(e.target.value)}
            placeholder="EX: 158602 OU 687984"
            className="w-full p-5 text-2xl text-center bg-slate-800 border-2 border-amber-400 rounded-none shadow-[0_0_15px_rgba(251,191,36,0.15)] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-600 text-white uppercase"
            autoFocus
          />
          <button type="submit" className="mt-8 bg-slate-800 border border-amber-400/50 text-amber-400 p-4 font-bold tracking-widest uppercase active:bg-slate-700 shadow-md">
            Consultar Sistema
          </button>
        </form>
      )}

      {/* TELA 2: LISTAGEM DE ITENS */}
      {telaAtual === 'lista_itens' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-xs font-bold border-b border-amber-400/20 pb-2 mb-3 text-slate-300 tracking-widest uppercase">
            Documento: <span className="text-amber-400 text-sm ml-1">{notaAtual.toUpperCase()}</span>
          </h2>

          <div className="mb-4">
            <input 
              type="text"
              value={buscaPN}
              onChange={(e) => setBuscaPN(e.target.value)}
              placeholder="BIPAR OU DIGITAR P/N..."
              className="w-full p-3 text-lg bg-slate-800 border border-slate-600 focus:border-amber-400 text-white placeholder:text-slate-500 uppercase focus:outline-none shadow-inner"
              autoFocus 
            />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {itensFiltrados.length > 0 ? (
              itensFiltrados.map((item, index) => (
                <button
                  key={`${item.codigo}-${index}`} 
                  onClick={() => selecionarItem(item)}
                  className="w-full text-left bg-slate-900 p-4 border border-slate-700 active:bg-slate-800 focus:outline-none focus:border-amber-400 transition-colors shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono font-bold text-amber-400 text-base">{item.codigo}</span>
                      {/* EXIBIÇÃO DA COLUNA E AQUI */}
                      {item.part_number && item.part_number !== item.codigo && (
                        <span className="ml-2 bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded-none border border-slate-700 font-mono tracking-wider">
                          P/N: {item.part_number}
                        </span>
                      )}
                    </div>
                    <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-1 rounded-none font-bold border border-slate-700 tracking-wider uppercase">
                      Qtd NFE: {item.qtdOriginal}
                    </span>
                  </div>
                  <p className="font-bold text-sm text-white line-clamp-2 leading-relaxed">{item.descricao}</p>
                  <p className="text-xs text-slate-500 mt-3 uppercase tracking-wider font-semibold">END: {item.volume}</p>
                </button>
              ))
            ) : (
              <p className="text-center text-slate-500 text-sm mt-6 uppercase tracking-wider font-bold">
                Nenhum P/N correspondente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TELA 3: PAINEL DE IMPRESSÃO */}
      {telaAtual === 'detalhes_item' && itemSelecionado && (
        <div className="flex-1 flex flex-col">
          <div className="bg-slate-900 p-5 border border-slate-700 mb-5 shadow-sm relative">
            <p className="text-[10px] uppercase text-slate-500 tracking-widest mb-1">Código SAP/SKU</p>
            <div className="flex items-baseline gap-3 mb-4">
              <p className="font-mono font-bold text-xl text-amber-400">{itemSelecionado.codigo}</p>
              {/* EXIBIÇÃO DA COLUNA E AQUI */}
              {itemSelecionado.part_number && itemSelecionado.part_number !== itemSelecionado.codigo && (
                <span className="bg-slate-800 text-slate-300 px-2 py-1 text-[10px] border border-slate-700 font-mono tracking-widest uppercase">
                  P/N: {itemSelecionado.part_number}
                </span>
              )}
            </div>
            
            <p className="text-[10px] uppercase text-slate-500 tracking-widest mb-1">Descrição do Material</p>
            <p className="font-bold text-sm text-white mb-4 leading-relaxed">{itemSelecionado.descricao}</p>
            
            <p className="text-[10px] uppercase text-slate-500 tracking-widest mb-1">Alocação FÍSICA</p>
            <p className="font-bold text-sm text-slate-300">{itemSelecionado.volume}</p>
            
            {itemSelecionado.nota_origem && (
               <div className="absolute top-4 right-4 bg-slate-800 border border-slate-700 px-2 py-1 shadow-sm">
                 <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Origem: {itemSelecionado.nota_origem}</p>
               </div>
            )}
          </div>
          <div className="mb-6">
            <label className="block text-center text-slate-400 font-bold uppercase tracking-widest mb-3 text-xs">
              Volume para Etiquetagem
            </label>
            <div className="flex items-center justify-center gap-3">
              <button 
                type="button"
                onClick={() => handleAlterarQuantidade(-1)}
                className="bg-slate-800 border border-slate-600 text-amber-400 w-14 h-14 text-2xl font-black flex items-center justify-center active:bg-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                -
              </button>
              
              <input 
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantidadeEditada}
                onChange={handleDigitarQtd}
                className="w-32 h-14 text-3xl text-center bg-slate-950 border-2 border-amber-400 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.1)]"
              />
              
              <button 
                type="button"
                onClick={() => handleAlterarQuantidade(1)}
                className="bg-slate-800 border border-slate-600 text-amber-400 w-14 h-14 text-2xl font-black flex items-center justify-center active:bg-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 mt-auto pb-2">
            <button 
              type="button"
              onClick={() => handleImprimir('individual')}
              className="bg-amber-500 text-slate-950 p-4 font-extrabold active:bg-amber-600 transition-colors text-sm uppercase tracking-widest shadow-lg flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Etiqueta Individual
            </button>
            
            <button 
              type="button"
              onClick={() => handleImprimir('montante')}
              className="bg-slate-800 text-amber-400 border border-amber-400/50 p-4 font-extrabold active:bg-slate-700 transition-colors text-sm uppercase tracking-widest shadow-lg flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Etiqueta Montante
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;