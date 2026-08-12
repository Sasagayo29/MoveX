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
  const buscarImpressoraAction = async (termoDeBusca) => {
    const buscaLimpa = termoDeBusca.trim().toUpperCase(); 
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
      setMensagem(`Impressora ${data.id} conectada.`);
      setTelaAtual('busca_nota'); 
      
    } catch (error) {
      setMensagem('ERRO DE CONEXÃO COM O SERVIDOR.');
    }
  };

  const handleBuscaImpressoraSubmit = (e) => {
    e.preventDefault();
    buscarImpressoraAction(impressoraID);
  };

  // --- PASSO 1: BUSCA GERAL (NOTA OU ITEM) ---
  const buscarNotaItemAction = async (termoDeBusca) => {
    const buscaLimpa = termoDeBusca.trim().toUpperCase(); 
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
        setMensagem('Pronto para imprimir.');
        setTelaAtual('detalhes_item');
      } else {
        setMensagem(`${data.tipo === 'NOTA' ? 'Nota' : 'Item'}: ${data.itens.length} registro(s).`);
        setTelaAtual('lista_itens');
      }
      
    } catch (error) {
      setMensagem('ERRO DE CONEXÃO COM O SERVIDOR.');
    }
  };

  const handleBuscaGeralSubmit = (e) => {
    e.preventDefault();
    buscarNotaItemAction(notaAtual);
  };

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

  // --- PASSO FINAL: IMPRESSÃO ---
  const handleImprimir = async (tipo) => {
    if (!quantidadeEditada || quantidadeEditada === '0') {
      setMensagem('ERRO: Quantidade inválida.');
      return;
    }
    
    setMensagem(`Enviando impressão...`);
    
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
        setMensagem('Sucesso! Etiqueta gerada.');
        // Limpa e volta para a tela de bipar a nota para o próximo item
        setTelaAtual('busca_nota');
        setNotaAtual('');
        setItemSelecionado(null);
      } else {
        setMensagem('ERRO: Impressora offline.');
      }
    } catch (error) {
      setMensagem('ERRO DE REDE AO IMPRIMIR.');
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
        setMensagem(`Selecione um item.`);
      }
    }
  };

  const itensFiltrados = itensDaNota.filter(item => 
    item.codigo.toUpperCase().includes(buscaPN.trim().toUpperCase()) ||
    (item.part_number && item.part_number.toUpperCase().includes(buscaPN.trim().toUpperCase()))
  );

  return (
    // ESTRUTURA PWA RESPONSIVA EXTREMA: h-screen, w-screen e overflow-hidden cravam o app na tela
    <div className="h-screen w-screen bg-slate-950 font-sans flex flex-col text-slate-100 overflow-hidden">
      
      {/* HEADER COMPACTO (shrink-0 impede que seja esmagado) */}
      <header className="bg-slate-900 border-b-2 border-amber-400/30 p-2 text-center shadow-lg relative flex items-center justify-center h-14 shrink-0">
        {telaAtual !== 'busca_impressora' && (
           <button 
             type="button" 
             onClick={handleVoltar} 
             className="absolute left-1 top-1/2 -translate-y-1/2 p-2 flex items-center text-amber-400 active:bg-slate-800 rounded"
           >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
             </svg>
           </button>
        )}
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white leading-tight">
            <span className="text-amber-400">KINROSS</span> MOVIMEX
          </h1>
          {impressoraAtual && (
             <p className="text-[9px] text-slate-400 tracking-widest uppercase leading-tight">
               PRT: {impressoraAtual.id}
             </p>
          )}
        </div>
      </header>

      {/* BARRA DE STATUS */}
      <div className="h-8 flex items-center justify-center border-l-4 border-amber-500 bg-slate-900 px-2 shrink-0">
        <p className="font-bold text-amber-400 text-center uppercase text-[10px] tracking-widest truncate">
          {mensagem}
        </p>
      </div>

      {/* ÁREA CENTRAL FLEXÍVEL E COM SCROLL APENAS SE NECESSÁRIO */}
      <main className="flex-1 p-2 flex flex-col overflow-y-auto">
        
        {telaAtual === 'busca_impressora' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <label className="text-amber-400 font-bold uppercase tracking-wider mb-2 text-xs text-center">
              Vincular Impressora
            </label>
            <input 
              ref={inputRef}
              type="text"
              value={impressoraID}
              onChange={(e) => setImpressoraID(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarImpressoraAction(impressoraID);
                }
              }}
              placeholder="BIPAR IMPRESSORA"
              className="w-full p-4 text-xl text-center bg-slate-800 border-2 border-amber-400 rounded-none focus:outline-none text-white uppercase"
            />
            {/* Opcional: botão oculto caso prefira manter o formulário para quem clica, mas o Enter já fará o trabalho */}
            <button onClick={handleBuscaImpressoraSubmit} className="mt-4 bg-slate-800 border border-amber-400/50 text-amber-400 p-3 font-bold uppercase active:bg-slate-700">
              Conectar
            </button>
          </div>
        )}

        {telaAtual === 'busca_nota' && (
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <label className="text-amber-400 font-bold uppercase tracking-wider mb-2 text-xs text-center">
              Bipar NFE ou Part Number
            </label>
            <input 
              ref={inputRef}
              type="text"
              value={notaAtual}
              onChange={(e) => setNotaAtual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarNotaItemAction(notaAtual);
                }
              }}
              placeholder="EX: 158602"
              className="w-full p-4 text-xl text-center bg-slate-800 border-2 border-amber-400 rounded-none focus:outline-none text-white uppercase"
            />
            <button onClick={handleBuscaGeralSubmit} className="mt-4 bg-slate-800 border border-amber-400/50 text-amber-400 p-3 font-bold uppercase active:bg-slate-700">
              Consultar
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
                placeholder="BIPAR OU DIGITAR P/N..."
                className="w-full p-2 text-sm bg-slate-800 border border-slate-600 focus:border-amber-400 text-white uppercase focus:outline-none"
                autoFocus 
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
                <p className="text-center text-slate-500 text-xs mt-4 uppercase font-bold">Nenhum P/N.</p>
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

            {/* Botões de Ação ocupando o resto do espaço */}
            <div className="flex flex-col gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => handleImprimir('individual')}
                className="bg-amber-500 text-slate-950 py-3 font-extrabold active:bg-amber-600 text-xs uppercase"
              >
                Etiqueta Individual
              </button>
              <button 
                type="button"
                onClick={() => handleImprimir('montante')}
                className="bg-slate-800 text-amber-400 border border-amber-400/50 py-3 font-extrabold active:bg-slate-700 text-xs uppercase"
              >
                Etiqueta Montante
              </button>
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}

export default App;