export const limparCodigoLido = (textoLido) => {
  if (!textoLido) return '';
  const texto = String(textoLido).trim();
  
  // O Leitor Zebra pode distorcer o "|" dependendo do layout do teclado (ex: }, ], \, /)
  // Esta Regex engloba todas as falhas físicas de leitura do leitor.
  if (/[|\]}\/\\]/.test(texto) && texto.length > 20) {
    const partes = texto.split(/[|\]}\/\\]/);
    if (partes.length >= 3) {
      const valorImportante = partes[2];
      const codigoLimpo = valorImportante.split('.')[0].trim();
      if (codigoLimpo.length >= 5) {
        return codigoLimpo;
      }
    }
  }
  return texto;
};