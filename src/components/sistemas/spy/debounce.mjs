// Debounce genérico — usado pelos sliders de peso/tolerância da aba Dados e critérios (mesma
// necessidade do original, index.html:1516-1520: "o slider dispara oninput a cada pixel
// arrastado — sem isso vira dezenas de PUT /api/config por segundo"). Aqui o motivo é mais forte
// ainda: cada chamada que passa vira uma linha em module_action_log (mutations.ts) — arrasto vira
// lixo de auditoria, não só tráfego de rede.

export function criarDebounce(fn, ms) {
  let timer = null;
  function debounced(...args) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}
