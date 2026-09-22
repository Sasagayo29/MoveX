import React from 'react';

export const TelaListaItens = ({ buscaPN, setBuscaPN, itensFiltrados, selecionarItem }) => (
  <div className="flex-1 flex flex-col h-full max-w-sm md:max-w-2xl mx-auto w-full">
    <div className="mb-2 md:mb-4 shrink-0">
      <input 
        type="text" value={buscaPN} onChange={(e) => setBuscaPN(e.target.value)} placeholder="PESQUISAR NESTA LISTA..."
        className="w-full p-2 md:p-4 text-sm md:text-base bg-slate-800 border border-slate-600 focus:border-amber-400 text-white uppercase focus:outline-none rounded transition-all"
      />
    </div>
    <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 pb-2 custom-scrollbar">
      {itensFiltrados.length > 0 ? (
        itensFiltrados.map((item, index) => (
          <button key={`${item.codigo}-${index}`} onClick={() => selecionarItem(item)} className="w-full text-left bg-slate-900 p-3 md:p-5 border border-slate-700 active:bg-slate-800 hover:bg-slate-800 focus:outline-none rounded transition-all">
            <div className="flex justify-between items-center mb-1 md:mb-2">
              <div className="flex flex-col">
                 <span className="font-mono font-bold text-amber-400 text-sm md:text-lg leading-none">{item.codigo}</span>
                 {item.part_number && item.part_number !== item.codigo && <span className="text-slate-400 text-[9px] md:text-xs font-mono mt-1">P/N: {item.part_number}</span>}
              </div>
              <span className="bg-slate-800 text-slate-300 text-[10px] md:text-xs px-2 md:px-3 py-1 font-bold border border-slate-700 rounded">QTD: {item.qtdOriginal}</span>
            </div>
            <p className="font-bold text-xs md:text-base text-white line-clamp-2 leading-tight mt-1">{item.descricao}</p>
            <p className="text-[9px] md:text-xs text-slate-500 mt-2 uppercase tracking-wider font-semibold">
              END: {item.volume}
              {item.ultima_nota && item.ultima_nota !== "N/A" && <span className="text-amber-500/80 ml-2">| ÚLT: {item.ultima_nota}</span>}
            </p>
          </button>
        ))
      ) : <p className="text-center text-slate-500 text-xs md:text-sm mt-4 uppercase font-bold">Nenhum registro correspondente.</p>}
    </div>
  </div>
);