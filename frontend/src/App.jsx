import React, { useState, useRef, useEffect } from 'react';

// URL do Backend Python (Ajustado para a porta correta)
const API_BASE_URL = 'http://localhost:8001/api';

function App() {
  // Controle de Navegação: 'busca_impressora' é a nova tela inicial
  const [telaAtual, setTelaAtual] = useState('busca_impressora');
  
  const [impressoraID, setImpressoraID] = useState('');
  const [impressoraAtual, setImpressoraAtual] = useState(null); // Armazena o IP vindo do KAD
  
  const [notaAtual, setNotaAtual] = useState('');
  const [itensDaNota, setItensDaNota] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidadeEditada, setQuantidadeEditada] = useState('');
  
  const [buscaPN, setBuscaPN] = useState('');
  const [mensagem, setMensagem] = useState('Bipe a impressora para iniciar.');
  
  const inputRef = useRef(null);

  // Foca o input principal sempre que estiver nas telas de busca
  useEffect(() => {
    if (telaAtual === 'busca_impressora' || telaAtual === 'busca_nota') {
      inputRef.current?.focus();
    }
  }, [telaAtual, mensagem]);

  // --- PASSO 0: BUSCAR IMPRESSORA NO KAD ---
  const handleBuscaImpressora = async (e) => {
    e.preventDefault();
    const buscaLimpa = impressoraID.trim().toUpperCase(); 
    
    if (!buscaLimpa) return;

    setMensagem('Consultando servidor KAD...');

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
      setTelaAtual('busca_nota'); // Avança para bipar a nota
      
    } catch (error) {
      setMensagem('ERRO DE CONEXÃO COM O SERVIDOR.');
    }
  };

  // --- PASSO 1: BUSCAR NOTA ---
  const handleBuscaNota = async (e) => {
    e.preventDefault();
    const buscaLimpa = notaAtual.trim().toUpperCase(); 
    
    if (!buscaLimpa) return;

    setMensagem('Consultando nota...');

    try {
      const response = await fetch(`${API_BASE_URL}/notas/${buscaLimpa}`);
      
      if (!response.ok) {
        setMensagem('NOTA NÃO ENCONTRADA NA BASE DE DADOS.');
        setNotaAtual('');
        return;
      }

      const data = await response.json();
      
      setItensDaNota(data.itens);
      setBuscaPN(''); 
      setMensagem(`Nota localizada com ${data.itens.length} itens.`);
      setTelaAtual('lista_itens');
      
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
          impressora_ip: impressoraAtual.ip, // Usa o IP puxado do servidor KAD
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

  // --- NAVEGAÇÃO SECUNDÁRIA ---
  const voltarParaBuscaImpressora = () => {
    setTelaAtual('busca_impressora');
    setImpressoraAtual(null);
    setImpressoraID('');
    setMensagem('Bipe a impressora para iniciar.');
  };

  const voltarParaBuscaNota = () => {
    setTelaAtual('busca_nota');
    setNotaAtual('');
    setItensDaNota([]);
    setBuscaPN('');
    setMensagem(`Impressora ${impressoraAtual.id} pronta.`);
  };

  const voltarParaLista = () => {
    setTelaAtual('lista_itens');
    setItemSelecionado(null);
    setBuscaPN('');
    setMensagem(`Nota ${notaAtual.toUpperCase()} - Selecione um item.`);
  };

  const itensFiltrados = itensDaNota.filter(item => 
    item.codigo.toUpperCase().includes(buscaPN.trim().toUpperCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 p-3 font-sans flex flex-col text-slate-100">
      
      <header className="bg-slate-900 border-b-2 border-amber-400/30 p-4 mb-4 text-center shadow-lg relative flex items-center justify-center">
        {telaAtual === 'busca_nota' && (
           <button type="button" onClick={voltarParaBuscaImpressora} className="absolute left-4 text-amber-400 font-bold uppercase text-sm tracking-wider active:text-amber-600 p-2">
             &lt; Voltar
           </button>
        )}
        {telaAtual === 'lista_itens' && (
           <button type="button" onClick={voltarParaBuscaNota} className="absolute left-4 text-amber-400 font-bold uppercase text-sm tracking-wider active:text-amber-600 p-2">
             &lt; Voltar
           </button>
        )}
        {telaAtual === 'detalhes_item' && (
           <button type="button" onClick={voltarParaLista} className="absolute left-4 text-amber-400 font-bold uppercase text-sm tracking-wider active:text-amber-600 p-2">
             &lt; Voltar
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

      {/* TELA 0: BUSCA DE IMPRESSORA (KAD) */}
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

      {/* TELA 1: BUSCA DE NOTA */}
      {telaAtual === 'busca_nota' && (
        <form onSubmit={handleBuscaNota} className="flex-1 flex flex-col justify-center mb-10">
          <label className="text-amber-400 font-bold uppercase tracking-wider mb-3 text-sm text-center">
            Bipar Número da Nota
          </label>
          <input 
            ref={inputRef}
            type="text"
            value={notaAtual}
            onChange={(e) => setNotaAtual(e.target.value)}
            placeholder="EX: 158602"
            className="w-full p-5 text-2xl text-center bg-slate-800 border-2 border-amber-400 rounded-none shadow-[0_0_15px_rgba(251,191,36,0.15)] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-600 text-white uppercase"
            autoFocus
          />
          <button type="submit" className="mt-8 bg-slate-800 border border-amber-400/50 text-amber-400 p-4 font-bold tracking-widest uppercase active:bg-slate-700 shadow-md">
            Consultar Sistema
          </button>
        </form>
      )}

      {/* TELA 2: LISTAGEM COM CHAVES ÚNICAS CORRIGIDAS */}
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
                  key={`${item.codigo}-${index}`} /* CORREÇÃO DO WARNING AQUI */
                  onClick={() => selecionarItem(item)}
                  className="w-full text-left bg-slate-900 p-4 border border-slate-700 active:bg-slate-800 focus:outline-none focus:border-amber-400 transition-colors shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono font-bold text-amber-400 text-base">{item.codigo}</span>
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

      {/* TELA 3: DETALHES E IMPRESSÃO */}
      {telaAtual === 'detalhes_item' && itemSelecionado && (
        <div className="flex-1 flex flex-col">
          <div className="bg-slate-900 p-5 border border-slate-700 mb-5 shadow-sm">
            <p className="text-[10px] uppercase text-slate-500 tracking-widest mb-1">Código SAP/SKU</p>
            <p className="font-mono font-bold text-xl text-amber-400 mb-4">{itemSelecionado.codigo}</p>
            
            <p className="text-[10px] uppercase text-slate-500 tracking-widest mb-1">Descrição do Material</p>
            <p className="font-bold text-sm text-white mb-4 leading-relaxed">{itemSelecionado.descricao}</p>
            
            <p className="text-[10px] uppercase text-slate-500 tracking-widest mb-1">Alocação FÍSICA</p>
            <p className="font-bold text-sm text-slate-300">{itemSelecionado.volume}</p>
          </div>

          <div className="mb-6">
            <label className="block text-center text-slate-400 font-bold uppercase tracking-widest mb-3 text-xs">
              Volume para Etiquetagem
            </label>
            <div className="flex items-center justify-center gap-3">
              <button 
                type="button"
                onClick={() => handleAlterarQuantidade(-1)}
                className="bg-slate-800 border border-slate-600 text-amber-400 w-14 h-14 text-2xl font-black flex items-center justify-center active:bg-slate-700 shadow-sm"
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
                className="bg-slate-800 border border-slate-600 text-amber-400 w-14 h-14 text-2xl font-black flex items-center justify-center active:bg-slate-700 shadow-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 mt-auto pb-2">
            <button 
              type="button"
              onClick={() => handleImprimir('individual')}
              className="bg-amber-500 text-slate-950 p-4 font-extrabold active:bg-amber-600 transition-colors text-sm uppercase tracking-widest shadow-lg flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Etiqueta Individual
            </button>
            
            <button 
              type="button"
              onClick={() => handleImprimir('montante')}
              className="bg-slate-800 text-amber-400 border border-amber-400/50 p-4 font-extrabold active:bg-slate-700 transition-colors text-sm uppercase tracking-widest shadow-lg flex justify-center items-center gap-2"
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