import React from 'react';

export const MenuPrincipal = ({ setTelaAtual }) => (
  <div className="flex-1 flex flex-col justify-center items-center max-w-sm md:max-w-lg mx-auto w-full gap-4 md:gap-8">
    <button onClick={() => setTelaAtual('busca_nota')} className="w-full bg-slate-800 border-2 border-blue-500 text-blue-400 p-6 md:p-10 font-bold uppercase rounded-lg active:bg-slate-700 flex flex-col items-center gap-2 md:gap-4 transition-all md:text-xl hover:bg-slate-800/80">
      <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
      1. Recebimento (KBM)
    </button>
    <button onClick={() => setTelaAtual('busca_f41')} className="w-full bg-slate-800 border-2 border-emerald-500 text-emerald-400 p-6 md:p-10 font-bold uppercase rounded-lg active:bg-slate-700 flex flex-col items-center gap-2 md:gap-4 transition-all md:text-xl hover:bg-slate-800/80">
      <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      2. Consulta de Item (F41)
    </button>
  </div>
);