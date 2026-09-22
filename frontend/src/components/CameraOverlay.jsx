import React from 'react';

export const CameraOverlay = ({ setCameraAtiva }) => (
  <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col">
    <div className="absolute top-0 w-full z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent pt-6">
      <h2 className="text-amber-400 font-extrabold uppercase tracking-wider text-sm drop-shadow-md">Escaneando...</h2>
      <button onClick={() => setCameraAtiva(false)} className="bg-red-600 text-white px-5 py-2 font-bold uppercase text-xs rounded-full shadow-lg active:bg-red-700 backdrop-blur-sm transition-all border border-red-500">Cancelar</button>
    </div>
    <div id="reader" className="w-full h-full flex-1 bg-black overflow-hidden flex items-center justify-center"></div>
    <div className="absolute bottom-12 w-full text-center z-10 pointer-events-none">
      <p className="text-white text-[10px] font-bold uppercase tracking-widest bg-black/60 inline-block px-4 py-2 rounded-full border border-slate-700 backdrop-blur-sm">Aponte para o Código de Barras</p>
    </div>
  </div>
);