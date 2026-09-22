import React from 'react';

export const TelaDetalhesItem = ({ itemSelecionado, quantidadeEditada, handleDigitarQtd, handleAlterarQuantidade, handleImprimir }) => (
  <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full">
    <div className="bg-slate-900 p-3 md:p-6 border border-slate-700 mb-3 md:mb-6 relative shrink-0 rounded shadow-md">
      <p className="font-mono font-bold text-lg md:text-3xl text-amber-400 leading-none mb-1 md:mb-3">{itemSelecionado.codigo}</p>
      
      {itemSelecionado.isF41 ? (
        <>
          <p className="text-slate-400 text-[10px] md:text-sm font-mono leading-none mb-2 md:mb-4">TIPO: {itemSelecionado.tipo}</p>
          <p className="font-bold text-xs md:text-xl text-white leading-tight mb-1 md:mb-2">{itemSelecionado.descricao}</p>
          {itemSelecionado.linha2 && <p className="text-slate-300 text-[10px] md:text-sm leading-tight mb-2 md:mb-4">{itemSelecionado.linha2}</p>}
          
          {itemSelecionado.ultima_nota && itemSelecionado.ultima_nota !== "N/A" && (
            <div className="mt-2 md:mt-4 mb-1 md:mb-3 flex items-center gap-2">
              <span className="text-[9px] md:text-xs text-slate-500 uppercase font-bold">ÚLTIMA NFE:</span>
              <span className="text-[10px] md:text-sm text-amber-500 font-black bg-amber-500/10 px-2 md:px-3 py-0.5 md:py-1 rounded shadow-sm">{itemSelecionado.ultima_nota}</span>
            </div>
          )}

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
              {itemSelecionado.nota_origem && <p className="text-[9px] md:text-xs text-slate-500 uppercase font-bold">NFE ATUAL: {itemSelecionado.nota_origem}</p>}
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
        <button type="button" onClick={() => handleAlterarQuantidade(-1)} className="bg-slate-800 border border-slate-600 text-amber-400 w-12 h-12 md:w-20 md:h-16 text-xl md:text-3xl font-black active:bg-slate-700 hover:bg-slate-700 rounded transition-colors">-</button>
        <input type="text" inputMode="numeric" value={quantidadeEditada} onChange={handleDigitarQtd} className="w-20 h-12 md:w-32 md:h-16 text-xl md:text-3xl text-center bg-slate-950 border-2 border-amber-400 text-white font-bold focus:outline-none rounded transition-all"/>
        <button type="button" onClick={() => handleAlterarQuantidade(1)} className="bg-slate-800 border border-slate-600 text-amber-400 w-12 h-12 md:w-20 md:h-16 text-xl md:text-3xl font-black active:bg-slate-700 hover:bg-slate-700 rounded transition-colors">+</button>
      </div>
    </div>

    <div className="flex flex-col gap-2 md:gap-4 shrink-0">
      {itemSelecionado.isF41 ? (
        <div className="flex gap-2 md:gap-4">
          <button type="button" onClick={() => handleImprimir('individual')} className="flex-1 bg-slate-900 text-slate-500 border border-slate-700/50 py-2 md:py-4 font-semibold active:bg-slate-800 text-[10px] md:text-sm uppercase rounded flex items-center justify-center gap-2 transition-colors hover:bg-slate-800 hover:text-slate-300">Imprimir (1x)</button>
          <button type="button" onClick={() => handleImprimir('montante')} className="flex-1 bg-slate-900 text-slate-500 border border-slate-700/50 py-2 md:py-4 font-semibold active:bg-slate-800 text-[10px] md:text-sm uppercase rounded flex items-center justify-center gap-2 transition-colors hover:bg-slate-800 hover:text-slate-300">Imprimir (Lote)</button>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => handleImprimir('individual')} className="bg-[#24527a] text-white py-3 md:py-5 font-extrabold active:bg-[#1a3d5c] text-xs md:text-base uppercase shadow-md flex items-center justify-center gap-2 rounded transition-colors hover:bg-[#1a3d5c]">Imprimir Bluetooth (Individual)</button>
          <button type="button" onClick={() => handleImprimir('montante')} className="bg-slate-800 text-blue-400 border border-blue-400/50 py-3 md:py-5 font-extrabold active:bg-slate-700 text-xs md:text-base uppercase flex items-center justify-center gap-2 rounded transition-colors hover:bg-slate-700">Imprimir Bluetooth (Montante)</button>
        </>
      )}
    </div>
  </div>
);