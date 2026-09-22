import React from 'react';

export const Header = ({ telaAtual, handleVoltar, impressoraAtual, handleAtualizarApp, sincronizando, handleSincronizar }) => (
  <header className="bg-slate-900 border-b-2 border-amber-400/30 p-2 flex items-center justify-between h-14 shrink-0 shadow-lg relative">
    {telaAtual !== 'busca_impressora' ? (
      <button onClick={handleVoltar} className="p-2 flex items-center text-amber-400 active:bg-slate-800 rounded">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
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
      <button onClick={handleAtualizarApp} disabled={sincronizando} className={`p-2 rounded flex flex-col items-center justify-center w-12 transition-colors ${sincronizando ? 'text-slate-500' : 'text-emerald-400 active:bg-slate-800'}`}>
        <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        <span className="text-[7px] uppercase font-bold tracking-wider">Update</span>
      </button>
      <button onClick={handleSincronizar} disabled={sincronizando} className={`p-2 rounded flex flex-col items-center justify-center w-12 transition-colors ${sincronizando ? 'animate-pulse text-slate-500' : 'text-blue-400 active:bg-slate-800'}`}>
        <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        <span className="text-[7px] uppercase font-bold tracking-wider">Sync</span>
      </button>
    </div>
  </header>
);