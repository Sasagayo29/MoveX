import React from 'react';

export const TelaBuscaImpressora = ({ inputRef, impressoraID, setImpressoraID, buscarImpressoraHibrida, telaAtual, cameraAtiva, abrirCamera }) => (
  <div className="flex-1 flex flex-col justify-center max-w-sm md:max-w-xl mx-auto w-full gap-5 md:gap-8">
    <div className="text-center mb-2">
      <label className="text-amber-400 font-bold uppercase tracking-wider text-xs md:text-sm">Vincular Impressora</label>
      <p className="text-[10px] md:text-xs text-slate-500 mt-2 md:mt-4 uppercase tracking-wide leading-relaxed px-4">
        Bipe o MAC ou IP para conectar no <strong className="text-slate-300">Wi-Fi</strong>. Se não achar, o <strong className="text-blue-400">Bluetooth</strong> abrirá pedindo a Zebra.
      </p>
    </div>
    <div className="bg-slate-900 border border-slate-800 p-3 md:p-6 rounded-lg shadow-inner">
      <div className="relative mb-4 md:mb-6">
        <input 
          ref={inputRef} type="text" autoComplete="off" value={impressoraID}
          onChange={(e) => setImpressoraID(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarImpressoraHibrida(impressoraID); } }}
          onBlur={() => { if (telaAtual === 'busca_impressora' && !cameraAtiva) { setTimeout(() => inputRef.current?.focus(), 10); } }}
          placeholder="IP, MAC OU NOME"
          className="w-full p-4 md:p-6 pr-12 text-lg md:text-2xl text-center bg-slate-950 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-amber-400 text-white placeholder:text-slate-600 transition-all"
        />
        <button type="button" onClick={() => abrirCamera('impressora')} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-slate-400 p-2 md:p-4 active:text-amber-400 hover:text-amber-400">
          <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>
      <button onClick={() => buscarImpressoraHibrida(impressoraID)} className="w-full bg-amber-500 text-slate-950 border border-amber-600 p-4 md:p-6 font-extrabold uppercase active:bg-amber-600 md:text-lg tracking-wider rounded-lg shadow-md flex items-center justify-center gap-2 transition-all hover:bg-amber-400">
        Conectar Dispositivo
      </button>
    </div>
  </div>
);