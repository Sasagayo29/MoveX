import React from 'react';

export const StatusBar = ({ mensagem }) => (
  <div className="h-8 flex items-center justify-center border-l-4 border-amber-500 bg-slate-900 px-2 shrink-0">
    <p className="font-bold text-amber-400 text-center uppercase text-[10px] tracking-widest truncate">{mensagem}</p>
  </div>
);