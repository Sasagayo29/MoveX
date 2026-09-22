import React from 'react';

export const TelaBuscaF41 = ({ inputRef, termoF41, setTermoF41, buscarF41Action, abrirCamera }) => (
  <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full">
    <label className="text-emerald-400 font-bold uppercase tracking-wider mb-2 text-xs md:text-sm text-center">Consultar Item / Locação</label>
    <div className="relative">
      <input 
        ref={inputRef} type="text" autoComplete="off" value={termoF41}
        onChange={(e) => setTermoF41(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarF41Action(termoF41); } }}
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
);